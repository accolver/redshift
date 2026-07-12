/**
 * Secrets Command - Manage secrets
 *
 * L5: Journey-Validator - Secret management workflow
 */

import { chmodSync } from 'node:fs';
import { formatEnvLine, parseEnvFileDetailed } from '@redshift/crypto';
import { getRelays, loadProjectConfig } from '../lib/config';
import { ValidationError } from '../lib/errors';
import { PublishQuorumError } from '../lib/relay';
import { SecretManager, mergeSecrets, validateInjectableSecretName } from '../lib/secret-manager';
import {
	formatValidationError,
	normalizeSecretKey,
	redactValue,
	validateEnvironment,
	validateProjectId,
	validateSecretKey,
	validateSecretValue,
} from '../lib/validation';
import { requireAuth } from './login';

export type SecretsSubcommand = 'list' | 'get' | 'set' | 'delete' | 'download' | 'upload';

export interface SecretsOptions {
	subcommand: SecretsSubcommand;
	/** Secret key for get/set/delete, or file path for upload */
	key?: string;
	/** Secret value for set */
	value?: string;
	/** Override project */
	project?: string;
	/** Override environment */
	environment?: string;
	/** Show raw values (not redacted) */
	raw?: boolean;
	/** Output format */
	format?: 'table' | 'json' | 'env';
}

/**
 * Execute the secrets command.
 */
export async function secretsCommand(options: SecretsOptions): Promise<void> {
	// Load project config
	const cwd = process.cwd();
	const projectConfig = await loadProjectConfig(cwd);

	const projectId = options.project || projectConfig?.project;
	const environment = options.environment || projectConfig?.environment;

	if (!projectId || !environment) {
		console.error('Error: No project configured.');
		console.error('Run `redshift setup` first or specify --project and --environment.');
		process.exit(1);
	}

	// Validate project ID and environment
	const projectValidation = validateProjectId(projectId);
	if (!projectValidation.valid) {
		console.error(formatValidationError('project ID', projectValidation));
		process.exit(1);
	}

	const envValidation = validateEnvironment(environment);
	if (!envValidation.valid) {
		console.error(formatValidationError('environment', envValidation));
		process.exit(1);
	}

	// Require authentication
	const auth = await requireAuth();

	// Connect to relays
	const relays = projectConfig?.relays || (await getRelays());
	const manager = new SecretManager(auth.privateKey ?? auth.signer!);
	manager.connect(relays);

	try {
		switch (options.subcommand) {
			case 'list':
				await listSecrets(manager, projectId, environment, options);
				break;

			case 'get': {
				if (!options.key) {
					console.error('Error: Key is required for `secrets get`');
					process.exit(1);
				}
				// Validate key format
				const getKeyValidation = validateSecretKey(options.key);
				if (!getKeyValidation.valid) {
					console.error(formatValidationError('secret key', getKeyValidation));
					process.exit(1);
				}
				await getSecret(manager, projectId, environment, normalizeSecretKey(options.key), options);
				break;
			}

			case 'set': {
				if (!options.key) {
					console.error('Error: Key is required for `secrets set`');
					process.exit(1);
				}
				if (options.value === undefined) {
					console.error('Error: Value is required for `secrets set`');
					process.exit(1);
				}
				// Validate key
				const setKeyValidation = validateSecretKey(options.key);
				if (!setKeyValidation.valid) {
					console.error(formatValidationError('secret key', setKeyValidation));
					process.exit(1);
				}
				validateInjectableSecretName(options.key);
				// Validate value
				const setValueValidation = validateSecretValue(options.value);
				if (!setValueValidation.valid) {
					console.error(formatValidationError('secret value', setValueValidation));
					process.exit(1);
				}
				await setSecret(
					manager,
					projectId,
					environment,
					normalizeSecretKey(options.key),
					options.value,
				);
				break;
			}

			case 'delete': {
				if (!options.key) {
					console.error('Error: Key is required for `secrets delete`');
					process.exit(1);
				}
				// Validate key format
				const deleteKeyValidation = validateSecretKey(options.key);
				if (!deleteKeyValidation.valid) {
					console.error(formatValidationError('secret key', deleteKeyValidation));
					process.exit(1);
				}
				await deleteSecret(manager, projectId, environment, normalizeSecretKey(options.key));
				break;
			}

			case 'download':
				await downloadSecrets(manager, projectId, environment, options);
				break;

			case 'upload':
				await uploadSecrets(manager, projectId, environment, options.key);
				break;

			default:
				console.error(`Unknown subcommand: ${options.subcommand}`);
				console.error('Available: list, get, set, delete, download');
				process.exit(1);
		}
	} catch (error) {
		if (error instanceof PublishQuorumError) {
			console.error(
				`Publication failed below quorum. Exact encrypted event ${error.event.id} is preserved locally; run \`redshift recovery show ${error.event.id}\`.`,
			);
		}
		throw error;
	} finally {
		await manager.close();
	}
}

