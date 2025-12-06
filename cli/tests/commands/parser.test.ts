/**
 * CLI Parser Tests - TDD Phase 2
 *
 * L2: Function-Author - Tests written before implementation
 * L4: Integration-Contractor - Doppler-compatible CLI interface
 */

import { describe, expect, it } from 'bun:test';
import { formatSecrets, parseCommand } from '../../src/commands/parser';
import { injectSecrets } from '../../src/lib/secret-manager';
import type { SecretBundle } from '../../src/lib/types';

describe('parseCommand', () => {
	describe('run command', () => {
		it('parses run command with args after --', () => {
			const result = parseCommand(['run', '--', 'echo', 'hello']);

			expect(result.command).toBe('run');
			expect(result.args).toEqual(['echo', 'hello']);
		});

		it('parses run command with flags before --', () => {
			const result = parseCommand(['run', '--env', 'production', '--', 'npm', 'start']);

			expect(result.command).toBe('run');
			expect(result.args).toEqual(['npm', 'start']);
			expect(result.flags.env).toBe('production');
		});

		it('parses run command with fallback flag', () => {
			const result = parseCommand(['run', '--fallback', '--', 'node', 'app.js']);

			expect(result.command).toBe('run');
			expect(result.flags.fallback).toBe(true);
		});

		it('handles run without -- separator', () => {
			const result = parseCommand(['run']);

			expect(result.command).toBe('run');
			expect(result.args).toEqual([]);
		});
	});

	describe('secrets command', () => {
		it('parses secrets set command', () => {
			const result = parseCommand(['secrets', 'set', 'API_KEY', 'sk_test_123']);

			expect(result.command).toBe('secrets');
			expect(result.args).toEqual(['set', 'API_KEY', 'sk_test_123']);
		});

		it('parses secrets set with --json flag', () => {
			const result = parseCommand(['secrets', 'set', 'CONFIG', '{"a":1}', '--json']);

			expect(result.command).toBe('secrets');
			expect(result.args[0]).toBe('set');
			expect(result.flags.json).toBe(true);
		});

		it('parses secrets list (default)', () => {
			const result = parseCommand(['secrets']);

			expect(result.command).toBe('secrets');
			expect(result.args).toEqual(['list']);
		});

		it('parses secrets with format flag', () => {
			const result = parseCommand(['secrets', 'list', '--format', 'json']);

			expect(result.command).toBe('secrets');
			expect(result.flags.format).toBe('json');
		});
	});

	describe('serve command', () => {
		it('parses serve with default options', () => {
			const result = parseCommand(['serve']);

			expect(result.command).toBe('serve');
			expect(result.args).toEqual([]);
		});

		it('parses serve with port option', () => {
			const result = parseCommand(['serve', '--port', '8080']);

			expect(result.command).toBe('serve');
			expect(result.flags.port).toBe('8080');
		});

		it('parses serve with short flags', () => {
			const result = parseCommand(['serve', '-p', '3000', '-o']);

			expect(result.command).toBe('serve');
			expect(result.flags.port).toBe('3000');
			expect(result.flags.open).toBe(true);
		});
	});

	describe('login command', () => {
		it('parses login with nsec option', () => {
			const result = parseCommand(['login', '--nsec', 'nsec1...']);

			expect(result.command).toBe('login');
			expect(result.flags.nsec).toBe('nsec1...');
		});

		it('parses login with bunker flag', () => {
			const result = parseCommand(['login', '--bunker', 'bunker://pubkey?relay=wss://test']);

			expect(result.command).toBe('login');
			expect(result.flags.bunker).toBe('bunker://pubkey?relay=wss://test');
		});

		it('parses login with connect flag', () => {
			const result = parseCommand(['login', '--connect']);

			expect(result.command).toBe('login');
			expect(result.flags.connect).toBe(true);
		});

		it('parses login with force flag', () => {
			const result = parseCommand(['login', '--force']);

			expect(result.command).toBe('login');
			expect(result.flags.force).toBe(true);
		});

		it('parses logout command', () => {
			const result = parseCommand(['logout']);

			expect(result.command).toBe('logout');
		});
	});

	describe('setup command', () => {
		it('parses setup with project option', () => {
			const result = parseCommand(['setup', '--project', 'myproj']);

			expect(result.command).toBe('setup');
			expect(result.flags.project).toBe('myproj');
		});

		it('parses setup with --yes flag', () => {
			const result = parseCommand(['setup', '-y']);

			expect(result.command).toBe('setup');
			expect(result.flags.yes).toBe(true);
		});
	});

	describe('help and version', () => {
		it('defaults to help with no args', () => {
			const result = parseCommand([]);

			expect(result.command).toBe('help');
		});

		it('parses help command', () => {
			const result = parseCommand(['help']);

			expect(result.command).toBe('help');
		});

		it('parses version command', () => {
			const result = parseCommand(['version']);

			expect(result.command).toBe('version');
		});
	});
});

