/**
 * Integration Tests - Real Relay Communication
 *
 * These tests communicate with actual Nostr relays.
 * They are slower and may fail due to network issues.
 *
 * The suite starts an isolated local `nak serve` process by default.
 * Set TEST_RELAYS=public to opt into public relays for manual interoperability checks.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from 'node:net';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { SecretManager } from '../../src/lib/secret-manager';

const USE_PUBLIC_RELAYS = process.env.TEST_RELAYS === 'public';
let testRelays = USE_PUBLIC_RELAYS ? ['wss://relay.damus.io', 'wss://nos.lol'] : [];
let relayProcess: Bun.Subprocess | null = null;

async function getFreePort() {
	return new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') return reject(new Error('No TCP port'));
			server.close(() => resolve(address.port));
		});
	});
}

async function waitForRelay(url: string) {
	for (let attempt = 0; attempt < 50; attempt++) {
		const connected = await new Promise<boolean>((resolve) => {
			const socket = new WebSocket(url);
			const timer = setTimeout(() => resolve(false), 200);
			socket.addEventListener('open', () => {
				clearTimeout(timer);
				socket.close();
				resolve(true);
			});
			socket.addEventListener('error', () => {
				clearTimeout(timer);
				resolve(false);
			});
		});
		if (connected) return;
		await Bun.sleep(100);
	}
	throw new Error('Local nak relay did not start');
}

// Generate ephemeral test keys
const testPrivateKey = generateSecretKey();
const testPublicKey = getPublicKey(testPrivateKey);

// Helper to add delays between relay operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Relay Integration Tests', () => {
	let manager: SecretManager;
	const testProjectId = `test-${Date.now()}`;
	const testEnvironment = 'integration';

	beforeAll(async () => {
		if (!USE_PUBLIC_RELAYS) {
			const port = await getFreePort();
			const relay = `ws://127.0.0.1:${port}`;
			relayProcess = Bun.spawn(
				['nak', 'serve', '--hostname', '127.0.0.1', '--port', String(port)],
				{ stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' },
			);
			testRelays = [relay];
			await waitForRelay(relay);
		}
		manager = new SecretManager(testPrivateKey);
		manager.connect(testRelays);
		console.log(`Testing with pubkey: ${testPublicKey.substring(0, 16)}...`);
		console.log(`Using relays: ${testRelays.join(', ')}`);

		// Give relays time to connect
		await delay(500);
	});

	afterAll(async () => {
		await manager.close();
		if (relayProcess) {
			relayProcess.kill();
			await Promise.race([relayProcess.exited, Bun.sleep(1000)]);
			relayProcess = null;
		}
	});

	it('connects to relays', () => {
		expect(manager.isConnected()).toBe(true);
	});

	it('publishes and fetches secrets', async () => {
		// All values must be strings (environment variables are always strings)
		const secrets = {
			API_KEY: `sk_test_${Date.now()}`,
			DEBUG: 'true',
			PORT: '3000',
		};

		// Publish secrets
		console.log(`Publishing secrets to ${testProjectId}/${testEnvironment}...`);
		const event = await manager.publishSecrets(testProjectId, testEnvironment, secrets);
		expect(event.id).toBeDefined();
		expect(event.kind).toBe(1059); // Gift Wrap

		console.log(`Published event: ${event.id.substring(0, 16)}...`);

		// Wait for relay to process
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		// Fetch secrets back
		console.log('Fetching secrets...');
		const fetched = await manager.fetchSecrets(testProjectId, testEnvironment);

		console.log('Fetched:', fetched);
		expect(fetched).not.toBeNull();
		expect(fetched?.API_KEY).toBe(secrets.API_KEY);
		expect(fetched?.DEBUG).toBe('true');
		expect(fetched?.PORT).toBe('3000');
	}, 30000);

	it('updates secrets (newer timestamp wins)', async () => {
		const updateProject = `update-${Date.now()}`;
		const initialSecrets = { VERSION: '1.0.0' };
		const updatedSecrets = { VERSION: '2.0.0', NEW_KEY: 'added' };

		// Publish initial
		await manager.publishSecrets(updateProject, 'test', initialSecrets);
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		// Verify initial
		let fetched = await manager.fetchSecrets(updateProject, 'test');
		expect(fetched?.VERSION).toBe('1.0.0');

		// Wait a bit to ensure different timestamp
		await delay(1100);

		// Publish update
		await manager.publishSecrets(updateProject, 'test', updatedSecrets);
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		// Fetch should return latest
		fetched = await manager.fetchSecrets(updateProject, 'test');

		expect(fetched?.VERSION).toBe('2.0.0');
		expect(fetched?.NEW_KEY).toBe('added');
	}, 30000);

	it('isolates secrets by d-tag', async () => {
		const projectA = `proj-a-${Date.now()}`;
		const projectB = `proj-b-${Date.now()}`;

		await manager.publishSecrets(projectA, 'dev', { KEY: 'value-a' });
		await manager.publishSecrets(projectB, 'dev', { KEY: 'value-b' });
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		const fetchedA = await manager.fetchSecrets(projectA, 'dev');
		const fetchedB = await manager.fetchSecrets(projectB, 'dev');

		expect(fetchedA?.KEY).toBe('value-a');
		expect(fetchedB?.KEY).toBe('value-b');
	}, 30000);

	it('handles tombstone (logical deletion)', async () => {
		const deleteProject = `delete-test-${Date.now()}`;

		// Publish secrets
		await manager.publishSecrets(deleteProject, 'prod', { SECRET: 'value' });
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		// Verify they exist
		let fetched = await manager.fetchSecrets(deleteProject, 'prod');
		expect(fetched?.SECRET).toBe('value');

		// Wait to ensure different timestamp
		await delay(1100);

		// Delete (publish tombstone)
		await manager.deleteSecrets(deleteProject, 'prod');
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		// Logical tombstones remove the current bundle from selection.
		fetched = await manager.fetchSecrets(deleteProject, 'prod');
		expect(fetched).toBeNull();
	}, 30000);

	it('handles complex nested objects as JSON strings', async () => {
		// Complex objects must be JSON-stringified (env vars are always strings)
		const complexSecrets = {
			FEATURE_FLAGS: JSON.stringify({
				new_ui: true,
				beta_features: ['feature_a', 'feature_b'],
				config: { timeout: 5000, retries: 3 },
			}),
			ALLOWED_ORIGINS: JSON.stringify(['http://localhost:3000', 'https://example.com']),
		};

		const complexProject = `complex-${Date.now()}`;
		await manager.publishSecrets(complexProject, 'test', complexSecrets);
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		const fetched = await manager.fetchSecrets(complexProject, 'test');

		expect(fetched?.FEATURE_FLAGS).toBe(complexSecrets.FEATURE_FLAGS);
		expect(fetched?.ALLOWED_ORIGINS).toBe(complexSecrets.ALLOWED_ORIGINS);
		// Verify we can parse them back
		expect(JSON.parse(fetched?.FEATURE_FLAGS ?? '{}')).toEqual({
			new_ui: true,
			beta_features: ['feature_a', 'feature_b'],
			config: { timeout: 5000, retries: 3 },
		});
	}, 30000);

	it('lists all projects', async () => {
		// Create a few projects
		const listProject1 = `list-${Date.now()}-1`;
		const listProject2 = `list-${Date.now()}-2`;

		await manager.publishSecrets(listProject1, 'dev', { KEY: '1' });
		await manager.publishSecrets(listProject2, 'staging', { KEY: '2' });
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		const projects = await manager.listProjects();
		console.log('Projects found:', projects);

		expect(projects).toContain(listProject1);
		expect(projects).toContain(listProject2);
	}, 30000);

	it('lists environments for a project', async () => {
		const envProject = `env-${Date.now()}`;

		await manager.publishSecrets(envProject, 'dev', { KEY: '1' });
		await manager.publishSecrets(envProject, 'staging', { KEY: '2' });
		await manager.publishSecrets(envProject, 'prod', { KEY: '3' });
		await delay(USE_PUBLIC_RELAYS ? 2000 : 500);

		const environments = await manager.listEnvironments(envProject);
		console.log('Environments found:', environments);

		expect(environments).toContain('dev');
		expect(environments).toContain('staging');
		expect(environments).toContain('prod');
	}, 30000);

	it('throws when not connected', async () => {
		const disconnectedManager = new SecretManager(testPrivateKey);
		await expect(disconnectedManager.fetchSecrets('proj', 'env')).rejects.toThrow(
			'Not connected to relays',
		);
	});

	it('returns null for non-existent project', async () => {
		const fetched = await manager.fetchSecrets(`nonexistent-${Date.now()}`, 'env');
		expect(fetched).toBeNull();
	}, 15000);
});