/**
 * List all secrets for the current project/environment.
 */
async function listSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || Object.keys(secrets).length === 0) {
		console.log(`No secrets found for ${projectId}/${environment}`);
		return;
	}

	const format = options.format || 'table';
	const outputSecrets = prepareSecretsForOutput(secrets, options.raw === true);
	if (options.raw) warnAboutRawOutput();

	switch (format) {
		case 'json':
			console.log(JSON.stringify(outputSecrets, null, 2));
			break;

		case 'env':
			for (const [key, value] of Object.entries(outputSecrets)) {
				console.log(formatEnvLine(key, value));
			}
			break;
		default: {
			console.log(`Secrets for ${projectId}/${environment}:`);
			console.log('');
			const maxKeyLen = Math.max(...Object.keys(secrets).map((k) => k.length), 10);
			console.log(`${'KEY'.padEnd(maxKeyLen)}  VALUE`);
			console.log(`${'-'.repeat(maxKeyLen)}  ${'-'.repeat(40)}`);

			for (const [key, value] of Object.entries(outputSecrets)) {
				const displayValue = value;
				console.log(`${key.padEnd(maxKeyLen)}  ${displayValue}`);
			}
			break;
		}
	}
}

/**
 * Get a single secret value.
 */
async function getSecret(
	manager: SecretManager,
	projectId: string,
	environment: string,
	key: string,
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || !(key in secrets)) {
		console.error(`Secret '${key}' not found in ${projectId}/${environment}`);
		process.exit(1);
	}

	const value = secrets[key]!;

	if (options.raw) {
		warnAboutRawOutput();
		process.stdout.write(value);
	} else {
		console.log(`${key}=${formatSecretValue(value, false)}`);
	}
}

/**
 * Set a secret value.
 */
async function setSecret(
	manager: SecretManager,
	projectId: string,
	environment: string,
	key: string,
	value: string,
): Promise<void> {
	// Fetch existing secrets
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};

	// Store value as string (environment variables are always strings)
	const updatedSecrets = mergeSecrets(existingSecrets, { [key]: value });

	// Publish updated secrets
	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Set ${key} in ${projectId}/${environment}`);
	printPublicationWarning(manager);
}

/**
 * Delete a secret.
 */
async function deleteSecret(
	manager: SecretManager,
	projectId: string,
	environment: string,
	key: string,
): Promise<void> {
	// Fetch existing secrets
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};

	if (!(key in existingSecrets)) {
		console.error(`Secret '${key}' not found in ${projectId}/${environment}`);
		process.exit(1);
	}

	// Remove the key
	const updatedSecrets = { ...existingSecrets };
	delete updatedSecrets[key];

	// Publish updated secrets
	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Deleted ${key} from ${projectId}/${environment}`);
	printPublicationWarning(manager);
}

/**
 * Download secrets as .env file content.
 */
async function downloadSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || Object.keys(secrets).length === 0) {
		console.error(`No secrets found for ${projectId}/${environment}`);
		process.exit(1);
	}

	if (!options.raw) {
		throw new ValidationError('Secret export requires --raw to acknowledge plaintext output.');
	}
	warnAboutRawOutput();
	const content = Object.entries(secrets)
		.map(([key, value]) => formatEnvLine(key, value))
		.join('\n');
	if (options.key) {
		await Bun.write(options.key, `${content}\n`);
		chmodSync(options.key, 0o600);
		console.log(`✓ Downloaded secrets to ${options.key}`);
	} else {
		process.stdout.write(`${content}\n`);
	}
}

/**
 * Upload secrets from a .env file.
 */
