/** Behavioral configure command tests. */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../../src/lib/config';

const TEST_DIR = join(import.meta.dir, '../.test-configure');
const CLI_ENTRY = join(import.meta.dir, '../../src/main.ts');
const originalEnv = { ...process.env };

function runCli(args: string[]) {
	return Bun.spawnSync(['bun', 'run', CLI_ENTRY, ...args], {
		env: { ...process.env, REDSHIFT_CONFIG_DIR: TEST_DIR, HOME: TEST_DIR },
		stdout: 'pipe',
		stderr: 'pipe',
	});
}

describe('configure command', () => {
	beforeEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
		mkdirSync(TEST_DIR, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = TEST_DIR;
		process.env.HOME = TEST_DIR;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	it('applies valid mutations atomically', async () => {
		const result = runCli([
			'configure',
			'set',
			'defaultProject=my-project',
			'defaultEnvironment=dev',
		]);
		expect(result.exitCode).toBe(0);
		expect(await loadConfig()).toMatchObject({
			defaultProject: 'my-project',
			defaultEnvironment: 'dev',
		});
	});

	it('rejects an invalid batch without writing its valid entries', async () => {
		await saveConfig({ defaultProject: 'original' });
		const result = runCli(['configure', 'set', 'defaultProject=changed', 'unknown=value']);
		expect(result.exitCode).not.toBe(0);
		expect(new TextDecoder().decode(result.stderr)).toContain('Unknown config key');
		expect(await loadConfig()).toEqual({ defaultProject: 'original' });
	});

	it('redacts all credential fields from get and --all output', async () => {
		await saveConfig({
			authMethod: 'bunker',
			nsec: 'nsec-secret',
			bunker: {
				bunkerPubkey: 'a'.repeat(64),
				relays: ['wss://relay.example'],
				clientSecretKey: 'client-secret',
				secret: 'pairing-secret',
			},
		});
		for (const args of [
			['configure', 'get'],
			['configure', 'get', 'nsec', 'bunker'],
			['configure', '--all'],
		]) {
			const result = runCli(args);
			const output = new TextDecoder().decode(result.stdout);
			expect(result.exitCode).toBe(0);
			expect(output).not.toContain('nsec-secret');
			expect(output).not.toContain('client-secret');
			expect(output).not.toContain('pairing-secret');
			expect(output).toContain('[REDACTED]');
		}
	});

	it('reset --yes clears auth, relays, and defaults', async () => {
		await saveConfig({
			nsec: 'nsec-secret',
			relays: ['wss://relay.example'],
			defaultProject: 'project',
			defaultEnvironment: 'dev',
		});
		const result = runCli(['configure', 'reset', '--yes']);
		expect(result.exitCode).toBe(0);
		expect(await loadConfig()).toEqual({});
	});
});
