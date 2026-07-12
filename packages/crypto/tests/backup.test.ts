import { describe, expect, it } from 'bun:test';
import { createCipheriv, scryptSync } from 'node:crypto';
import {
	BACKUP_LIMITS,
	BACKUP_V1_HEADER_BYTES,
	decodeBackupPayload,
	decryptBackup,
	encodeBackupPayload,
	encryptBackup,
	type BackupPayloadV1,
} from '../src';

const PASSPHRASE = 'correct horse battery staple';

function payload(): BackupPayloadV1 {
	return {
		schema: 'com.redshiftapp.backup',
		version: 1,
		createdAt: 1_700_000_000,
		sourcePubkey: 'a'.repeat(64),
		contents: {
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		},
		entries: [
			{
				project: 'alpha',
				environment: 'dev',
				sourceCreatedAt: 1_699_999_999,
				sourceEventId: 'b'.repeat(64),
				secrets: [
					['EMPTY', ''],
					['MULTILINE', 'line one\nline two'],
					['UNICODE', 'héllo 🌍'],
				],
			},
		],
	};
}

function encryptionOptions() {
	return {
		salt: Uint8Array.from({ length: 16 }, (_, index) => index),
		nonce: Uint8Array.from({ length: 12 }, (_, index) => 16 + index),
	};
}

