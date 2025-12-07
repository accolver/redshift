/**
 * Secret Manager - Core business logic for secret operations
 *
 * L2: Function-Author - Secret management functions
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { getPublicKey } from 'nostr-tools/pure';
import {
	createDTag,
	createDeletionEvent,
	createTombstone,
	parseDTag,
	unwrapGiftWrap,
	unwrapSecrets as unwrapSecretsFromEvent,
	wrapSecrets as wrapSecretsToEvent,
} from './crypto';
import type { UnwrapResult } from './crypto';
import { NotConnectedError } from './errors';
import type { RelayPool } from './relay';
import { createRelayPool, filterGiftWraps } from './relay';
import type { GiftWrapResult, NostrEvent, SecretBundle } from './types';

/**
 * Cached secret entry with metadata
 */
interface SecretEntry {
	secrets: SecretBundle;
	dTag: string;
	createdAt: number;
	eventId: string;
}

/**
 * SecretManager handles all secret-related operations including
 * encryption, relay communication, and state management.
 */
export class SecretManager {
	private privateKey: Uint8Array;
	private publicKey: string;
	private pool: RelayPool | null = null;

	constructor(privateKey: Uint8Array) {
		this.privateKey = privateKey;
		this.publicKey = getPublicKey(privateKey);
	}

	/**
	 * Get the user's public key (npub hex format)
	 */
	getPublicKey(): string {
		return this.publicKey;
	}

	/**
	 * Connect to relays
	 */
	connect(relayUrls: string[]): void {
		if (this.pool) {
			this.pool.close();
		}
		this.pool = createRelayPool(relayUrls);
	}

	/**
	 * Disconnect from relays
	 */
	disconnect(): void {
		if (this.pool) {
			this.pool.close();
			this.pool = null;
		}
	}

	/**
	 * Check if connected to relays
	 */
	isConnected(): boolean {
		return this.pool !== null;
	}

	/**
	 * Wrap secrets into a Gift Wrap event
	 */
	wrapSecrets(secrets: SecretBundle, dTag: string): GiftWrapResult {
		return wrapSecretsToEvent(secrets, this.privateKey, dTag);
	}

	/**
	 * Unwrap a Gift Wrap event to retrieve secrets
	 */
	unwrapSecrets(event: NostrEvent): SecretBundle {
		return unwrapSecretsFromEvent(event, this.privateKey);
	}

	/**
	 * Unwrap a Gift Wrap event with full metadata
	 */
	unwrapWithMetadata(event: NostrEvent): UnwrapResult {
		return unwrapGiftWrap(event, this.privateKey);
	}

	/**
	 * Fetch and unwrap all Gift Wrap events from relays.
	 * Returns a map of d-tag to the latest secrets for that d-tag.
	 */
	async fetchAllSecrets(): Promise<Map<string, SecretBundle>> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const filter = filterGiftWraps(this.publicKey);
		const giftWraps = await this.pool.query(filter);

		// Unwrap all events and track latest by d-tag
		const latestByDTag = new Map<string, SecretEntry>();

		for (const gw of giftWraps) {
			try {
				const result = unwrapGiftWrap(gw, this.privateKey);

				if (!result.dTag) {
					continue; // Skip events without d-tag
				}

				const existing = latestByDTag.get(result.dTag);
				if (!existing || result.createdAt > existing.createdAt) {
					latestByDTag.set(result.dTag, {
						secrets: result.secrets,
						dTag: result.dTag,
						createdAt: result.createdAt,
						eventId: gw.id,
					});
				}
			} catch {
				// Skip events that fail to decrypt (not for us)
			}
		}

		// Convert to Map<string, SecretBundle>
		const secretsMap = new Map<string, SecretBundle>();
		for (const [dTag, entry] of latestByDTag) {
			secretsMap.set(dTag, entry.secrets);
		}

