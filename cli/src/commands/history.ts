import {
	compareSecretHistoryVersions,
	decodeHistoryCursor,
	paginateSecretHistory,
	type SecretHistoryObservation,
	type SecretHistoryVersion,
} from '../lib/crypto';
import { getRelays, loadProjectConfig } from '../lib/config';
import { ValidationError } from '../lib/errors';
import { PublishQuorumError } from '../lib/relay';
import {
	SecretManager,
	getNextSecretTimestamp,
	type SecretPublication,
} from '../lib/secret-manager';
import type { NostrEvent, RedshiftConfig, SecretBundle } from '../lib/types';
import { validateEnvironment, validateProjectId } from '../lib/validation';
import type { RequiredAuth } from './login';
import { requireAuth } from './login';

const EVENT_ID_PATTERN = /^[0-9a-f]{64}$/;

export type HistorySubcommand = 'list' | 'compare' | 'restore';

export interface HistoryOptions {
	subcommand: HistorySubcommand;
	project?: string;
	environment?: string;
	limit?: number;
	cursor?: string;
	json?: boolean;
	fromEventId?: string;
	toEventId?: string;
	eventId?: string;
	yes?: boolean;
	overwriteCurrent?: boolean;
}

export interface HistoryManager {
	getPublicKey(): string;
	connect(relays: string[]): void;
	fetchSecretHistory(project: string, environment: string): Promise<SecretHistoryObservation>;
	publishSecrets(
		project: string,
		environment: string,
		secrets: SecretBundle,
		options?: { createdAt?: number },
	): Promise<NostrEvent>;
	getLastPublication(): SecretPublication | null;
	close(): Promise<void>;
}

export interface HistoryCommandDependencies {
	loadProjectConfig: (directory: string) => Promise<RedshiftConfig | null>;
	requireCurrentAuth: () => Promise<RequiredAuth>;
	getRelayUrls: () => Promise<string[]>;
	createManager: (auth: RequiredAuth) => HistoryManager;
	now: () => number;
	cwd: () => string;
}

export async function historyCommand(
	options: HistoryOptions,
	dependencies: Partial<HistoryCommandDependencies> = {},
) {
	validateStructuralOptions(options);
	const deps = resolveDependencies(dependencies);
	const projectConfig = await deps.loadProjectConfig(deps.cwd());
	const { project, environment } = validateScope(
		options.project ?? projectConfig?.project,
		options.environment ?? projectConfig?.environment,
	);

	const auth = await deps.requireCurrentAuth();
	const manager = deps.createManager(auth);
	try {
		manager.connect(projectConfig?.relays ?? (await deps.getRelayUrls()));
		const history = await manager.fetchSecretHistory(project, environment);
		switch (options.subcommand) {
			case 'list':
				listHistory(history, options);
				return;
			case 'compare':
				compareHistory(history, options);
				return;
			case 'restore':
				await restoreHistory(manager, history, project, environment, options, deps.now());
				return;
		}
	} finally {
		await manager.close();
	}
}

function resolveDependencies(
	dependencies: Partial<HistoryCommandDependencies>,
): HistoryCommandDependencies {
	return {
		loadProjectConfig: dependencies.loadProjectConfig ?? loadProjectConfig,
		requireCurrentAuth: dependencies.requireCurrentAuth ?? requireAuth,
		getRelayUrls: dependencies.getRelayUrls ?? getRelays,
		createManager:
			dependencies.createManager ??
			((auth) => {
				const credential = auth.privateKey ?? auth.signer;
				if (!credential) throw new ValidationError('Authenticated history signer is unavailable');
				return new SecretManager(credential);
			}),
		now: dependencies.now ?? (() => Math.floor(Date.now() / 1000)),
		cwd: dependencies.cwd ?? process.cwd,
	};
}

function validateStructuralOptions(options: HistoryOptions) {
	if (options.subcommand === 'list') {
		if (options.limit !== undefined) validateHistoryLimit(options.limit);
		if (options.cursor !== undefined) decodeHistoryCursor(options.cursor);
		return;
	}
	if (options.subcommand === 'compare') {
		validateEventId(options.fromEventId, 'from event ID');
		validateEventId(options.toEventId, 'to event ID');
		return;
	}
	validateEventId(options.eventId, 'history event ID');
	if (!options.yes) {
		throw new ValidationError(
			'History restore requires --yes to confirm complete-bundle replacement',
		);
	}
}

function validateHistoryLimit(limit: number) {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
		throw new ValidationError('History page limit must be between 1 and 100');
	}
}

function validateEventId(value: string | undefined, label: string): asserts value is string {
	if (!value || !EVENT_ID_PATTERN.test(value)) {
		throw new ValidationError(`Invalid ${label}; expected a lowercase 64-character event ID`);
	}
}

function validateScope(project: string | undefined, environment: string | undefined) {
	if (!project || !environment) {
		throw new ValidationError(
			'No project configured; run `redshift setup` or specify --project and --config',
		);
	}
	const projectResult = validateProjectId(project);
	if (!projectResult.valid) throw new ValidationError(projectResult.error ?? 'Invalid project ID');
	const environmentResult = validateEnvironment(environment);
	if (!environmentResult.valid) {
		throw new ValidationError(environmentResult.error ?? 'Invalid environment');
	}
	return { project, environment };
}

