/**
 * SecretManager Tests - TDD
 *
 * L2: Function-Author - Secret management operations
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
import { nip44 } from 'nostr-tools';
import type { EventTemplate } from 'nostr-tools/core';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { createNip46BunkerHandler } from '../../src/lib/nip46-bunker';
import { PublishQuorumError } from '../../src/lib/relay';
import type { PublishReport, RelayPool } from '../../src/lib/relay';
import type { RecoveryRecord } from '../../src/lib/publication-recovery';
import {
	SecretManager,
	boundHistoryGiftWraps,
	extractProjects,
	getNextSecretTimestamp,
	injectSecrets,
	mergeSecrets,
} from '../../src/lib/secret-manager';
import type { NostrEvent, SecretBundle } from '../../src/lib/types';

describe('SecretManager', () => {
	// Generate test keys
	const testPrivateKey = new Uint8Array(32);
	crypto.getRandomValues(testPrivateKey);

	function createFakeSigner(privateKey: Uint8Array) {
		const publicKey = getPublicKey(privateKey);
		return {
			getPublicKey: () => publicKey,
			signEvent: async (event: EventTemplate) => finalizeEvent(event, privateKey) as NostrEvent,
			nip44Encrypt: async (pubkey: string, plaintext: string) => {
				const conversationKey = nip44.v2.utils.getConversationKey(privateKey, pubkey);
				return nip44.v2.encrypt(plaintext, conversationKey);
			},
			nip44Decrypt: async (pubkey: string, ciphertext: string) => {
				const conversationKey = nip44.v2.utils.getConversationKey(privateKey, pubkey);
				return nip44.v2.decrypt(ciphertext, conversationKey);
			},
		};
	}

	async function createLocalBunkerBackedSigner(userSecretKey: Uint8Array) {
		const signerSecretKey = new Uint8Array(32).fill(9);
		const clientSecretKey = new Uint8Array(32).fill(10);
		const clientPubkey = getPublicKey(clientSecretKey);
		const handler = createNip46BunkerHandler({
			signerSecretKey,
			userSecretKey,
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret'],
		});
		return {
			getPublicKey: () => getPublicKey(userSecretKey),
			signEvent: async (event: EventTemplate) => {
				const response = await handler.handleRequest(clientPubkey, {
					id: 'sign-1',
					method: 'sign_event',
					params: [JSON.stringify(event)],
				});
				if (!response.result) throw new Error(response.error ?? 'sign failed');
				return JSON.parse(response.result) as NostrEvent;
			},
			nip44Encrypt: async (pubkey: string, plaintext: string) => {
				const response = await handler.handleRequest(clientPubkey, {
					id: 'encrypt-1',
					method: 'nip44_encrypt',
					params: [pubkey, plaintext],
				});
				if (!response.result) throw new Error(response.error ?? 'encrypt failed');
				return response.result;
			},
			nip44Decrypt: async (pubkey: string, ciphertext: string) => {
				const response = await handler.handleRequest(clientPubkey, {
					id: 'decrypt-1',
					method: 'nip44_decrypt',
					params: [pubkey, ciphertext],
				});
				if (!response.result) throw new Error(response.error ?? 'decrypt failed');
				return response.result;
			},
			close: async () => {},
		};
	}

	describe('constructor', () => {
		it('creates manager with private key', () => {
			const manager = new SecretManager(testPrivateKey);
			expect(manager).toBeDefined();
		});
	});

	describe('local operations (no relay)', () => {
		it('wraps and unwraps secrets locally', async () => {
			const manager = new SecretManager(testPrivateKey);
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				DEBUG: 'true',
			};

			const wrapped = await manager.wrapSecrets(secrets, 'proj|dev');
			const unwrapped = await manager.unwrapSecrets(wrapped.event);

			expect(unwrapped).toEqual(secrets);
		});

		it('wraps and unwraps secrets through a signer without direct private key access', async () => {
			const signerKey = generateSecretKey();
			const manager = new SecretManager(createFakeSigner(signerKey));
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				DEBUG: 'true',
			};

			const wrapped = await manager.wrapSecrets(secrets, 'proj|dev');
			const unwrapped = await manager.unwrapSecrets(wrapped.event);

			expect(wrapped.event.pubkey).not.toBe(manager.getPublicKey());
			expect(unwrapped).toEqual(secrets);
		});

		it('roundtrips secrets through a local NIP-46 bunker-backed signer', async () => {
			const userSecretKey = generateSecretKey();
			const manager = new SecretManager(await createLocalBunkerBackedSigner(userSecretKey));
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				DATABASE_URL: 'postgres://localhost/redshift',
			};

			const wrapped = await manager.wrapSecrets(secrets, 'proj|dev');
			const unwrapped = await manager.unwrapSecrets(wrapped.event);

			expect(manager.getPublicKey()).toBe(getPublicKey(userSecretKey));
			expect(wrapped.event.pubkey).not.toBe(manager.getPublicKey());
			expect(unwrapped).toEqual(secrets);
			await manager.close();
		});
	});

	describe('authenticated state snapshots', () => {
		it('exposes latest live and tombstoned state with deterministic version evidence', async () => {
			const privateKey = generateSecretKey();
			const manager = new SecretManager(privateKey);
			const older = await manager.wrapSecrets({ OLD: 'value' }, 'alpha|dev', { createdAt: 100 });
			const tombstone = await manager.wrapSecrets({}, 'alpha|dev', { createdAt: 101 });
			const live = await manager.wrapSecrets({ API_KEY: 'secret' }, 'beta|prod', {
				createdAt: 102,
			});
			const pool: RelayPool = {
				relays: ['wss://relay.test/'],
				pool: {} as RelayPool['pool'],
				subscribe: () => ({ close: () => {} }),
				publish: async () => {
					throw new Error('not used');
				},
				publishTo: async () => {
					throw new Error('not used');
				},
				query: async () => [older.event, tombstone.event, live.event],
				close: () => {},
				resetRateLimiter: () => {},
			};
			const connected = new SecretManager(privateKey, { createPool: () => pool });
			connected.connect(pool.relays);

			const states = await connected.fetchAllSecretStates();
			expect(states.get('alpha|dev')).toEqual({
				dTag: 'alpha|dev',
				secrets: {},
				createdAt: 101,
				eventId: tombstone.event.id,
			});
			expect(states.get('beta|prod')?.secrets).toEqual({ API_KEY: 'secret' });
			const mutableSecrets = states.get('beta|prod')?.secrets;
			if (!mutableSecrets) throw new Error('Expected beta snapshot');
			mutableSecrets.API_KEY = 'mutated';
			expect((await connected.fetchAllSecretStates()).get('beta|prod')?.secrets).toEqual({
				API_KEY: 'secret',
			});
			expect(await connected.fetchAllSecrets()).toEqual(
				new Map([['beta|prod', { API_KEY: 'secret' }]]),
			);
			await manager.close();
			await connected.close();
		});

		it('aborts snapshots on transient remote signer decryption failures without caching omission', async () => {
			const privateKey = generateSecretKey();
			const local = new SecretManager(privateKey);
			const wrapped = await local.wrapSecrets({ API_KEY: 'secret' }, 'alpha|dev');
			let decryptCalls = 0;
			const signer = {
				...createFakeSigner(privateKey),
				nip44Decrypt: async () => {
					decryptCalls += 1;
					throw new Error('Invalid payload request from bunker transport');
				},
			};
			const pool: RelayPool = {
				relays: ['wss://relay.test/'],
				pool: {} as RelayPool['pool'],
				subscribe: () => ({ close: () => {} }),
				publish: async () => {
					throw new Error('not used');
				},
				publishTo: async () => {
					throw new Error('not used');
				},
				query: async () => [wrapped.event],
				close: () => {},
				resetRateLimiter: () => {},
			};
			const connected = new SecretManager(signer, { createPool: () => pool });
			connected.connect(pool.relays);
			await expect(connected.fetchAllSecretStates()).rejects.toThrow('could not decrypt');
			await expect(connected.fetchAllSecretStates()).rejects.toThrow('could not decrypt');
			expect(decryptCalls).toBe(2);
			await local.close();
			await connected.close();
		});

		it('applies one deterministic global cap after multi-relay aggregation', () => {
			const events = Array.from({ length: 1_005 }, (_, index) => ({
				id: index.toString(16).padStart(64, '0'),
				pubkey: 'a'.repeat(64),
				created_at: index,
				kind: 1059,
				tags: [],
				content: 'encrypted',
				sig: 'b'.repeat(128),
			}));
			const bounded = boundHistoryGiftWraps([...events.slice().reverse(), events[1]!]);
			expect(bounded.observedEvents).toBe(1_005);
			expect(bounded.events).toHaveLength(1_000);
			expect(bounded.events[0]?.created_at).toBe(1_004);
			expect(bounded.events.at(-1)?.created_at).toBe(5);
			expect(bounded.truncated).toBe(true);

			const oneMiB = 'x'.repeat(1024 * 1024);
			const aggregate = boundHistoryGiftWraps(
				Array.from({ length: 17 }, (_, index) => ({
					...events[index]!,
					id: `f${index.toString(16).padStart(63, '0')}`,
					content: oneMiB,
				})),
			);
			expect(aggregate.events).toHaveLength(16);
			expect(aggregate.truncated).toBe(true);
		});

		it('observes bounded authenticated history for one exact d-tag', async () => {
			const privateKey = generateSecretKey();
			const local = new SecretManager(privateKey);
			const older = await local.wrapSecrets({ API_KEY: 'old' }, 'alpha|dev', { createdAt: 100 });
			const tiedHigh = await local.wrapSecrets({ API_KEY: 'high' }, 'alpha|dev', {
				createdAt: 101,
			});
			const tiedLow = await local.wrapSecrets({}, 'alpha|dev', { createdAt: 101 });
			const other = await local.wrapSecrets({ TOKEN: 'other' }, 'beta|dev', { createdAt: 102 });
			const invalid = { ...older.event, id: 'f'.repeat(64), sig: '0'.repeat(128) };
			let observedFilter: Record<string, unknown> | undefined;
			const events = [
				older.event,
				tiedHigh.event,
				tiedLow.event,
				tiedLow.event,
				other.event,
				invalid,
			];
			const pool: RelayPool = {
				relays: ['wss://relay.test/'],
				pool: {} as RelayPool['pool'],
				subscribe: () => ({ close: () => {} }),
				publish: async () => {
					throw new Error('not used');
				},
				publishTo: async () => {
					throw new Error('not used');
				},
				query: async (filter) => {
					observedFilter = filter as Record<string, unknown>;
					return events;
				},
				close: () => {},
				resetRateLimiter: () => {},
			};
			const connected = new SecretManager(privateKey, { createPool: () => pool });
			connected.connect(pool.relays);

			const history = await connected.fetchSecretHistory('alpha', 'dev');
			const expectedTieOrder = [tiedHigh.event.id, tiedLow.event.id].sort();
			expect(history.versions.map(({ eventId }) => eventId)).toEqual([
				...expectedTieOrder,
				older.event.id,
			]);
			expect(history.versions[0]?.current).toBe(true);
			expect(history.versions.find(({ eventId }) => eventId === tiedLow.event.id)?.tombstone).toBe(
				true,
			);
			expect(history.observedEvents).toBe(5);
			expect(history.truncated).toBe(false);
			expect(observedFilter?.limit).toBe(1_000);
			history.versions[0]!.secrets.API_KEY = 'mutated';
			expect(
				(await connected.fetchSecretHistory('alpha', 'dev')).versions[0]?.secrets.API_KEY,
			).not.toBe('mutated');
			await local.close();
			await connected.close();
		});

		it('aborts history on remote signer uncertainty without caching the omission', async () => {
			const privateKey = generateSecretKey();
			const local = new SecretManager(privateKey);
			const wrapped = await local.wrapSecrets({ API_KEY: 'secret' }, 'alpha|dev');
			let decryptCalls = 0;
			const signer = {
				...createFakeSigner(privateKey),
				nip44Decrypt: async () => {
					decryptCalls += 1;
					throw new Error('Bunker transport disconnected');
				},
			};
			const pool: RelayPool = {
				relays: ['wss://relay.test/'],
				pool: {} as RelayPool['pool'],
				subscribe: () => ({ close: () => {} }),
				publish: async () => {
					throw new Error('not used');
				},
				publishTo: async () => {
					throw new Error('not used');
				},
				query: async () => [wrapped.event],
				close: () => {},
				resetRateLimiter: () => {},
			};
			const connected = new SecretManager(signer, { createPool: () => pool });
			connected.connect(pool.relays);
			await expect(connected.fetchSecretHistory('alpha', 'dev')).rejects.toThrow(
				'could not decrypt',
			);
			await expect(connected.fetchSecretHistory('alpha', 'dev')).rejects.toThrow(
				'could not decrypt',
			);
			expect(decryptCalls).toBe(2);
			await local.close();
			await connected.close();
		});

		it('chooses a strictly newer bounded restore timestamp', () => {
			expect(getNextSecretTimestamp(undefined, 100)).toBe(100);
			expect(getNextSecretTimestamp(99, 100)).toBe(100);
			expect(getNextSecretTimestamp(100, 100)).toBe(101);
			expect(getNextSecretTimestamp(399, 100)).toBe(400);
			expect(() => getNextSecretTimestamp(400, 100)).toThrow('future-skew');
		});
	});

	describe('publication recovery', () => {
		function report(
			eventId: string,
			states: Array<'accepted' | 'rejected' | 'unavailable'>,
		): PublishReport {
			const outcomes = states.map((state, index) => ({
				relay: `wss://${index + 1}.test/`,
				state,
				...(state === 'accepted'
					? {}
					: { reason: state === 'rejected' ? 'restricted: policy' : 'timeout' }),
			}));
			return {
				eventId,
				required: Math.floor(states.length / 2) + 1,
				accepted: outcomes.filter(({ state }) => state === 'accepted').map(({ relay }) => relay),
				failed: outcomes
					.filter(({ state }) => state !== 'accepted')
					.map(({ relay, reason }) => ({ relay, reason: reason ?? 'unknown' })),
				outcomes,
			};
		}

		function managerWithPublication(
			publish: (event: NostrEvent) => Promise<PublishReport>,
			effects: string[],
			records: RecoveryRecord[],
		) {
			const pool: RelayPool = {
				relays: ['wss://1.test/', 'wss://2.test/', 'wss://3.test/'],
				pool: {} as RelayPool['pool'],
				subscribe: () => ({ close: () => {} }),
				publish: async (event) => {
					effects.push('publish');
					return publish(event);
				},
				publishTo: async () => {
					throw new Error('not used');
				},
				query: async () => [],
				close: () => {},
				resetRateLimiter: () => {},
			};
			const manager = new SecretManager(generateSecretKey(), {
				createPool: () => pool,
				saveRecovery: async (record) => {
					effects.push(`save:${record.report.accepted.length}`);
					records.push(structuredClone(record));
				},
				removeRecovery: async () => {
					effects.push('remove');
				},
			});
			manager.connect(pool.relays);
			return manager;
		}

		it('publishes an explicit strictly newer inner timestamp', async () => {
			const effects: string[] = [];
			const records: RecoveryRecord[] = [];
			const manager = managerWithPublication(
				async (event) => report(event.id, ['accepted', 'accepted', 'accepted']),
				effects,
				records,
			);
			const event = await manager.publishSecrets(
				'project',
				'dev',
				{ API_KEY: 'secret' },
				{ createdAt: 123 },
			);
			expect((await manager.unwrapWithMetadata(event)).createdAt).toBe(123);
			await manager.close();
		});

		it('rejects explicit publication timestamps beyond the future-skew tolerance', async () => {
			const effects: string[] = [];
			const records: RecoveryRecord[] = [];
			const manager = managerWithPublication(
				async (event) => report(event.id, ['accepted', 'accepted', 'accepted']),
				effects,
				records,
			);
			const future = Math.floor(Date.now() / 1000) + 301;
			await expect(
				manager.publishSecrets('project', 'dev', { API_KEY: 'secret' }, { createdAt: future }),
			).rejects.toThrow('outside the allowed range');
			expect(effects).toEqual([]);
			await manager.close();
		});

		it('persists the exact event before network publication and stores degraded outcomes', async () => {
			const effects: string[] = [];
			const records: RecoveryRecord[] = [];
			const manager = managerWithPublication(
				async (event) => report(event.id, ['accepted', 'accepted', 'unavailable']),
				effects,
				records,
			);
			const event = await manager.publishSecrets('project', 'dev', { API_KEY: 'secret' });
			expect(effects).toEqual(['save:0', 'publish', 'save:2']);
			expect(records).toHaveLength(2);
			expect(records[0]?.event).toEqual(event);
			expect(records[1]?.event).toEqual(event);
			expect(manager.getLastPublication()?.report.outcomes[2]?.state).toBe('unavailable');
			await manager.close();
		});

		it('stores below-quorum outcomes and rethrows with the exact signed event', async () => {
			const effects: string[] = [];
			const records: RecoveryRecord[] = [];
			const manager = managerWithPublication(
				async (event) => {
					throw new PublishQuorumError(
						report(event.id, ['accepted', 'rejected', 'unavailable']),
						event,
					);
				},
				effects,
				records,
			);
			try {
				await manager.deleteSecrets('project', 'dev');
				throw new Error('expected failure');
			} catch (error) {
				expect(error).toBeInstanceOf(PublishQuorumError);
				if (error instanceof PublishQuorumError) expect(records[1]?.event).toEqual(error.event);
			}
			expect(effects).toEqual(['save:0', 'publish', 'save:1']);
			await manager.close();
		});

		it('records full acceptance before removing local recovery state', async () => {
			const effects: string[] = [];
			const records: RecoveryRecord[] = [];
			const manager = managerWithPublication(
				async (event) => report(event.id, ['accepted', 'accepted', 'accepted']),
				effects,
				records,
			);
			await manager.publishSecrets('project', 'dev', { KEY: 'value' });
			expect(effects).toEqual(['save:0', 'publish', 'save:3', 'remove']);
			await manager.close();
		});
	});

	describe('disconnect', () => {
		it('owns and zeroizes an internal key copy without mutating the caller buffer', async () => {
			const privateKey = generateSecretKey();
			const original = privateKey.slice();
			const manager = new SecretManager(privateKey);

			await manager.close();

			expect(privateKey).toEqual(original);
			expect(privateKey.some((byte) => byte !== 0)).toBe(true);
		});
	});
});

describe('injectSecrets', () => {
	it('injects string secrets into environment', () => {
		const baseEnv = { PATH: '/usr/bin', HOME: '/home/user' };
		const secrets: SecretBundle = {
			API_KEY: 'secret123',
			DATABASE_URL: 'postgres://localhost',
		};

		const result = injectSecrets(baseEnv, secrets);

		expect(result.PATH).toBe('/usr/bin');
		expect(result.HOME).toBe('/home/user');
		expect(result.API_KEY).toBe('secret123');
		expect(result.DATABASE_URL).toBe('postgres://localhost');
	});

	it('does not mutate original environment', () => {
		const baseEnv = { EXISTING: 'value' };
		const secrets: SecretBundle = { NEW: 'secret' };

		injectSecrets(baseEnv, secrets);

		expect(baseEnv).toEqual({ EXISTING: 'value' });
	});

	it('secrets override existing env vars', () => {
		const baseEnv = { API_KEY: 'old_value' };
		const secrets: SecretBundle = { API_KEY: 'new_value' };

		const result = injectSecrets(baseEnv, secrets);

		expect(result.API_KEY).toBe('new_value');
	});

	it('removes Redshift authentication variables from the child environment', () => {
		const result = injectSecrets(
			{
				PATH: '/usr/bin',
				REDSHIFT_NSEC: 'nsec-secret',
				REDSHIFT_BUNKER: 'bunker://secret',
			},
			{ API_KEY: 'application-secret' },
		);

		expect(result.PATH).toBe('/usr/bin');
		expect(result.API_KEY).toBe('application-secret');
		expect(result.REDSHIFT_NSEC).toBeUndefined();
		expect(result.REDSHIFT_BUNKER).toBeUndefined();
	});

	it('does not allow a secret bundle to reintroduce Redshift auth variables', () => {
		expect(() => injectSecrets({}, { REDSHIFT_NSEC: 'stolen' })).toThrow('REDSHIFT_NSEC');
		expect(() => injectSecrets({}, { REDSHIFT_BUNKER: 'stolen' })).toThrow('REDSHIFT_BUNKER');
	});

	it('rejects runtime startup and dynamic-loader hook names before spawn', () => {
		const blocked = [
			'NODE_OPTIONS',
			'NODE_PATH',
			'PYTHONPATH',
			'PYTHONHOME',
			'PYTHONSTARTUP',
			'RUBYOPT',
			'RUBYLIB',
			'BASH_ENV',
			'ENV',
			'LD_PRELOAD',
			'LD_LIBRARY_PATH',
			'DYLD_INSERT_LIBRARIES',
			'DYLD_LIBRARY_PATH',
			'DYLD_FRAMEWORK_PATH',
			'PERL5OPT',
			'PERL5LIB',
		];

		for (const key of blocked) {
			expect(() => injectSecrets({}, { [key.toLowerCase()]: 'malicious' })).toThrow(key);
		}
	});

	it('does not mutate either environment input', () => {
		const baseEnv = { PATH: '/usr/bin', REDSHIFT_NSEC: 'private' };
		const secrets = { API_KEY: 'secret' };
		const baseSnapshot = { ...baseEnv };
		const secretSnapshot = { ...secrets };

		injectSecrets(baseEnv, secrets);

		expect(baseEnv).toEqual(baseSnapshot);
		expect(secrets).toEqual(secretSnapshot);
	});
});

describe('mergeSecrets', () => {
	it('merges two secret bundles', () => {
		const base: SecretBundle = { A: '1', B: '2' };
		const overlay: SecretBundle = { B: '3', C: '4' };

		const result = mergeSecrets(base, overlay);

		expect(result).toEqual({ A: '1', B: '3', C: '4' });
	});

	it('returns copy when overlay is empty', () => {
		const base: SecretBundle = { A: '1' };
		const result = mergeSecrets(base, {});

		expect(result).toEqual({ A: '1' });
		expect(result).not.toBe(base); // Should be new object
	});
});

describe('extractProjects', () => {
	it('extracts unique project IDs from d-tags', () => {
		const dTags = ['proj1|dev', 'proj1|prod', 'proj2|dev', 'proj3|staging'];
		const projects = extractProjects(dTags);

		expect(projects).toEqual(['proj1', 'proj2', 'proj3']);
	});

	it('returns empty array for empty input', () => {
		expect(extractProjects([])).toEqual([]);
	});

	it('ignores invalid d-tags', () => {
		const dTags = ['proj1|dev', 'invalid', '', 'proj2|prod'];
		const projects = extractProjects(dTags);

		expect(projects).toEqual(['proj1', 'proj2']);
	});
});
