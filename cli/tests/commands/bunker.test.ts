/**
 * Bunker command tests.
 *
 * L5: Journey-Validator - local bunker prototype workflow
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSecretKey } from 'nostr-tools/pure';
import { bunkerCommand } from '../../src/commands/bunker';
import type { Nip46RelayPool } from '../../src/lib/nip46-bunker';

describe('bunker command', () => {
	const testDir = join(tmpdir(), `redshift-bunker-command-test-${Date.now()}`);
	const originalEnv = { ...process.env };
	const originalLog = console.log;
	let logs: string[] = [];

	beforeEach(() => {
		if (existsSync(testDir)) rmSync(testDir, { recursive: true });
		mkdirSync(testDir, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		logs = [];
		console.log = (...args: unknown[]) => {
			logs.push(args.map(String).join(' '));
		};
	});

	afterEach(() => {
		console.log = originalLog;
		process.env = { ...originalEnv };
		if (existsSync(testDir)) rmSync(testDir, { recursive: true });
	});

	function hex(bytes: Uint8Array) {
		return Array.from(bytes)
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	const relayPool: Nip46RelayPool = {
		subscribeMany() {
			return { close() {} };
		},
		publish() {
			return [Promise.resolve()];
		},
		close() {},
	};

	function writePrototypeConfig(secret = 'super-secret') {
		const bunkerDir = join(testDir, 'bunker');
		mkdirSync(bunkerDir, { recursive: true });
		writeFileSync(
			join(bunkerDir, 'prototype.json'),
			JSON.stringify({
				signerSecretKey: hex(generateSecretKey()),
				userSecretKey: hex(generateSecretKey()),
				secret,
				relays: ['wss://relay.test'],
				createdAt: 1,
			}),
		);
	}

	it('refuses to create plaintext prototype keys without explicit acknowledgement', async () => {
		await expect(
			bunkerCommand({ subcommand: 'status', relays: ['wss://relay.test'] }),
		).rejects.toThrow('--insecure-plaintext-keys');
	});

	it('rotates stored pairing secret each time start runs', async () => {
		writePrototypeConfig('old-secret');
		const path = join(testDir, 'bunker', 'prototype.json');

		await bunkerCommand({
			subcommand: 'start',
			relays: ['wss://relay.test'],
			insecurePlaintextKeys: true,
			relayPool,
			runOnceForTest: true,
		});

		const stored = JSON.parse(await Bun.file(path).text()) as { secret: string };
		expect(stored.secret).not.toBe('old-secret');
		expect(logs.join('\n')).not.toContain('old-secret');
	});

	it('redacts the stored pairing secret in status output', async () => {
		writePrototypeConfig('do-not-print-me');

		await bunkerCommand({ subcommand: 'status', relays: ['wss://relay.test'] });

		expect(logs.join('\n')).toContain('secret=REDACTED');
		expect(logs.join('\n')).not.toContain('do-not-print-me');
		expect(logs.join('\n')).toContain('Signer pubkey:');
		expect(logs.join('\n')).toContain('User pubkey:');
		expect(logs.join('\n')).toContain('Running: unavailable');
		expect(logs.join('\n')).toContain('Connected clients: unavailable');
	});
});
