/**
 * Gift Wrap Secrets Model Tests
 *
 * Tests the gift-wrap-secrets model functions for:
 * - Human-friendly project names in d-tags
 * - Proper d-tag creation and parsing
 * - Environment handling
 *
 * Note: Cryptographic operations (wrapSecrets, unwrapGiftWrap) are tested
 * in packages/crypto/tests where they run with Bun's native crypto support.
 */

import { describe, expect, it } from 'vitest';
import { EventStore } from 'applesauce-core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { generateSecretKey } from 'nostr-tools/pure';
import {
	HISTORY_LIMITS,
	type NostrEvent,
	type UnwrapResult,
	createDTag,
	parseDTag,
	wrapSecrets,
} from '@redshift/crypto';
import {
	GiftWrapHistoryModel,
	GiftWrapSecretsModel,
	boundRedshiftHistoryEvents,
	clearDecryptionCache,
	createSharedDecryptionPipeline,
} from '../../src/lib/models/gift-wrap-secrets';

describe('D-Tag Operations', () => {
	describe('createDTag with project names', () => {
		it('creates d-tag with human-friendly project name', () => {
			const dTag = createDTag('keyfate', 'production');
			expect(dTag).toBe('keyfate|production');
		});

		it('creates d-tag with short environment slug', () => {
			const dTag = createDTag('myapp', 'prd');
			expect(dTag).toBe('myapp|prd');
		});

		it('handles various project name formats', () => {
			const testCases = [
				{ project: 'simple', env: 'prod', expected: 'simple|prod' },
				{ project: 'my-project', env: 'staging', expected: 'my-project|staging' },
				{ project: 'my_project', env: 'test', expected: 'my_project|test' },
				{ project: 'Project2024', env: 'v1', expected: 'Project2024|v1' },
				{ project: 'acme-corp-api', env: 'us-east-1', expected: 'acme-corp-api|us-east-1' },
			];

			for (const { project, env, expected } of testCases) {
				const dTag = createDTag(project, env);
				expect(dTag).toBe(expected);
			}
		});
	});

	describe('parseDTag', () => {
		it('parses d-tag back to project name and environment', () => {
			const dTag = createDTag('keyfate', 'dev');
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: 'keyfate',
				environment: 'dev',
			});
		});

		it('parses d-tag with various formats', () => {
			const testCases = [
				{ dTag: 'simple|prod', projectId: 'simple', environment: 'prod' },
				{ dTag: 'my-project|staging', projectId: 'my-project', environment: 'staging' },
				{ dTag: 'Project2024|v1', projectId: 'Project2024', environment: 'v1' },
			];

			for (const { dTag, projectId, environment } of testCases) {
				const parsed = parseDTag(dTag);
				expect(parsed).toEqual({ projectId, environment });
			}
		});

		it('returns null for invalid d-tags', () => {
			expect(parseDTag('invalid')).toBeNull();
			expect(parseDTag('')).toBeNull();
			expect(parseDTag('no-separator')).toBeNull();
		});
	});

	describe('CLI and Web compatibility', () => {
		it('creates d-tags that CLI can understand', () => {
			const projectName = 'keyfate';
			const env = 'production';

			const dTag = createDTag(projectName, env);

			// CLI parses with parseDTag
			const parsed = parseDTag(dTag);
			expect(parsed).not.toBeNull();
			expect(parsed!.projectId).toBe(projectName);
			expect(parsed!.environment).toBe(env);
		});

		it('maintains consistency across multiple creates and parses', () => {
			const projectName = 'test-project';
			const environments = ['dev', 'staging', 'prd', 'production'];

			for (const env of environments) {
				const dTag = createDTag(projectName, env);
				const parsed = parseDTag(dTag);
				const recreatedDTag = createDTag(parsed!.projectId, parsed!.environment);

				expect(recreatedDTag).toBe(dTag);
			}
		});
	});
});

