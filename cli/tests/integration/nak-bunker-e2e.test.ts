/**
 * End-to-end NIP-46 bunker test using nak-generated keys and a nak in-memory relay.
 *
 * L4: Integration-Contractor - real NIP-46 relay transport
 * L5: Journey-Validator - bunker-backed Redshift secret workflows
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { connectToBunker, BunkerSecretManager } from '../../src/lib/bunker';
import { decodeNsec } from '../../src/lib/crypto';
import { startNip46BunkerService, type Nip46BunkerService } from '../../src/lib/nip46-bunker';
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

describe('nak-backed bunker E2E', () => {
	let relayProcess: ChildProcessWithoutNullStreams | null = null;
	let service: Nip46BunkerService | null = null;

	afterEach(async () => {
		service?.close();
		service = null;
		if (relayProcess) {
			relayProcess.kill('SIGTERM');
			await new Promise((resolve) => relayProcess?.once('exit', resolve));
			relayProcess = null;
		}
	});

	it('generates an nsec1 with nak and exercises bunker connect, relay switch, NIP-44, sign, wrap, unwrap, and scoped deletion signing', async () => {
		const nsec = createNakNsec();
		const userSecretKey = decodeNsec(nsec);
		const userPubkey = getPublicKey(userSecretKey);
		const signerSecretKey = generateSecretKey();
		const signerPubkey = getPublicKey(signerSecretKey);
		const port = await getFreePort();
		const relay = `ws://127.0.0.1:${port}`;

		relayProcess = spawn('nak', ['serve', '--hostname', '127.0.0.1', '--port', String(port)], {
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		await waitForRelay(relay);

		service = startNip46BunkerService({
			signerSecretKey,
			userSecretKey,
			relays: [relay],
			secret: 'nak-e2e-secret',
		});

		const connection = await connectToBunker(`bunker://${signerPubkey}?relay=${encodeURIComponent(relay)}&secret=nak-e2e-secret`);
		expect(connection.userPubkey).toBe(userPubkey);
		expect(connection.bunkerPointer.pubkey).toBe(signerPubkey);

		const signer = new BunkerSecretManager(connection, [relay]);
		expect(signer.getPublicKey()).toBe(userPubkey);
		const ciphertext = await signer.nip44Encrypt(userPubkey, 'bunker plaintext');
		expect(await signer.nip44Decrypt(userPubkey, ciphertext)).toBe('bunker plaintext');

		const signedSeal = await signer.signEvent({ kind: 13, content: 'seal', tags: [], created_at: 1 });
		expect(signedSeal.kind).toBe(13);
		expect(signedSeal.pubkey).toBe(userPubkey);
		expect(verifyEvent(signedSeal)).toBe(true);

		const deletion = await signer.signEvent({
			kind: 5,
			content: 'cleanup old gift wrap',
			tags: [['e', 'ab'.repeat(32)], ['k', '1059']],
			created_at: 1,
		});
		expect(deletion.kind).toBe(5);
		expect(deletion.tags).toContainEqual(['k', '1059']);
		expect(verifyEvent(deletion)).toBe(true);

		const manager = new SecretManager(signer);
		const giftWrap = await manager.wrapSecrets({
			API_KEY: 'nak-secret',
			FEATURE_FLAG: 'true',
		}, 'nak-project|dev');
		expect(giftWrap.event.kind).toBe(1059);
		expect(verifyEvent(giftWrap.event)).toBe(true);
		expect(await manager.unwrapSecrets(giftWrap.event)).toEqual({
			API_KEY: 'nak-secret',
			FEATURE_FLAG: 'true',
		});

		await manager.close();
	}, 15000);
});
