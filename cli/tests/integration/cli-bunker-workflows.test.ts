/**
 * Spawned CLI bunker workflow coverage.
 *
 * L5: Journey-Validator - login -> setup -> secret editing -> CLI injection
 * L4: Integration-Contractor - real relay transport and NIP-46 reconnects
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nsecEncode } from 'nostr-tools/nip19';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { startNip46BunkerService, type Nip46BunkerService } from '../../src/lib/nip46-bunker';

interface CliResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

async function getFreePort() {
	const { createServer } = await import('node:net');
	return await new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			server.close(() => {
				if (address && typeof address === 'object') resolve(address.port);
				else reject(new Error('Could not allocate test port'));
			});
		});
		server.on('error', reject);
	});
}

async function waitForRelay(url: string) {
	const deadline = Date.now() + 5000;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			await new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(url);
				const timer = setTimeout(() => {
					ws.close();
					reject(new Error('relay websocket open timed out'));
				}, 250);
				ws.onopen = () => {
					clearTimeout(timer);
					ws.close();
					resolve();
				};
				ws.onerror = (event) => {
					clearTimeout(timer);
					reject(event);
				};
			});
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw new Error(`relay did not start: ${String(lastError)}`);
}

function nsecFromSecret(secretKey: Uint8Array) {
	return nsecEncode(secretKey);
}

function decodeOutput(output: Uint8Array | undefined) {
	return new TextDecoder().decode(output ?? new Uint8Array());
}

function expectSuccess(result: CliResult) {
	if (result.exitCode !== 0) {
		console.error('STDOUT:', result.stdout);
		console.error('STDERR:', result.stderr);
	}
	expect(result.exitCode).toBe(0);
}

describe('spawned CLI bunker workflows', () => {
	let relayProcess: Bun.Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
	let service: Nip46BunkerService | null = null;
	let tempDir: string | null = null;

	afterEach(async () => {
		service?.close();
		service = null;
		if (relayProcess) {
			relayProcess.kill();
			await relayProcess.exited;
			relayProcess = null;
		}
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = null;
		}
	});

	async function startFixture() {
		tempDir = await mkdtemp(join(tmpdir(), 'redshift-cli-bunker-'));
		const projectDir = join(tempDir, 'project');
		const configDir = join(tempDir, 'config');
		await Bun.write(join(tempDir, '.keep'), '');
		await Bun.$`mkdir -p ${projectDir} ${configDir}`;

		const port = await getFreePort();
		const relay = `ws://127.0.0.1:${port}`;
		relayProcess = Bun.spawn(['nak', 'serve', '--hostname', '127.0.0.1', '--port', String(port)], {
			stdin: 'ignore',
			stdout: 'pipe',
			stderr: 'pipe',
		});
		await waitForRelay(relay);

		const userSecretKey = generateSecretKey();
		const signerSecretKey = generateSecretKey();
		const signerPubkey = getPublicKey(signerSecretKey);
		service = startNip46BunkerService({
			signerSecretKey,
			userSecretKey,
			relays: [relay],
			secret: 'cli-workflow-secret',
		});
		await new Promise((resolve) => setTimeout(resolve, 250));

		await Bun.write(join(configDir, 'config.json'), JSON.stringify({ relays: [relay] }, null, 2));

		const baseEnv: Record<string, string> = {};
		for (const [key, value] of Object.entries(process.env)) {
			if (value !== undefined && key !== 'REDSHIFT_NSEC' && key !== 'REDSHIFT_BUNKER') {
				baseEnv[key] = value;
			}
		}
		baseEnv.HOME = tempDir;
		baseEnv.REDSHIFT_CONFIG_DIR = configDir;
		baseEnv.REDSHIFT_DISABLE_KEYCHAIN = '1';
		const cliPath = join(process.cwd(), 'src/main.ts');
		const run = async (args: string[], extraEnv: Record<string, string> = {}): Promise<CliResult> => {
			const result = Bun.spawn({
				cmd: ['bun', cliPath, ...args],
				cwd: projectDir,
				env: { ...baseEnv, ...extraEnv },
				stdout: 'pipe',
				stderr: 'pipe',
			});
			const [stdout, stderr, exitCode] = await Promise.all([
				new Response(result.stdout).arrayBuffer(),
				new Response(result.stderr).arrayBuffer(),
				result.exited,
			]);
			return {
				stdout: decodeOutput(new Uint8Array(stdout)),
				stderr: decodeOutput(new Uint8Array(stderr)),
				exitCode,
			};
		};

		return {
			projectDir,
			configDir,
			relay,
			run,
			bunkerUrl: `bunker://${signerPubkey}?relay=${encodeURIComponent(relay)}&secret=cli-workflow-secret`,
			userNsec: nsecFromSecret(userSecretKey),
		};
	}

	it('logs in with bunker and exercises setup, secrets, download/upload, and run flows', async () => {
		const fixture = await startFixture();
		const project = `cli-test-${Date.now()}`;

		let result = await fixture.run(['login', '--force', '--bunker', fixture.bunkerUrl]);
		expectSuccess(result);
		expect(result.stdout).toContain('Connected to bunker successfully');

		result = await fixture.run(['setup', '--project', project, '--environment', 'dev']);
		expectSuccess(result);
		expect(result.stdout).toContain('Configuration saved');

		result = await fixture.run(['secrets', 'set', 'API_KEY=dev-123', 'DATABASE_URL=postgres://localhost/app']);
		expectSuccess(result);
		expect(result.stdout).toContain('Set 2 secrets');

		result = await fixture.run(['secrets', 'list', '--only-names']);
		expectSuccess(result);
		expect(result.stdout).toContain('API_KEY');
		expect(result.stdout).toContain('DATABASE_URL');

		result = await fixture.run(['secrets', 'get', 'API_KEY', '--plain']);
		expectSuccess(result);
		expect(result.stdout).toBe('dev-123');

		result = await fixture.run(['secrets', 'get', 'API_KEY', 'MISSING', '--no-exit-on-missing-secret']);
		expectSuccess(result);
		expect(result.stdout).toContain('API_KEY=dev-123');

		result = await fixture.run(['secrets', 'download', '--format', 'json', '--no-file']);
		expectSuccess(result);
		expect(result.stdout).toContain('"API_KEY": "dev-123"');

		const envFile = join(fixture.projectDir, 'download.env');
		result = await fixture.run(['secrets', 'download', '--format', 'env-no-quotes', envFile]);
		expectSuccess(result);
		expect(await Bun.file(envFile).text()).toContain('API_KEY=dev-123');

		await writeFile(join(fixture.projectDir, 'upload.env'), 'FEATURE_FLAG=true\nAPI_KEY=uploaded\n');
		result = await fixture.run(['secrets', 'upload', 'upload.env']);
		expectSuccess(result);
		expect(result.stdout).toContain('Uploaded 2 secrets');

		result = await fixture.run(['run', '--', 'bun', '-e', 'console.log(process.env.API_KEY)']);
		expectSuccess(result);
		expect(result.stdout).toContain('uploaded');

		result = await fixture.run(
			['run', '--preserve-env', 'API_KEY', '--', 'bun', '-e', 'console.log(process.env.API_KEY)'],
			{ API_KEY: 'existing' },
		);
		expectSuccess(result);
		expect(result.stdout).toContain('existing');

		const mountPath = join(fixture.projectDir, 'mounted-secrets.json');
		result = await fixture.run([
			'run',
			'--mount',
			mountPath,
			'--',
			'test',
			'-f',
			mountPath,
		]);
		expectSuccess(result);
		expect(await Bun.file(mountPath).exists()).toBe(false);

		result = await fixture.run(['secrets', 'delete', 'FEATURE_FLAG', 'DATABASE_URL', '--yes']);
		expectSuccess(result);
		expect(result.stdout).toContain('Deleted 2 secrets');
	}, 30000);

	it('supports REDSHIFT_NSEC auth for direct CLI flows without stored login', async () => {
		const fixture = await startFixture();
		const project = `nsec-test-${Date.now()}`;

		let result = await fixture.run(['setup', '--project', project, '--environment', 'dev']);
		expectSuccess(result);

		result = await fixture.run(['secrets', 'set', 'TOKEN', 'nsec-token'], { REDSHIFT_NSEC: fixture.userNsec });
		expectSuccess(result);

		result = await fixture.run(['run', '--', 'bun', '-e', 'console.log(process.env.TOKEN)'], {
			REDSHIFT_NSEC: fixture.userNsec,
		});
		expectSuccess(result);
		expect(result.stdout).toContain('nsec-token');
	}, 30000);
});