function listHistory(history: SecretHistoryObservation, options: HistoryOptions) {
	const page = paginateSecretHistory(history, {
		...(options.limit === undefined ? {} : { limit: options.limit }),
		...(options.cursor === undefined ? {} : { cursor: options.cursor }),
	});
	const versions = page.items.map(toVersionMetadata);
	if (options.json) {
		console.log(
			JSON.stringify(
				{
					versions,
					nextCursor: page.nextCursor,
					truncated: page.truncated,
					observedEvents: page.observedEvents,
					semantics: 'bounded owner-authenticated state observed from responding configured relays',
				},
				null,
				2,
			),
		);
		return;
	}
	if (versions.length === 0)
		console.log('No authenticated observed history for this project/config.');
	for (const version of versions) {
		const labels = [
			version.current ? 'current' : 'historical',
			version.tombstone ? 'tombstone' : 'live',
		];
		console.log(
			`${version.createdAt}  ${version.eventId}  ${labels.join(',')}  ${version.keyCount} key(s)`,
		);
	}
	console.log('Observed from responding configured relays; relay history may be incomplete.');
	if (page.truncated) console.log('History observation is truncated by a fixed safety bound.');
	if (page.nextCursor) console.log(`Next cursor: ${page.nextCursor}`);
}

function compareHistory(history: SecretHistoryObservation, options: HistoryOptions) {
	const from = findVersion(history, options.fromEventId!);
	const to = findVersion(history, options.toEventId!);
	const diff = compareSecretHistoryVersions(from, to);
	const output = {
		fromEventId: from.eventId,
		toEventId: to.eventId,
		fromTombstone: from.tombstone,
		toTombstone: to.tombstone,
		...diff,
	};
	if (options.json) {
		console.log(JSON.stringify(output, null, 2));
		return;
	}
	console.log(`From ${from.eventId}${from.tombstone ? ' (logical tombstone)' : ''}`);
	console.log(`To   ${to.eventId}${to.tombstone ? ' (logical tombstone)' : ''}`);
	for (const [label, keys] of Object.entries(diff)) {
		console.log(`${label}: ${keys.length === 0 ? '(none)' : keys.join(', ')}`);
	}
	console.log('Comparison shows key names and change categories only; values are never printed.');
}

async function restoreHistory(
	manager: HistoryManager,
	history: SecretHistoryObservation,
	project: string,
	environment: string,
	options: HistoryOptions,
	now: number,
) {
	if (history.truncated) {
		throw new ValidationError(
			'Observed history is truncated by a safety bound; restore is blocked',
		);
	}
	const selected = findVersion(history, options.eventId!);
	const initialCurrent = history.versions[0] ?? null;
	const refreshed = await manager.fetchSecretHistory(project, environment);
	if (refreshed.truncated) {
		throw new ValidationError(
			'Refreshed history is truncated by a safety bound; restore is blocked',
		);
	}
	const observedCurrent = refreshed.versions[0] ?? null;
	const currentChanged = (initialCurrent?.eventId ?? null) !== (observedCurrent?.eventId ?? null);
	if (currentChanged && !options.overwriteCurrent) {
		throw new ValidationError(
			'Authenticated current changed during restore preflight; review again or use --overwrite-current with --yes',
		);
	}
	if (observedCurrent?.eventId === selected.eventId) {
		console.log(`Event ${selected.eventId} is already current; no new event was published.`);
		return;
	}
	const newestCreatedAt = Math.max(selected.createdAt, observedCurrent?.createdAt ?? 0);
	try {
		const event = await manager.publishSecrets(
			project,
			environment,
			{ ...selected.secrets },
			{
				createdAt: getNextSecretTimestamp(newestCreatedAt, now),
			},
		);
		const publication = manager.getLastPublication();
		if (publication && publication.report.accepted.length < publication.report.outcomes.length) {
			console.error(
				`Restore reached quorum with degraded redundancy for exact event ${event.id}; run \`redshift recovery show ${event.id}\`.`,
			);
		}
		console.log(
			selected.tombstone
				? `Published logical tombstone restore as new event ${event.id}; prior relay events are not erased.`
				: `Published historical bundle as new event ${event.id}; prior relay events are unchanged.`,
		);
	} catch (error) {
		const eventId =
			error instanceof PublishQuorumError ? error.event.id : manager.getLastPublication()?.event.id;
		if (eventId) {
			console.error(
				`Restore publication is incomplete or uncertain for exact event ${eventId}; run \`redshift recovery show ${eventId}\`.`,
			);
		}
		throw error;
	}
}

function findVersion(history: SecretHistoryObservation, eventId: string) {
	const version = history.versions.find((candidate) => candidate.eventId === eventId);
	if (!version) {
		throw new ValidationError(
			`Authenticated history event ${eventId} was not found in the bounded observed result`,
		);
	}
	return version;
}

function toVersionMetadata(version: SecretHistoryVersion) {
	return {
		eventId: version.eventId,
		createdAt: version.createdAt,
		current: version.current,
		tombstone: version.tombstone,
		keyCount: Object.keys(version.secrets).length,
	};
}