		return secretsMap;
	}

	/**
	 * List all projects (unique project IDs from d-tags)
	 */
	async listProjects(): Promise<string[]> {
		const allSecrets = await this.fetchAllSecrets();
		const projects = new Set<string>();

		for (const dTag of allSecrets.keys()) {
			const parsed = parseDTag(dTag);
			if (parsed) {
				projects.add(parsed.projectId);
			}
		}

		return Array.from(projects);
	}

	/**
	 * List all environments for a project
	 */
	async listEnvironments(projectId: string): Promise<string[]> {
		const allSecrets = await this.fetchAllSecrets();
		const environments: string[] = [];

		for (const dTag of allSecrets.keys()) {
			const parsed = parseDTag(dTag);
			if (parsed && parsed.projectId === projectId) {
				environments.push(parsed.environment);
			}
		}

		return environments;
	}

	/**
	 * Fetch secrets for a specific project/environment
	 */
	async fetchSecrets(projectId: string, environment: string): Promise<SecretBundle | null> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const targetDTag = createDTag(projectId, environment);
		const filter = filterGiftWraps(this.publicKey);
		const giftWraps = await this.pool.query(filter);

		// Find the latest event with matching d-tag
		let latestSecrets: SecretBundle | null = null;
		let latestTimestamp = 0;

		for (const gw of giftWraps) {
			try {
				const result = unwrapGiftWrap(gw, this.privateKey);

				// Only consider events with matching d-tag
				if (result.dTag !== targetDTag) {
					continue;
				}

				if (result.createdAt > latestTimestamp) {
					latestTimestamp = result.createdAt;
					latestSecrets = result.secrets;
				}
			} catch {
				// Skip events that fail to decrypt
			}
		}

		return latestSecrets;
	}

	/**
	 * Publish secrets to relays
	 */
	async publishSecrets(
		projectId: string,
		environment: string,
		secrets: SecretBundle,
	): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const dTag = createDTag(projectId, environment);
		const { event } = this.wrapSecrets(secrets, dTag);

		await this.pool.publish(event);

		return event;
	}

	/**
	 * Delete secrets by publishing a tombstone (empty bundle)
	 */
	async deleteSecrets(projectId: string, environment: string): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const dTag = createDTag(projectId, environment);
		const { event } = createTombstone(this.privateKey, dTag);

		await this.pool.publish(event);

		return event;
	}

	/**
	 * Create a NIP-09 deletion request for specific events
	 */
	async requestDeletion(eventIds: string[], reason?: string): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const deletion = createDeletionEvent(eventIds, this.privateKey, reason);
		await this.pool.publish(deletion);

		return deletion;
	}
}

/**
 * Inject secrets into an environment object.
 * Complex values (objects, arrays) are JSON.stringified.
 *
 * @param baseEnv - The base environment (e.g., process.env)
 * @param secrets - The secrets to inject
 * @returns New environment object with secrets injected
 */
export function injectSecrets(
	baseEnv: Record<string, string | undefined>,
	secrets: SecretBundle,
): Record<string, string> {
	const result: Record<string, string> = {};

	// Copy base environment
	for (const [key, value] of Object.entries(baseEnv)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}

	// Inject secrets, converting to strings as needed
	for (const [key, value] of Object.entries(secrets)) {
		if (typeof value === 'string') {
			result[key] = value;
		} else if (typeof value === 'number' || typeof value === 'boolean') {
			result[key] = String(value);
		} else if (typeof value === 'object') {
			result[key] = JSON.stringify(value);
		}
	}

	return result;
}

/**
 * Merge two secret bundles, with overlay taking precedence.
 */
export function mergeSecrets(base: SecretBundle, overlay: SecretBundle): SecretBundle {
	return { ...base, ...overlay };
}

/**
 * Extract unique project IDs from a list of d-tags.
 */
export function extractProjects(dTags: string[]): string[] {
	const projects = new Set<string>();

	for (const dTag of dTags) {
		const parsed = parseDTag(dTag);
		if (parsed) {
			projects.add(parsed.projectId);
		}
	}

	return Array.from(projects);
}

/**
 * Extract environments for a specific project from d-tags.
 */
export function extractEnvironments(dTags: string[], projectId: string): string[] {
	const environments: string[] = [];

	for (const dTag of dTags) {
		const parsed = parseDTag(dTag);
		if (parsed && parsed.projectId === projectId) {
			environments.push(parsed.environment);
		}
	}

	return environments;
}
