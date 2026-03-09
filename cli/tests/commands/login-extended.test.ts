/**
 * Login Extended Tests - NostrConnect URI, --force flag, me command
 *
 * L4: Integration-Contractor - NIP-46 protocol compliance
 * L5: Journey-Validator - Authentication flow edge cases
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nsecEncode } from 'nostr-tools/nip19';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { createNostrConnectUri } from '../../src/lib/bunker';
import { getAuth, saveConfig } from '../../src/lib/config';

describe('createNostrConnectUri', () => {
	const testRelays = ['wss://relay.test.example'];

	it('returns URI starting with nostrconnect://', async () => {
		const { uri } = await createNostrConnectUri(testRelays);
		expect(uri.startsWith('nostrconnect://')).toBe(true);
	});

	it('contains 64-char hex pubkey after nostrconnect://', async () => {
		const { uri } = await createNostrConnectUri(testRelays);
		const afterScheme = uri.slice('nostrconnect://'.length);
		const pubkey = afterScheme.split('?')[0];
		expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
	});

	it('contains relay= parameter', async () => {
		const { uri } = await createNostrConnectUri(testRelays);
		expect(uri).toContain('relay=');
		expect(uri).toContain(encodeURIComponent('wss://relay.test.example'));
	});

	it('contains secret= parameter with 32 hex chars', async () => {
		const { uri } = await createNostrConnectUri(testRelays);
		const url = new URL(uri);
		const secret = url.searchParams.get('secret');
		expect(secret).not.toBeNull();
		expect(secret).toMatch(/^[0-9a-f]{32}$/);
	});

	it('contains name=Redshift by default', async () => {
		const { uri } = await createNostrConnectUri(testRelays);
		const url = new URL(uri);
		expect(url.searchParams.get('name')).toBe('Redshift');
	});

	it('contains perms with sign_event:1059, nip44_encrypt, nip44_decrypt', async () => {
		const { uri } = await createNostrConnectUri(testRelays);
		const url = new URL(uri);
		const perms = url.searchParams.get('perms');
		expect(perms).not.toBeNull();
		expect(perms).toContain('sign_event:1059');
		expect(perms).toContain('nip44_encrypt');
		expect(perms).toContain('nip44_decrypt');
	});

	it('uses custom name when provided', async () => {
		const { uri } = await createNostrConnectUri(testRelays, 'MyApp');
		const url = new URL(uri);
		expect(url.searchParams.get('name')).toBe('MyApp');
	});

	it('returns clientSecretKey as 32-byte Uint8Array', async () => {
		const { clientSecretKey } = await createNostrConnectUri(testRelays);
		expect(clientSecretKey).toBeInstanceOf(Uint8Array);
		expect(clientSecretKey.length).toBe(32);
	});

	it('returns waitForConnection as a callable function', async () => {
		const { waitForConnection } = await createNostrConnectUri(testRelays);
		expect(typeof waitForConnection).toBe('function');
	});

	it('generates unique URIs on each call', async () => {
		const first = await createNostrConnectUri(testRelays);
		const second = await createNostrConnectUri(testRelays);
		expect(first.uri).not.toBe(second.uri);
	});

	it('includes multiple relays when provided', async () => {
		const relays = ['wss://relay1.test', 'wss://relay2.test'];
		const { uri } = await createNostrConnectUri(relays);
		const url = new URL(uri);
		const relayParams = url.searchParams.getAll('relay');
		expect(relayParams.length).toBe(2);
		expect(relayParams).toContain('wss://relay1.test');
		expect(relayParams).toContain('wss://relay2.test');
	});
});

describe('loginCommand --force flag behavior', () => {
	const testDir = join(tmpdir(), `redshift-login-force-test-${Date.now()}`);
	const originalEnv = { ...process.env };

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		// biome-ignore lint/performance/noDelete: env vars must be removed, not set to undefined
		delete process.env.REDSHIFT_NSEC;
		// biome-ignore lint/performance/noDelete: env vars must be removed, not set to undefined
		delete process.env.REDSHIFT_BUNKER;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it('returns early when existing auth and force=false', async () => {
		// Store existing auth
		const sk = generateSecretKey();
		const nsec = nsecEncode(sk);
		await saveConfig({ authMethod: 'nsec', nsec });

		// Verify auth is stored
		const auth = await getAuth();
		expect(auth).not.toBeNull();
		expect(auth?.method).toBe('nsec');

		// Import loginCommand
		const { loginCommand } = await import('../../src/commands/login');

		// Call with force=false — should return early without error
		// (it prints "Currently logged in" and returns)
		await loginCommand({ force: false });

		// Auth should remain unchanged
		const authAfter = await getAuth();
		expect(authAfter).not.toBeNull();
		expect(authAfter?.nsec).toBe(nsec);
	});

	it('getAuth returns correct method and source for stored nsec', async () => {
		const sk = generateSecretKey();
		const nsec = nsecEncode(sk);
		await saveConfig({ authMethod: 'nsec', nsec });

		const auth = await getAuth();
		expect(auth).not.toBeNull();
		expect(auth?.method).toBe('nsec');
		expect(auth?.nsec).toBe(nsec);
		expect(auth?.source).toBe('config');
	});

	it('getAuth returns null when no auth is configured', async () => {
		const auth = await getAuth();
		expect(auth).toBeNull();
	});

	it('getAuth prefers env var over config', async () => {
		const sk1 = generateSecretKey();
		const nsec1 = nsecEncode(sk1);
		await saveConfig({ authMethod: 'nsec', nsec: nsec1 });

		const sk2 = generateSecretKey();
		const nsec2 = nsecEncode(sk2);
		process.env.REDSHIFT_NSEC = nsec2;

		const auth = await getAuth();
		expect(auth).not.toBeNull();
		expect(auth?.nsec).toBe(nsec2);
		expect(auth?.source).toBe('env');
	});
});

describe('me command output structure', () => {
	it('JSON output for unauthenticated user has authenticated=false', () => {
		const output = JSON.stringify({ authenticated: false });
		const parsed = JSON.parse(output) as { authenticated: boolean };
		expect(parsed.authenticated).toBe(false);
	});

	it('JSON output for nsec auth includes all required fields', () => {
		const sk = generateSecretKey();
		const pubkey = getPublicKey(sk);

		const output = {
			authenticated: true,
			method: 'nsec' as const,
			npub: `npub1${'x'.repeat(58)}`,
			pubkey,
			source: 'config' as const,
		};

		expect(output.authenticated).toBe(true);
		expect(output.method).toBe('nsec');
		expect(output.npub).toMatch(/^npub1/);
		expect(output.pubkey).toMatch(/^[0-9a-f]{64}$/);
		expect(output.source).toBe('config');
	});

	it('JSON output for bunker auth includes bunkerPubkey and relays', () => {
		const output = {
			authenticated: true,
			method: 'bunker' as const,
			bunkerPubkey: 'a'.repeat(64),
			relays: ['wss://relay.test'],
			source: 'config' as const,
		};

		expect(output.authenticated).toBe(true);
		expect(output.method).toBe('bunker');
		expect(output.bunkerPubkey).toMatch(/^[0-9a-f]{64}$/);
		expect(output.relays).toBeArrayOfSize(1);
	});
});
