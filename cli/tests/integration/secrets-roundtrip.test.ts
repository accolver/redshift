/**
 * Integration Tests - Secrets Roundtrip via Mock Relay
 *
 * End-to-end tests for SecretManager using an in-process mock NIP-01 relay.
 * No external relay process required.
 *
 * Run: bun test cli/tests/integration/secrets-roundtrip.test.ts
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { generateSecretKey } from 'nostr-tools/pure';
import { SecretManager } from '../../src/lib/secret-manager';
import { startMockRelay, stopMockRelay } from './mock-relay';
import type { MockRelay } from './mock-relay';

let relay: MockRelay;
let testPrivateKey: Uint8Array;

/** Small delay to let nostr-tools SimplePool process WebSocket messages */
const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
	relay = await startMockRelay();
	testPrivateKey = generateSecretKey();
});

afterAll(async () => {
	await stopMockRelay(relay.server);
});

/** Create a fresh SecretManager connected to the mock relay */
function createManager(privateKey: Uint8Array = testPrivateKey) {
	const manager = new SecretManager(privateKey);
	manager.connect([relay.url]);
	return manager;
}

describe('Secrets Roundtrip via Mock Relay', () => {
	afterEach(() => {
		// Clear relay state between tests for isolation
		relay.clear();
	});

	it('set and get a single secret', async () => {
		const manager = createManager();
		try {
			const secrets = { API_KEY: 'test-value' };

			const event = await manager.publishSecrets('myapp', 'dev', secrets);
			expect(event.id).toBeDefined();
			expect(event.kind).toBe(1059); // Gift Wrap

			await settle();

			const fetched = await manager.fetchSecrets('myapp', 'dev');
			expect(fetched).not.toBeNull();
			expect(fetched?.API_KEY).toBe('test-value');
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('set multiple secrets in one bundle', async () => {
		const manager = createManager();
		try {
			const secrets = { A: '1', B: '2', C: '3' };

			await manager.publishSecrets('multi', 'dev', secrets);
			await settle();

			const fetched = await manager.fetchSecrets('multi', 'dev');
			expect(fetched).not.toBeNull();
			expect(fetched?.A).toBe('1');
			expect(fetched?.B).toBe('2');
			expect(fetched?.C).toBe('3');
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('update a secret (newer timestamp wins)', async () => {
		const manager = createManager();
		try {
			// Publish initial bundle
			await manager.publishSecrets('update-test', 'dev', { VERSION: '1.0.0' });
			await settle();

			// Verify initial
			let fetched = await manager.fetchSecrets('update-test', 'dev');
			expect(fetched?.VERSION).toBe('1.0.0');

			// Wait to ensure different created_at timestamp
			await settle(1100);

			// Publish updated bundle
			await manager.publishSecrets('update-test', 'dev', {
				VERSION: '2.0.0',
				NEW_KEY: 'added',
			});
			await settle();

			// Fetch should return latest
			fetched = await manager.fetchSecrets('update-test', 'dev');
			expect(fetched?.VERSION).toBe('2.0.0');
			expect(fetched?.NEW_KEY).toBe('added');
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('delete a secret by publishing bundle without it', async () => {
		const manager = createManager();
		try {
			// Publish bundle with A and B
			await manager.publishSecrets('delete-test', 'dev', { A: '1', B: '2' });
			await settle();

			let fetched = await manager.fetchSecrets('delete-test', 'dev');
			expect(fetched?.A).toBe('1');
			expect(fetched?.B).toBe('2');

			// Wait to ensure different timestamp
			await settle(1100);

			// Publish bundle with only A (B removed)
			await manager.publishSecrets('delete-test', 'dev', { A: '1' });
			await settle();

			fetched = await manager.fetchSecrets('delete-test', 'dev');
			expect(fetched?.A).toBe('1');
			expect(fetched?.B).toBeUndefined();
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('project isolation: different projects do not leak secrets', async () => {
		const manager = createManager();
		try {
			await manager.publishSecrets('project-a', 'dev', { KEY: 'value-a' });
			await manager.publishSecrets('project-b', 'dev', { KEY: 'value-b' });
			await settle();

			const fetchedA = await manager.fetchSecrets('project-a', 'dev');
			expect(fetchedA).not.toBeNull();
			expect(fetchedA?.KEY).toBe('value-a');

			const fetchedB = await manager.fetchSecrets('project-b', 'dev');
			expect(fetchedB).not.toBeNull();
			expect(fetchedB?.KEY).toBe('value-b');
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('environment isolation: different environments do not leak secrets', async () => {
		const manager = createManager();
		try {
			await manager.publishSecrets('myapp', 'dev', { DB: 'localhost' });
			await manager.publishSecrets('myapp', 'staging', { DB: 'staging-db.example.com' });
			await settle();

			const fetchedDev = await manager.fetchSecrets('myapp', 'dev');
			expect(fetchedDev).not.toBeNull();
			expect(fetchedDev?.DB).toBe('localhost');

			const fetchedStaging = await manager.fetchSecrets('myapp', 'staging');
			expect(fetchedStaging).not.toBeNull();
			expect(fetchedStaging?.DB).toBe('staging-db.example.com');
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('empty project returns null', async () => {
		const manager = createManager();
		try {
			await settle();

			const fetched = await manager.fetchSecrets('nonexistent', 'dev');
			expect(fetched).toBeNull();
		} finally {
			manager.disconnect();
		}
	}, 15000);

	it('multiple publish-fetch cycles work (no stale data)', async () => {
		const manager = createManager();
		try {
			// Cycle 1
			await manager.publishSecrets('cycle-test', 'dev', { ROUND: '1' });
			await settle();
			let fetched = await manager.fetchSecrets('cycle-test', 'dev');
			expect(fetched?.ROUND).toBe('1');

			// Wait for distinct timestamp
			await settle(1100);

			// Cycle 2
			await manager.publishSecrets('cycle-test', 'dev', { ROUND: '2' });
			await settle();
			fetched = await manager.fetchSecrets('cycle-test', 'dev');
			expect(fetched?.ROUND).toBe('2');

			// Wait for distinct timestamp
			await settle(1100);

			// Cycle 3
			await manager.publishSecrets('cycle-test', 'dev', { ROUND: '3' });
			await settle();
			fetched = await manager.fetchSecrets('cycle-test', 'dev');
			expect(fetched?.ROUND).toBe('3');
		} finally {
			manager.disconnect();
		}
	}, 30000);
});
