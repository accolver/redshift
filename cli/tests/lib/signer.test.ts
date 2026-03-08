/**
 * NsecSigner Tests
 *
 * L2: Function-Author - Tests for local key signer
 * L4: Integration-Contractor - NostrSigner contract compliance
 */

import { describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { NsecSigner } from '../../src/lib/signer';
import type { NostrSigner } from '../../src/lib/types';

describe('NsecSigner', () => {
	it('implements NostrSigner interface', () => {
		const sk = generateSecretKey();
		const signer: NostrSigner = new NsecSigner(sk);

		expect(signer.pubkey).toBe(getPublicKey(sk));
		expect(typeof signer.signEvent).toBe('function');
		expect(typeof signer.encrypt).toBe('function');
		expect(typeof signer.decrypt).toBe('function');
	});

	it('exposes correct pubkey', () => {
		const sk = generateSecretKey();
		const signer = new NsecSigner(sk);

		expect(signer.pubkey).toBe(getPublicKey(sk));
	});

	it('rejects invalid private key', () => {
		expect(() => new NsecSigner(new Uint8Array(16))).toThrow('32-byte');
		expect(() => new NsecSigner(new Uint8Array(0))).toThrow('32-byte');
	});

	describe('signEvent', () => {
		it('signs an event with valid signature', async () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);

			const signed = await signer.signEvent({
				kind: 1,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: 'test message',
			});

			expect(signed.id).toBeDefined();
			expect(signed.pubkey).toBe(getPublicKey(sk));
			expect(signed.sig).toBeDefined();
			expect(signed.kind).toBe(1);
			expect(signed.content).toBe('test message');
			expect(verifyEvent(signed)).toBe(true);
		});

		it('preserves tags in signed event', async () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);

			const tags = [
				['d', 'test-project|dev'],
				['t', 'redshift-secrets'],
			];

			const signed = await signer.signEvent({
				kind: 30078,
				created_at: Math.floor(Date.now() / 1000),
				tags,
				content: '{}',
			});

			expect(signed.tags).toEqual(tags);
		});
	});

	describe('encrypt/decrypt', () => {
		it('encrypts and decrypts to self', async () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);
			const pubkey = getPublicKey(sk);

			const plaintext = 'secret data';
			const ciphertext = await signer.encrypt(pubkey, plaintext);

			expect(ciphertext).not.toBe(plaintext);

			const decrypted = await signer.decrypt(pubkey, ciphertext);
			expect(decrypted).toBe(plaintext);
		});

		it('encrypts and decrypts between two keys', async () => {
			const sk1 = generateSecretKey();
			const sk2 = generateSecretKey();
			const signer1 = new NsecSigner(sk1);
			const signer2 = new NsecSigner(sk2);

			const plaintext = 'cross-key secret';
			const ciphertext = await signer1.encrypt(getPublicKey(sk2), plaintext);

			const decrypted = await signer2.decrypt(getPublicKey(sk1), ciphertext);
			expect(decrypted).toBe(plaintext);
		});

		it('handles JSON content', async () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);
			const pubkey = getPublicKey(sk);

			const secrets = { API_KEY: 'sk_test_123', DB_URL: 'postgres://localhost/db' };
			const plaintext = JSON.stringify(secrets);

			const ciphertext = await signer.encrypt(pubkey, plaintext);
			const decrypted = await signer.decrypt(pubkey, ciphertext);

			expect(JSON.parse(decrypted)).toEqual(secrets);
		});
	});

	describe('getPrivateKey', () => {
		it('returns the raw private key bytes', () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);

			const retrieved = signer.getPrivateKey();
			expect(retrieved).toEqual(sk);
		});
	});
});