async function uploadSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	filePath?: string,
): Promise<void> {
	// Default to .env in current directory
	const envFile = filePath || '.env';

	// Check if file exists
	const file = Bun.file(envFile);
	const exists = await file.exists();

	if (!exists) {
		console.error(`Error: File not found: ${envFile}`);
		console.error('Usage: redshift secrets upload [file]');
		console.error('Default file is .env in current directory.');
		process.exit(1);
	}

	// Parse and validate the entire file before reading or publishing existing state.
	const content = await file.text();
	const parsedSecrets = parseSecretUpload(content);

	if (Object.keys(parsedSecrets).length === 0) {
		console.error('Error: No secrets found in file.');
		console.error('File should be in .env format: KEY=value');
		process.exit(1);
	}

	// Fetch existing secrets to merge
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};

	// Merge with new secrets (new values overwrite existing)
	const updatedSecrets = mergeSecrets(existingSecrets, parsedSecrets);

	// Show what will be uploaded
	const newKeys = Object.keys(parsedSecrets);
	const existingKeys = Object.keys(existingSecrets);
	const overwrittenKeys = newKeys.filter((k) => existingKeys.includes(k));
	const addedKeys = newKeys.filter((k) => !existingKeys.includes(k));

	console.log(`Uploading ${newKeys.length} secrets to ${projectId}/${environment}...`);
	if (addedKeys.length > 0) {
		console.log(`  Adding: ${addedKeys.join(', ')}`);
	}
	if (overwrittenKeys.length > 0) {
		console.log(`  Overwriting: ${overwrittenKeys.join(', ')}`);
	}

	// Publish updated secrets
	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Uploaded ${newKeys.length} secrets from ${envFile}`);
	printPublicationWarning(manager);
}

function printPublicationWarning(manager: SecretManager): void {
	const publication = manager.getLastPublication();
	if (!publication || publication.report.outcomes.every(({ state }) => state === 'accepted'))
		return;
	console.warn(
		`Warning: saved with degraded relay redundancy (${publication.report.accepted.length}/${publication.report.outcomes.length} relays accepted).`,
	);
	for (const outcome of publication.report.outcomes.filter(({ state }) => state !== 'accepted')) {
		console.warn(
			`  ${outcome.relay}: ${outcome.state}${outcome.reason ? ` (${outcome.reason})` : ''}`,
		);
	}
	console.warn(`Run \`redshift recovery show ${publication.event.id}\` to inspect or retry.`);
}

/**
 * Format a secret value for display.
 */
export function parseSecretUpload(content: string) {
	const parsed = parseEnvFileDetailed(content);
	const problems = parsed.issues.map((issue) => `line ${issue.line}: ${issue.message}`);
	const normalized: Record<string, string> = {};
	for (const [key, value] of Object.entries(parsed.secrets)) {
		const normalizedKey = normalizeSecretKey(key);
		const keyValidation = validateSecretKey(normalizedKey);
		const valueValidation = validateSecretValue(value);
		try {
			validateInjectableSecretName(normalizedKey);
		} catch (error) {
			problems.push(error instanceof Error ? error.message : String(error));
		}
		if (!keyValidation.valid)
			problems.push(formatValidationError(`secret key ${key}`, keyValidation));
		if (!valueValidation.valid) {
			problems.push(formatValidationError(`secret value for ${key}`, valueValidation));
		}
		if (Object.hasOwn(normalized, normalizedKey)) {
			problems.push(`duplicate key after normalization: ${normalizedKey}`);
		} else {
			normalized[normalizedKey] = value;
		}
	}
	if (problems.length > 0) {
		throw new ValidationError(
			`Invalid .env file:\n${problems.map((problem) => `- ${problem}`).join('\n')}`,
		);
	}
	return normalized;
}

export function formatSecretValue(value: string, showRaw: boolean): string {
	if (showRaw) return value;
	return value.length > 0 ? redactValue(value) : '(empty)';
}

export function prepareSecretsForOutput(secrets: Record<string, string>, showRaw: boolean) {
	return Object.fromEntries(
		Object.entries(secrets).map(([key, value]) => [key, formatSecretValue(value, showRaw)]),
	);
}

function warnAboutRawOutput() {
	console.error('Warning: --raw reveals plaintext secrets; keep stdout out of logs and history.');
}