describe('injectSecrets', () => {
	it('merges secrets into environment', () => {
		const env: NodeJS.ProcessEnv = { PATH: '/usr/bin', HOME: '/home/user' };
		const secrets: SecretBundle = { API_KEY: 'secret123' };

		const result = injectSecrets(env, secrets);

		expect(result.PATH).toBe('/usr/bin');
		expect(result.HOME).toBe('/home/user');
		expect(result.API_KEY).toBe('secret123');
	});

	it('converts numbers to strings', () => {
		const env: NodeJS.ProcessEnv = {};
		const secrets: SecretBundle = { PORT: 3000, TIMEOUT: 5000 };

		const result = injectSecrets(env, secrets);

		expect(result.PORT).toBe('3000');
		expect(result.TIMEOUT).toBe('5000');
	});

	it('converts booleans to strings', () => {
		const env: NodeJS.ProcessEnv = {};
		const secrets: SecretBundle = { DEBUG: true, VERBOSE: false };

		const result = injectSecrets(env, secrets);

		expect(result.DEBUG).toBe('true');
		expect(result.VERBOSE).toBe('false');
	});

	it('JSON stringifies complex objects', () => {
		const env: NodeJS.ProcessEnv = {};
		const secrets: SecretBundle = {
			CONFIG: { nested: true, values: [1, 2, 3] },
		};

		const result = injectSecrets(env, secrets);

		expect(result.CONFIG).toBe('{"nested":true,"values":[1,2,3]}');
	});

	it('JSON stringifies arrays', () => {
		const env: NodeJS.ProcessEnv = {};
		const secrets: SecretBundle = {
			ALLOWED_HOSTS: ['localhost', '127.0.0.1'],
		};

		const result = injectSecrets(env, secrets);

		expect(result.ALLOWED_HOSTS).toBe('["localhost","127.0.0.1"]');
	});

	it('does not modify original environment', () => {
		const env: NodeJS.ProcessEnv = { EXISTING: 'value' };
		const secrets: SecretBundle = { NEW: 'secret' };

		const result = injectSecrets(env, secrets);

		expect(env.NEW).toBeUndefined();
		expect(result.NEW).toBe('secret');
	});

	it('overwrites existing env vars with secrets', () => {
		const env: NodeJS.ProcessEnv = { API_KEY: 'old_value' };
		const secrets: SecretBundle = { API_KEY: 'new_value' };

		const result = injectSecrets(env, secrets);

		expect(result.API_KEY).toBe('new_value');
	});
});

describe('formatSecrets', () => {
	it('masks values by default', () => {
		const secrets: SecretBundle = {
			API_KEY: 'sk_live_1234567890',
			SHORT: 'ab',
		};

		const result = formatSecrets(secrets);

		expect(result).toContain('API_KEY=sk******');
		expect(result).toContain('SHORT=****');
	});

	it('shows values when requested', () => {
		const secrets: SecretBundle = {
			API_KEY: 'sk_live_123',
		};

		const result = formatSecrets(secrets, true);

		expect(result).toBe('API_KEY=sk_live_123');
	});

	it('handles complex values', () => {
		const secrets: SecretBundle = {
			CONFIG: { key: 'value' },
		};

		const result = formatSecrets(secrets, true);

		expect(result).toBe('CONFIG={"key":"value"}');
	});
});
