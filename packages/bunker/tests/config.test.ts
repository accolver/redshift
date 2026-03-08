/**
 * Configuration loader tests for @redshift/bunker
 */

import { describe, expect, it } from 'bun:test';
import { ConfigError, loadConfig, parseDuration } from '../src/index';

// Valid test values
const VALID_KEY = 'a'.repeat(64);
const VALID_RELAY = 'wss://relay.example.com';
const VALID_PUBKEY = 'b'.repeat(64);

/** Helper to create a minimal valid env */
function validEnv(overrides: Record<string, string | undefined> = {}) {
	return {
		MASTER_KEY: VALID_KEY,
		NOSTR_RELAYS: VALID_RELAY,
		...overrides,
	};
}

describe('parseDuration', () => {
	it('parses seconds', () => {
		expect(parseDuration('30s')).toBe(30);
	});

	it('parses minutes', () => {
		expect(parseDuration('5m')).toBe(300);
	});

	it('parses hours', () => {
		expect(parseDuration('24h')).toBe(86400);
	});

	it('parses days', () => {
		expect(parseDuration('7d')).toBe(604800);
	});

	it('defaults to seconds when no unit', () => {
		expect(parseDuration('3600')).toBe(3600);
	});

	it('trims whitespace', () => {
		expect(parseDuration('  24h  ')).toBe(86400);
	});

	it('throws on invalid format', () => {
		expect(() => parseDuration('abc')).toThrow(ConfigError);
	});

	it('throws on negative numbers', () => {
		expect(() => parseDuration('-5h')).toThrow(ConfigError);
	});

	it('throws on empty string', () => {
		expect(() => parseDuration('')).toThrow(ConfigError);
	});

	it('throws on invalid unit', () => {
		expect(() => parseDuration('5x')).toThrow(ConfigError);
	});
});