describe('Bundle to Secrets Conversion', () => {
	it('converts simple string values', () => {
		const bundle = { API_KEY: 'secret123', DB_URL: 'postgres://localhost' };
		const secrets = Object.entries(bundle).map(([key, value]) => ({
			key,
			value: typeof value === 'string' ? value : JSON.stringify(value),
		}));

		expect(secrets).toHaveLength(2);
		expect(secrets.find((s) => s.key === 'API_KEY')?.value).toBe('secret123');
		expect(secrets.find((s) => s.key === 'DB_URL')?.value).toBe('postgres://localhost');
	});

	it('converts non-string values to JSON', () => {
		const bundle = {
			CONFIG: { nested: true },
			COUNT: 42,
			FLAG: true,
		};
		const secrets = Object.entries(bundle).map(([key, value]) => ({
			key,
			value: typeof value === 'string' ? value : JSON.stringify(value),
		}));

		expect(secrets.find((s) => s.key === 'CONFIG')?.value).toBe('{"nested":true}');
		expect(secrets.find((s) => s.key === 'COUNT')?.value).toBe('42');
		expect(secrets.find((s) => s.key === 'FLAG')?.value).toBe('true');
	});
});

describe('Authenticated history model', () => {
	it('orders ties, marks tombstones, deduplicates, and caps versions', async () => {
		const results: Array<{ event: NostrEvent; result: UnwrapResult }> = Array.from(
			{ length: HISTORY_LIMITS.maxVersionsPerDTag + 2 },
			(_, index) => ({
				event: {
					id: index.toString(16).padStart(64, '0'),
					pubkey: 'a'.repeat(64),
					created_at: index,
					kind: 1059,
					tags: [],
					content: 'encrypted',
					sig: 'b'.repeat(128),
				},
				result: {
					eventId: index.toString(16).padStart(64, '0'),
					createdAt: index < 2 ? 500 : 500 - index,
					dTag: 'project|dev',
					pubkey: 'f'.repeat(64),
					secrets: (index === 0 ? {} : { KEY: String(index) }) as Record<string, string>,
				},
			}),
		);
		results.push(results[0]!);
		results.push({
			event: {
				id: 'e'.repeat(64),
				pubkey: 'a'.repeat(64),
				created_at: 999,
				kind: 1059,
				tags: [],
				content: 'encrypted',
				sig: 'b'.repeat(128),
			},
			result: {
				eventId: 'e'.repeat(64),
				createdAt: 999,
				dTag: 'other|dev',
				pubkey: 'f'.repeat(64),
				secrets: { OTHER: 'secret' },
			},
		});
		const history = await firstValueFrom(
			GiftWrapHistoryModel(
				{} as EventStore,
				{ type: 'privateKey', key: new Uint8Array(32) },
				'project',
				'dev',
				of({ events: results, observedEvents: results.length - 1, truncated: true }),
			),
		);
		expect(history.versions).toHaveLength(HISTORY_LIMITS.maxVersionsPerDTag);
		expect(history.versions[0]).toMatchObject({
			eventId: '0'.repeat(64),
			current: true,
			tombstone: true,
		});
		expect(history.versions[1]?.eventId).toBe('1'.padStart(64, '0'));
		expect(history.truncated).toBe(true);
	});

	it('caps and marks the real pipeline before attempting decryption', async () => {
		clearDecryptionCache();
		const events = Array.from({ length: HISTORY_LIMITS.maxObservedEvents + 5 }, (_, index) => ({
			id: index.toString(16).padStart(64, '0'),
			pubkey: 'a'.repeat(64),
			created_at: index,
			kind: 1059,
			tags: [
				['p', 'f'.repeat(64)],
				['t', 'redshift-secrets'],
			],
			content: 'structurally-invalid',
			sig: 'b'.repeat(128),
		})) as NostrEvent[];
		const eventStore = {
			timeline: () => of(events),
		} as unknown as EventStore;
		const batch = await firstValueFrom(
			createSharedDecryptionPipeline(eventStore, {
				type: 'privateKey',
				key: generateSecretKey(),
			}),
		);
		expect(batch.observedEvents).toBe(HISTORY_LIMITS.maxObservedEvents + 5);
		expect(batch.truncated).toBe(true);
		expect(batch.events).toEqual([]);
		const oneMiB = 'x'.repeat(1024 * 1024);
		const aggregate = boundRedshiftHistoryEvents(
			events.slice(0, 17).map((event, index) => ({
				...event,
				id: `f${index.toString(16).padStart(63, '0')}`,
				content: oneMiB,
			})),
		);
		expect(aggregate.events).toHaveLength(16);
		expect(aggregate.truncated).toBe(true);
		await expect(
			firstValueFrom(
				GiftWrapSecretsModel(
					eventStore,
					{ type: 'privateKey', key: generateSecretKey() },
					'project',
					'dev',
					of(batch),
				),
			),
		).rejects.toThrow('current selection is blocked');
	});

	it('tears down the replayed source after the final subscriber leaves', async () => {
		clearDecryptionCache();
		const privateKey = generateSecretKey();
		const { event } = wrapSecrets({ API_KEY: 'secret' }, privateKey, 'project|dev');
		let activeSubscriptions = 0;
		const eventStore = {
			timeline: () =>
				new Observable<NostrEvent[]>((subscriber) => {
					activeSubscriptions += 1;
					subscriber.next([event]);
					return () => {
						activeSubscriptions -= 1;
					};
				}),
		} as unknown as EventStore;
		const pipeline = createSharedDecryptionPipeline(eventStore, {
			type: 'privateKey',
			key: privateKey,
		});
		const first = pipeline.subscribe();
		const second = pipeline.subscribe();
		expect(activeSubscriptions).toBe(1);
		first.unsubscribe();
		expect(activeSubscriptions).toBe(1);
		second.unsubscribe();
		expect(activeSubscriptions).toBe(0);
		const third = pipeline.subscribe();
		expect(activeSubscriptions).toBe(1);
		third.unsubscribe();
		expect(activeSubscriptions).toBe(0);
	});

	it('aborts and retries an uncertain remote-signer decryption instead of caching omission', async () => {
		clearDecryptionCache();
		const privateKey = generateSecretKey();
		const { event } = wrapSecrets({ API_KEY: 'secret' }, privateKey, 'project|dev');
		const eventStore = new EventStore();
		eventStore.add(event);
		let calls = 0;
		const decryptor = {
			type: 'decryptFn' as const,
			expectedAuthor: event.tags.find((tag) => tag[0] === 'p')![1]!,
			fn: async () => {
				calls += 1;
				throw new Error('Bunker transport disconnected');
			},
		};
		await expect(
			firstValueFrom(createSharedDecryptionPipeline(eventStore, decryptor)),
		).rejects.toThrow('remote signer');
		await expect(
			firstValueFrom(createSharedDecryptionPipeline(eventStore, decryptor)),
		).rejects.toThrow('remote signer');
		expect(calls).toBe(2);
	});

	it('fails closed and retries when a remote signer reports invalid ciphertext', async () => {
		clearDecryptionCache();
		const privateKey = generateSecretKey();
		const { event } = wrapSecrets({ API_KEY: 'secret' }, privateKey, 'project|dev');
		const eventStore = new EventStore();
		eventStore.add(event);
		let calls = 0;
		const decryptor = {
			type: 'decryptFn' as const,
			expectedAuthor: event.tags.find((tag) => tag[0] === 'p')![1]!,
			fn: async () => {
				calls += 1;
				throw new Error('Invalid MAC');
			},
		};
		await expect(
			firstValueFrom(createSharedDecryptionPipeline(eventStore, decryptor)),
		).rejects.toThrow('remote signer');
		await expect(
			firstValueFrom(createSharedDecryptionPipeline(eventStore, decryptor)),
		).rejects.toThrow('remote signer');
		expect(calls).toBe(2);
	});
});

describe('Environment Filtering', () => {
	it('correctly identifies target d-tag for filtering', () => {
		const projectName = 'keyfate';
		const targetEnv = 'production';
		const targetDTag = `${projectName}|${targetEnv}`;

		expect(targetDTag).toBe('keyfate|production');
		expect(`${projectName}|dev`).not.toBe(targetDTag);
		expect(`other-project|${targetEnv}`).not.toBe(targetDTag);
	});

	it('creates correct target d-tags for multiple environments', () => {
		const projectName = 'keyfate';
		const environments = ['dev', 'staging', 'prd'];
		const targetDTags = new Set(environments.map((env) => `${projectName}|${env}`));

		expect(targetDTags.has('keyfate|dev')).toBe(true);
		expect(targetDTags.has('keyfate|staging')).toBe(true);
		expect(targetDTags.has('keyfate|prd')).toBe(true);
		expect(targetDTags.has('keyfate|production')).toBe(false);
		expect(targetDTags.has('other|dev')).toBe(false);
	});
});
