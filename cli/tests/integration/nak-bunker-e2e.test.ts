/**
 * End-to-end NIP-46 bunker test using nak-generated keys and a nak in-memory relay.
 *
 * L4: Integration-Contractor - real NIP-46 relay transport
 * L5: Journey-Validator - bunker-backed Redshift secret workflows
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { BunkerSecretManager, connectToBunker } from '../../src/lib/bunker';
import { decodeNsec } from '../../src/lib/crypto';
import { type Nip46BunkerService, startNip46BunkerService } from '../../src/lib/nip46-bunker';
import { SecretManager } from '../../src/lib/secret-manager';

async function getFreePort() {
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
	throw new Error(`nak relay did not start: ${String(lastError)}`);
}

function createNakNsec() {
	const hexSecret = execFileSync('nak', ['key', 'generate'], { encoding: 'utf8' }).trim();
	const nsec = execFileSync('nak', ['encode', 'nsec', hexSecret], { encoding: 'utf8' }).trim();
	expect(nsec).toStartWith('nsec1');
	return nsec;
}

const compiledBinary = join(import.meta.dir, '../../../dist/redshift');

describe('nak-backed bunker E2E', () => {
	let relayProcess: Bun.Subprocess | null = null;
	let service: Nip46BunkerService | null = null;

	afterEach(async () => {
		service?.close();
		service = null;
		if (relayProcess) {
			relayProcess.kill('SIGTERM');
			await Promise.race([relayProcess.exited, Bun.sleep(1000)]);
			relayProcess = null;
		}
	});

	it('generates an nsec1 with nak and exercises bunker connect, relay switch, NIP-44, sign, wrap, and unwrap', async () => {
		const nsec = createNakNsec();
		const userSecretKey = decodeNsec(nsec);
		const userPubkey = getPublicKey(userSecretKey);
		const signerSecretKey = generateSecretKey();
		const signerPubkey = getPublicKey(signerSecretKey);
		const port = await getFreePort();
		const relay = `ws://127.0.0.1:${port}`;

		relayProcess = Bun.spawn(['nak', 'serve', '--hostname', '127.0.0.1', '--port', String(port)], {
			stdin: 'ignore',
			stdout: 'ignore',
			stderr: 'pipe',
		});
		await waitForRelay(relay);

		service = startNip46BunkerService({
			signerSecretKey,
			userSecretKey,
			relays: [relay],
			secret: 'nak-e2e-secret',
		});

		const connection = await connectToBunker(
			`bunker://${signerPubkey}?relay=${encodeURIComponent(relay)}&secret=nak-e2e-secret`,
		);
		expect(connection.userPubkey).toBe(userPubkey);
		expect(connection.bunkerPointer.pubkey).toBe(signerPubkey);

		const signer = new BunkerSecretManager(connection, [relay]);
		expect(signer.getPublicKey()).toBe(userPubkey);
		const ciphertext = await signer.nip44Encrypt(userPubkey, 'bunker plaintext');
		expect(await signer.nip44Decrypt(userPubkey, ciphertext)).toBe('bunker plaintext');

		const signedSeal = await signer.signEvent({
			kind: 13,
			content: 'seal',
			tags: [],
			created_at: 1,
		});
		expect(signedSeal.kind).toBe(13);
		expect(signedSeal.pubkey).toBe(userPubkey);
		expect(verifyEvent(signedSeal)).toBe(true);

		await expect(
			signer.signEvent({
				kind: 5,
				content: 'cleanup old gift wrap',
				tags: [
					['e', 'ab'.repeat(32)],
					['k', '1059'],
				],
				created_at: 1,
			}),
		).rejects.toThrow('kind 5 is not permitted');

		const manager = new SecretManager(signer);
		const giftWrap = await manager.wrapSecrets(
			{
				API_KEY: 'nak-secret',
				FEATURE_FLAG: 'true',
			},
			'nak-project|dev',
		);
		expect(giftWrap.event.kind).toBe(1059);
		expect(verifyEvent(giftWrap.event)).toBe(true);
		expect(await manager.unwrapSecrets(giftWrap.event)).toEqual({
			API_KEY: 'nak-secret',
			FEATURE_FLAG: 'true',
		});

		await manager.close();
	}, 15000);

	it('runs the compiled CLI through command-scoped bunker authentication', async () => {
		expect(existsSync(compiledBinary), `Compiled binary required at ${compiledBinary}`).toBe(true);
		const root = mkdtempSync(join(tmpdir(), 'redshift-bunker-binary-'));
		const configDir = join(root, 'config');
		mkdirSync(configDir, { recursive: true });
		const userSecretKey = generateSecretKey();
		const signerSecretKey = generateSecretKey();
		const signerPubkey = getPublicKey(signerSecretKey);
		const port = await getFreePort();
		const relay = `ws://127.0.0.1:${port}`;
		relayProcess = Bun.spawn(['nak', 'serve', '--hostname', '127.0.0.1', '--port', String(port)], {
			stdin: 'ignore',
			stdout: 'ignore',
			stderr: 'pipe',
		});
		await waitForRelay(relay);

		const publisher = new SecretManager(userSecretKey);
		publisher.connect([relay]);
		await publisher.publishSecrets('bunker-binary', 'dev', { API_KEY: 'bunker-binary-secret' });
		await publisher.close();

		service = startNip46BunkerService({
			signerSecretKey,
			userSecretKey,
			relays: [relay],
		});
		writeFileSync(join(configDir, 'config.json'), JSON.stringify({ relays: [relay] }));
		const script = join(root, 'inspect.sh');
		writeFileSync(script, '#!/bin/sh\nprintf "%s|%s" "$API_KEY" "${REDSHIFT_BUNKER-unset}"\n');
		chmodSync(script, 0o755);

		try {
			const child = Bun.spawn(
				[
					compiledBinary,
					'--config-dir',
					configDir,
					'run',
					'--project',
					'bunker-binary',
					'--config',
					'dev',
					'--',
					script,
				],
				{
					cwd: root,
					env: {
						...process.env,
						REDSHIFT_BUNKER: `bunker://${signerPubkey}?relay=${encodeURIComponent(relay)}`,
					},
					stdin: 'ignore',
					stdout: 'pipe',
					stderr: 'pipe',
				},
			);
			const [stdout, stderr, exitCode] = await Promise.all([
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
				child.exited,
			]);
			expect(exitCode, stderr).toBe(0);
			expect(stdout).toBe('bunker-binary-secret|unset');
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}, 60_000);
});
