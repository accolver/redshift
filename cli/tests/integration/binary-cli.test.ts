import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Subprocess } from 'bun';
import { nip19 } from 'nostr-tools';
import { generateSecretKey } from 'nostr-tools/pure';

const binaryPath = join(import.meta.dir, '../../../dist/redshift');
const temporaryDirectories: string[] = [];
const childProcesses: Subprocess[] = [];

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

async function runBinary(
	args: string[],
	env: Record<string, string | undefined> = {},
	cwd?: string,
) {
	const process = Bun.spawn([binaryPath, ...args], {
		...(cwd ? { cwd } : {}),
		env: { ...globalThis.process.env, ...env },
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		process.exited,
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

async function waitForRelay(url: string) {
	for (let attempt = 0; attempt < 50; attempt++) {
		const socket = new WebSocket(url);
		const opened = await new Promise<boolean>((resolve) => {
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
		if (opened) return;
		await Bun.sleep(100);
	}
	throw new Error('Local nak relay did not start');
}

beforeAll(() => {
	expect(existsSync(binaryPath), `Compiled binary is required at ${binaryPath}`).toBe(true);
	expect(Bun.spawnSync(['sh', '-c', 'command -v nak']).exitCode).toBe(0);
});

afterEach(async () => {
	for (const process of childProcesses.splice(0)) {
		process.kill();
		await Promise.race([process.exited, Bun.sleep(500)]);
	}
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe('compiled CLI contracts', () => {
	it('rejects unknown options with a usage exit code', async () => {
		const result = await runBinary(['secrets', '--definitely-unknown']);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain('Unknown option');
	});

	it('returns scriptable JSON and nonzero status when unauthenticated', async () => {
		const root = mkdtempSync(join(tmpdir(), 'redshift-me-e2e-'));
		temporaryDirectories.push(root);
		const result = await runBinary(['--config-dir', join(root, 'config'), 'me', '--json']);
		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.stdout)).toEqual({ authenticated: false });
	});

	it('performs setup, secret publication, and exact argv execution against a real relay', async () => {
		const root = mkdtempSync(join(tmpdir(), 'redshift-binary-e2e-'));
		temporaryDirectories.push(root);
		const configDir = join(root, 'config');
		const port = await getFreePort();
		const backupPort = await getFreePort();
		const unavailablePort = await getFreePort();
		const relayUrl = `ws://127.0.0.1:${port}`;
		const backupRelayUrl = `ws://127.0.0.1:${backupPort}`;
		const unavailableRelayUrl = `ws://127.0.0.1:${unavailablePort}`;
		const relay = Bun.spawn(['nak', 'serve', '--hostname', '127.0.0.1', '--port', String(port)], {
			stdout: 'ignore',
			stderr: 'pipe',
		});
		const backupRelay = Bun.spawn(
			['nak', 'serve', '--hostname', '127.0.0.1', '--port', String(backupPort)],
			{ stdout: 'ignore', stderr: 'pipe' },
		);
		childProcesses.push(relay, backupRelay);
		await Promise.all([waitForRelay(relayUrl), waitForRelay(backupRelayUrl)]);

		const globalArgs = ['--config-dir', configDir];
		const nsec = nip19.nsecEncode(generateSecretKey());
		const authEnvironment = { REDSHIFT_NSEC: nsec };
		const configure = await runBinary(
			[
				...globalArgs,
				'configure',
				'set',
				`relays=${relayUrl},${backupRelayUrl},${unavailableRelayUrl}`,
			],
			{},
			root,
		);
		expect(configure.exitCode).toBe(0);

		const setup = await runBinary(
			[
				...globalArgs,
				'setup',
				'--project',
				'binary-project',
				'--config',
				'dev',
				'--no-interactive',
			],
			authEnvironment,
			root,
		);
		expect(setup.exitCode, setup.stderr).toBe(0);

		const setSecret = await runBinary(
			[
				...globalArgs,
				'secrets',
				'set',
				'API_KEY',
				'binary-secret',
				'--project',
				'binary-project',
				'--config',
				'dev',
			],
			authEnvironment,
			root,
		);
		expect(setSecret.exitCode, setSecret.stderr).toBe(0);

		const listSecrets = await runBinary(
			[...globalArgs, 'secrets', '--project', 'binary-project', '--config', 'dev'],
			authEnvironment,
			root,
		);
		expect(listSecrets.exitCode, listSecrets.stderr).toBe(0);
		expect(listSecrets.stdout).toContain('API_KEY');
		expect(listSecrets.stdout).not.toContain('binary-secret');

		const rawSecret = await runBinary(
			[
				...globalArgs,
				'secrets',
				'get',
				'API_KEY',
				'--raw',
				'--project',
				'binary-project',
				'--config',
				'dev',
			],
			authEnvironment,
			root,
		);
		expect(rawSecret.exitCode, rawSecret.stderr).toBe(0);
		expect(rawSecret.stdout).toBe('binary-secret');

		const childScript = join(root, 'inspect-child.sh');
		writeFileSync(
			childScript,
			'#!/bin/sh\nprintf \'argc=%s\\narg1=%s\\narg2=%s\\narg3=<%s>\\nsecret=%s\\nnsec=%s\\nbunker=%s\\n\' "$#" "$1" "$2" "$3" "$API_KEY" "${REDSHIFT_NSEC-unset}" "${REDSHIFT_BUNKER-unset}"\n',
		);
		chmodSync(childScript, 0o755);

		const execution = await runBinary(
			[
				...globalArgs,
				'run',
				'--project',
				'binary-project',
				'--config',
				'dev',
				'--',
				childScript,
				'--literal',
				'space value',
				'',
			],
			authEnvironment,
			root,
		);
		expect(execution.exitCode, execution.stderr).toBe(0);
		expect(execution.stdout).toContain('argc=3');
		expect(execution.stdout).toContain('arg1=--literal');
		expect(execution.stdout).toContain('arg2=space value');
		expect(execution.stdout).toContain('arg3=<>');
		expect(execution.stdout).toContain('secret=binary-secret');
		expect(execution.stdout).toContain('nsec=unset');
		expect(execution.stdout).toContain('bunker=unset');

		const shellExecution = await runBinary(
			[
				...globalArgs,
				'run',
				'--project',
				'binary-project',
				'--config',
				'dev',
				'--command',
				'printf "shell=%s" "$API_KEY"',
			],
			authEnvironment,
			root,
		);
		expect(shellExecution.exitCode, shellExecution.stderr).toBe(0);
		expect(shellExecution.stdout).toBe('shell=binary-secret');

		const childExit = await runBinary(
			[
				...globalArgs,
				'run',
				'--project',
				'binary-project',
				'--config',
				'dev',
				'--',
				'sh',
				'-c',
				'exit 7',
			],
			authEnvironment,
			root,
		);
		expect(childExit.exitCode).toBe(7);

		const signalMarker = join(root, 'child-signal.txt');
		const childReady = join(root, 'child-ready.txt');
		const signalScript = join(root, 'signal-child.sh');
		writeFileSync(
			signalScript,
			`#!/bin/sh\ntrap 'printf term > "${signalMarker}"; exit 0' TERM\nprintf ready > "${childReady}"\nwhile :; do sleep 1; done\n`,
		);
		chmodSync(signalScript, 0o755);
		const running = Bun.spawn(
			[
				binaryPath,
				...globalArgs,
				'run',
				'--project',
				'binary-project',
				'--config',
				'dev',
				'--',
				signalScript,
			],
			{
				cwd: root,
				env: { ...globalThis.process.env, ...authEnvironment },
				stdout: 'ignore',
				stderr: 'ignore',
			},
		);
		childProcesses.push(running);
		for (let attempt = 0; attempt < 100 && !existsSync(childReady); attempt++) {
			await Bun.sleep(100);
		}
		expect(existsSync(childReady)).toBe(true);
		running.kill('SIGTERM');
		await running.exited;
		for (let attempt = 0; attempt < 20 && !existsSync(signalMarker); attempt++) {
			await Bun.sleep(50);
		}
		expect(readFileSync(signalMarker, 'utf8')).toBe('term');

		const deleteSecret = await runBinary(
			[
				...globalArgs,
				'secrets',
				'delete',
				'API_KEY',
				'--project',
				'binary-project',
				'--config',
				'dev',
			],
			authEnvironment,
			root,
		);
		expect(deleteSecret.exitCode, deleteSecret.stderr).toBe(0);

		const deletedGet = await runBinary(
			[
				...globalArgs,
				'secrets',
				'get',
				'API_KEY',
				'--raw',
				'--project',
				'binary-project',
				'--config',
				'dev',
			],
			authEnvironment,
			root,
		);
		expect(deletedGet.exitCode).toBe(1);
		expect(deletedGet.stderr).toContain("Secret 'API_KEY' not found");
	}, 60_000);
});