describe('loadConfig', () => {
	describe('required fields', () => {
		it('loads valid minimal config', () => {
			const config = loadConfig(validEnv());
			expect(config.masterKey).toBe(VALID_KEY);
			expect(config.nostrRelays).toEqual([VALID_RELAY]);
		});

		it('throws when MASTER_KEY is missing', () => {
			expect(() => loadConfig({ NOSTR_RELAYS: VALID_RELAY })).toThrow(ConfigError);
			expect(() => loadConfig({ NOSTR_RELAYS: VALID_RELAY })).toThrow('MASTER_KEY is required');
		});

		it('throws when MASTER_KEY is invalid hex', () => {
			expect(() => loadConfig(validEnv({ MASTER_KEY: 'not-hex' }))).toThrow(ConfigError);
		});

		it('throws when MASTER_KEY is wrong length', () => {
			expect(() => loadConfig(validEnv({ MASTER_KEY: 'aa' }))).toThrow(ConfigError);
		});

		it('throws when NOSTR_RELAYS is missing', () => {
			expect(() => loadConfig({ MASTER_KEY: VALID_KEY })).toThrow(ConfigError);
			expect(() => loadConfig({ MASTER_KEY: VALID_KEY })).toThrow('NOSTR_RELAYS is required');
		});

		it('throws when NOSTR_RELAYS has invalid URLs', () => {
			expect(() => loadConfig(validEnv({ NOSTR_RELAYS: 'http://not-ws.com' }))).toThrow(
				'Invalid relay URLs',
			);
		});

		it('throws when NOSTR_RELAYS is empty', () => {
			expect(() => loadConfig(validEnv({ NOSTR_RELAYS: '' }))).toThrow(ConfigError);
		});
	});

	describe('defaults', () => {
		it('uses default host', () => {
			const config = loadConfig(validEnv());
			expect(config.host).toBe('127.0.0.1');
		});

		it('uses default port', () => {
			const config = loadConfig(validEnv());
			expect(config.port).toBe(3333);
		});

		it('uses default database URL', () => {
			const config = loadConfig(validEnv());
			expect(config.databaseUrl).toBe('bunker.db');
		});

		it('uses default session timeout (24h)', () => {
			const config = loadConfig(validEnv());
			expect(config.sessionTimeout).toBe(86400);
		});

		it('defaults OAuth to null', () => {
			const config = loadConfig(validEnv());
			expect(config.googleClientId).toBeNull();
			expect(config.googleClientSecret).toBeNull();
			expect(config.githubClientId).toBeNull();
			expect(config.githubClientSecret).toBeNull();
		});

		it('defaults adminPubkeys to empty array', () => {
			const config = loadConfig(validEnv());
			expect(config.adminPubkeys).toEqual([]);
		});

		it('defaults publicUrl to null', () => {
			const config = loadConfig(validEnv());
			expect(config.publicUrl).toBeNull();
		});
	});

	describe('optional overrides', () => {
		it('accepts custom HOST', () => {
			const config = loadConfig(validEnv({ HOST: '0.0.0.0' }));
			expect(config.host).toBe('0.0.0.0');
		});

		it('accepts custom PORT', () => {
			const config = loadConfig(validEnv({ PORT: '8080' }));
			expect(config.port).toBe(8080);
		});

		it('rejects invalid PORT', () => {
			expect(() => loadConfig(validEnv({ PORT: 'abc' }))).toThrow(ConfigError);
		});

		it('rejects PORT out of range', () => {
			expect(() => loadConfig(validEnv({ PORT: '99999' }))).toThrow(ConfigError);
		});

		it('rejects PORT of 0', () => {
			expect(() => loadConfig(validEnv({ PORT: '0' }))).toThrow(ConfigError);
		});

		it('accepts custom DATABASE_URL', () => {
			const config = loadConfig(validEnv({ DATABASE_URL: '/tmp/test.db' }));
			expect(config.databaseUrl).toBe('/tmp/test.db');
		});

		it('accepts custom SESSION_TIMEOUT', () => {
			const config = loadConfig(validEnv({ SESSION_TIMEOUT: '1h' }));
			expect(config.sessionTimeout).toBe(3600);
		});

		it('rejects invalid SESSION_TIMEOUT', () => {
			expect(() => loadConfig(validEnv({ SESSION_TIMEOUT: 'forever' }))).toThrow(ConfigError);
		});

		it('accepts PUBLIC_URL', () => {
			const config = loadConfig(validEnv({ PUBLIC_URL: 'https://bunker.example.com' }));
			expect(config.publicUrl).toBe('https://bunker.example.com');
		});
	});

	describe('relay parsing', () => {
		it('parses multiple relays', () => {
			const config = loadConfig(
				validEnv({ NOSTR_RELAYS: 'wss://relay1.com,wss://relay2.com,wss://relay3.com' }),
			);
			expect(config.nostrRelays).toEqual([
				'wss://relay1.com',
				'wss://relay2.com',
				'wss://relay3.com',
			]);
		});

		it('trims whitespace around relay URLs', () => {
			const config = loadConfig(
				validEnv({ NOSTR_RELAYS: '  wss://relay1.com , wss://relay2.com  ' }),
			);
			expect(config.nostrRelays).toEqual(['wss://relay1.com', 'wss://relay2.com']);
		});

		it('accepts ws:// relays', () => {
			const config = loadConfig(validEnv({ NOSTR_RELAYS: 'ws://localhost:7777' }));
			expect(config.nostrRelays).toEqual(['ws://localhost:7777']);
		});
	});

	describe('OAuth validation', () => {
		it('accepts both Google OAuth fields', () => {
			const config = loadConfig(
				validEnv({
					GOOGLE_CLIENT_ID: 'google-id',
					GOOGLE_CLIENT_SECRET: 'google-secret',
				}),
			);
			expect(config.googleClientId).toBe('google-id');
			expect(config.googleClientSecret).toBe('google-secret');
		});

		it('rejects Google OAuth with only ID', () => {
			expect(() => loadConfig(validEnv({ GOOGLE_CLIENT_ID: 'google-id' }))).toThrow(
				'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set',
			);
		});

		it('rejects Google OAuth with only secret', () => {
			expect(() => loadConfig(validEnv({ GOOGLE_CLIENT_SECRET: 'google-secret' }))).toThrow(
				'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set',
			);
		});

		it('accepts both GitHub OAuth fields', () => {
			const config = loadConfig(
				validEnv({
					GITHUB_CLIENT_ID: 'github-id',
					GITHUB_CLIENT_SECRET: 'github-secret',
				}),
			);
			expect(config.githubClientId).toBe('github-id');
			expect(config.githubClientSecret).toBe('github-secret');
		});

		it('rejects GitHub OAuth with only ID', () => {
			expect(() => loadConfig(validEnv({ GITHUB_CLIENT_ID: 'github-id' }))).toThrow(
				'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must both be set',
			);
		});
	});

	describe('admin pubkeys', () => {
		it('parses single admin pubkey', () => {
			const config = loadConfig(validEnv({ ADMIN_PUBKEYS: VALID_PUBKEY }));
			expect(config.adminPubkeys).toEqual([VALID_PUBKEY]);
		});

		it('parses multiple admin pubkeys', () => {
			const key2 = 'c'.repeat(64);
			const config = loadConfig(validEnv({ ADMIN_PUBKEYS: `${VALID_PUBKEY},${key2}` }));
			expect(config.adminPubkeys).toEqual([VALID_PUBKEY, key2]);
		});

		it('trims whitespace around pubkeys', () => {
			const config = loadConfig(validEnv({ ADMIN_PUBKEYS: `  ${VALID_PUBKEY}  ` }));
			expect(config.adminPubkeys).toEqual([VALID_PUBKEY]);
		});

		it('rejects invalid pubkeys', () => {
			expect(() => loadConfig(validEnv({ ADMIN_PUBKEYS: 'not-a-pubkey' }))).toThrow(
				'Invalid ADMIN_PUBKEYS',
			);
		});
	});

	describe('error aggregation', () => {
		it('reports multiple errors at once', () => {
			try {
				loadConfig({});
				expect(true).toBe(false); // Should not reach here
			} catch (e) {
				expect(e).toBeInstanceOf(ConfigError);
				const message = (e as ConfigError).message;
				expect(message).toContain('MASTER_KEY is required');
				expect(message).toContain('NOSTR_RELAYS is required');
			}
		});
	});
});