describe('encrypted backup format', () => {
	it('canonically encodes and strictly decodes the authenticated payload', () => {
		const encoded = encodeBackupPayload(payload());
		expect(decodeBackupPayload(encoded)).toEqual(payload());
		expect(new TextDecoder().decode(encoded)).toBe(JSON.stringify(payload()));

		const value = payload();
		const reordered = new TextEncoder().encode(
			JSON.stringify({
				version: value.version,
				schema: value.schema,
				createdAt: value.createdAt,
				sourcePubkey: value.sourcePubkey,
				contents: value.contents,
				entries: value.entries,
			}),
		);
		expect(() => decodeBackupPayload(reordered)).toThrow('canonical');
	});

	it('encrypts and decrypts a deterministic v1 vector', async () => {
		const encrypted = await encryptBackup(payload(), PASSPHRASE, encryptionOptions());
		expect(encrypted.byteLength).toBeGreaterThan(BACKUP_V1_HEADER_BYTES);
		expect(new TextDecoder().decode(encrypted)).not.toContain('MULTILINE');
		expect(await decryptBackup(encrypted, PASSPHRASE)).toEqual(payload());
		expect(Buffer.from(encrypted).toString('hex')).toBe(
			'524544534849465400010100000000400002000000000008000000010000024600000256000102030405060708090a0b0c0d0e0f101112131415161718191a1bf4efec30abf9bc6a8a2ab74f2cae4feb781279e4f1bbfcbf7dccd8c81e61ccbc56bc38c60744177bec3d933521fe142a011e524727d04e012ede2ff32044b1e0ce55cada6c4e3daeb6725d583e46f948e558e1e4638b96411eab1914974b87c7071579bcf24f70998ee2bbffb5e80382bd7fcc0f1ef4da01a87ab7ff9e1ecf01b017d6fe831afae3494759cc3be4a9f6f80230f712b58cc5a61a9268834df79a67d10cb52dc8a9bc8d70d60e8827a23692df3587eefcbc22a71894d3c7d6806d998b3ba249648dc973c53329e28bf46fb2169af8a9a511c0abd4d6613f11f482c0a89d81139fc912d3b6d6a15e1d6d6cde056b6210820b46b4d79b39a53b602f275a6e8a154c5551cce7c1f39d45378dbe171df125b3f38bb552e9ba902a7251d05c1306533f293ea629b78f3f86013dafc346c889c3da984a10740088ff09f5ce64d86510a410747e4cfc5ed734179a71155565932267086ce91103e177255241677a7b9996adffdb320f5f2b5a3bf1814d341684da378143f29b7b903f2d316717f6203fa4bdd8a924d0047298eb2538f277936ec9a2912379b1c40c64bc91c96fbcaa090a86166b97e54cfbde385eee47e02823a67590e6f645a7b5f37c0e04d3fa37b4f7b6a5fbc86d41aea8f49001e930973d0269fcbd634d780b8ab93c3fa0391d0e1f84e0cfb8e298add02022758899a3c1acd15e81d658029be4f1bc6befb8e373f848ccd631c77a455ec4301db26c1dca22233992bd0aa55eb177ac9ad25957b0f0ec8b8d7729e8598d0e3f4bf8a653e5b378fc2702d22677301143817473075337cc200a1720d36b884f8007b01aee532a',
		);
	}, 30_000);

	it('matches an independent Node scrypt and AES-GCM reference', async () => {
		const options = encryptionOptions();
		const encrypted = await encryptBackup(payload(), PASSPHRASE, options);
		const header = encrypted.subarray(0, BACKUP_V1_HEADER_BYTES);
		const plaintext = encodeBackupPayload(payload());
		const key = scryptSync(PASSPHRASE, options.salt, 32, {
			N: 131_072,
			r: 8,
			p: 1,
			maxmem: 256 * 1024 * 1024,
		});
		const cipher = createCipheriv('aes-256-gcm', key, options.nonce);
		cipher.setAAD(header);
		const ciphertext = Buffer.concat([
			cipher.update(plaintext),
			cipher.final(),
			cipher.getAuthTag(),
		]);
		expect(encrypted.subarray(BACKUP_V1_HEADER_BYTES)).toEqual(new Uint8Array(ciphertext));
		key.fill(0);
		plaintext.fill(0);
	}, 30_000);

	it('uses independent random salt and nonce values', async () => {
		const first = await encryptBackup(payload(), PASSPHRASE);
		const second = await encryptBackup(payload(), PASSPHRASE);
		expect(first).not.toEqual(second);
		expect(await decryptBackup(first, PASSPHRASE)).toEqual(payload());
		expect(await decryptBackup(second, PASSPHRASE)).toEqual(payload());
	}, 30_000);

	it('fails generically for wrong passphrases and authenticated tampering', async () => {
		const encrypted = await encryptBackup(payload(), PASSPHRASE, encryptionOptions());
		await expect(decryptBackup(encrypted, 'wrong passphrase')).rejects.toThrow(
			'Backup authentication failed',
		);
		for (const index of [11, 36, 52, BACKUP_V1_HEADER_BYTES, encrypted.length - 1]) {
			const tampered = encrypted.slice();
			tampered[index] = (tampered[index] ?? 0) ^ 1;
			await expect(decryptBackup(tampered, PASSPHRASE)).rejects.toThrow();
		}
	}, 30_000);

	it('clears KDF inputs and invalid derived output after setup failure', async () => {
		const captured: { passphrase?: Uint8Array; salt?: Uint8Array } = {};
		const invalidKey = new Uint8Array(31).fill(7);
		await expect(
			encryptBackup(payload(), PASSPHRASE, {
				...encryptionOptions(),
				deriveKey: async (passphrase, salt) => {
					captured.passphrase = passphrase;
					captured.salt = salt;
					return invalidKey;
				},
			}),
		).rejects.toThrow('invalid key');
		if (!captured.passphrase || !captured.salt) throw new Error('Expected captured KDF inputs');
		expect([...captured.passphrase]).toEqual(new Array(captured.passphrase.byteLength).fill(0));
		expect([...captured.salt]).toEqual(new Array(captured.salt.byteLength).fill(0));
		expect([...invalidKey]).toEqual(new Array(31).fill(0));
	});

	it('rejects malformed envelopes before deriving a key', async () => {
		const encrypted = await encryptBackup(payload(), PASSPHRASE, encryptionOptions());
		const cases = [
			encrypted.slice(0, encrypted.length - 1),
			new Uint8Array([...encrypted, 0]),
			mutateU16(encrypted, 8, 2),
			mutateByte(encrypted, 10, 2),
			mutateU32(encrypted, 16, 2 ** 18),
			mutateU32(encrypted, 28, BACKUP_LIMITS.maxPlaintextBytes + 1),
		];
		for (const malformed of cases) {
			await expect(
				decryptBackup(malformed, PASSPHRASE, {
					deriveKey: async () => {
						throw new Error('KDF must not run');
					},
				}),
			).rejects.not.toThrow('KDF must not run');
		}
	}, 30_000);

	it('rejects invalid passphrase encodings and lengths', async () => {
		await expect(encryptBackup(payload(), 'short')).rejects.toThrow('at least');
		await expect(encryptBackup(payload(), `valid password\ud800`)).rejects.toThrow('surrogate');
		await expect(
			encryptBackup(payload(), 'x'.repeat(BACKUP_LIMITS.maxPassphraseBytes + 1)),
		).rejects.toThrow('too long');
	});

	it('rejects duplicate, unsorted, malformed, or excessive payload content', () => {
		const base = payload();
		const cases: unknown[] = [
			{ ...base, sourcePubkey: 'A'.repeat(64) },
			{ ...base, entries: [{ ...base.entries[0], project: 'Bad Project' }] },
			{ ...base, entries: [...base.entries, base.entries[0]] },
			{
				...base,
				entries: [
					{
						...base.entries[0],
						secrets: [
							['DUP', 'one'],
							['DUP', 'two'],
						],
					},
				],
			},
			{
				...base,
				entries: [{ ...base.entries[0], secrets: [['__proto__', 'pollute']] }],
			},
			{ ...base, entries: [{ ...base.entries[0], secrets: [] }] },
			{ ...base, unexpected: true },
		];
		for (const value of cases) {
			expect(() => encodeBackupPayload(value as BackupPayloadV1)).toThrow();
		}
	});
});

function mutateByte(source: Uint8Array, offset: number, value: number) {
	const mutated = source.slice();
	mutated[offset] = value;
	return mutated;
}

function mutateU16(source: Uint8Array, offset: number, value: number) {
	const mutated = source.slice();
	new DataView(mutated.buffer).setUint16(offset, value, false);
	return mutated;
}

function mutateU32(source: Uint8Array, offset: number, value: number) {
	const mutated = source.slice();
	new DataView(mutated.buffer).setUint32(offset, value, false);
	return mutated;
}
