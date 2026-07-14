import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { fuzzParameters, syntheticString } from '../../../tests/helpers/fuzz';
import {
	compareSecretHistoryVersions,
	createDTag,
	createHistoryCursor,
	createSecretHistoryObservation,
	decodeBackupPayload,
	decodeHistoryCursor,
	decryptBackup,
	encodeBackupPayload,
	formatEnvLine,
	normalizeSlug,
	paginateSecretHistory,
	parseDTag,
	parseEnvFileDetailed,
	unwrapGiftWrap,
	validateBackupPayload,
	validateNip44CiphertextStructure,
	validateSlug,
	wrapSecrets,
	type BackupPayloadV1,
	type SecretBundle,
	type UnwrapResult,
} from '../src';

const slugSegment = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const slug = fc
	.array(slugSegment, { minLength: 1, maxLength: 3 })
	.map((segments) => segments.join('-'));
const envKey = fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_]{0,31}$/);
const secretKey = fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,31}$/);
const secretValue = syntheticString({ maxLength: 128 });
const hexId = fc
	.uint8Array({ minLength: 32, maxLength: 32 })
	.map((bytes) => Buffer.from(bytes).toString('hex'));
const safeSecretValue = secretValue.filter((value) => !value.includes('\0'));
const secretPairs = fc
	.uniqueArray(fc.tuple(secretKey, safeSecretValue), {
		minLength: 1,
		maxLength: 8,
		selector: ([key]) => key,
	})
	.map((pairs) => [...pairs].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));

const backupPayload = fc
	.record({
		createdAt: fc.nat({ max: 2_000_000_000 }),
		sourcePubkey: hexId,
		project: slug,
		environment: slug,
		sourceCreatedAt: fc.nat({ max: 2_000_000_000 }),
		sourceEventId: hexId,
		secrets: secretPairs,
	})
	.map(
		({
			createdAt,
			sourcePubkey,
			project,
			environment,
			sourceCreatedAt,
			sourceEventId,
			secrets,
		}): BackupPayloadV1 => ({
			schema: 'com.redshiftapp.backup',
			version: 1,
			createdAt,
			sourcePubkey,
			contents: {
				secretState: 'current-observed',
				projectMetadata: 'identifiers-only',
				relayConfiguration: 'excluded',
				signerCredentials: 'excluded',
				historyAndTombstones: 'excluded',
			},
			entries: [{ project, environment, sourceCreatedAt, sourceEventId, secrets }],
		}),
	);

function secretBundle(pairs: Array<[string, string]>): SecretBundle {
	return Object.fromEntries(pairs);
}

function historyVersion(eventId: string, createdAt: number, secrets: SecretBundle): UnwrapResult {
	return {
		eventId,
		createdAt,
		secrets,
		dTag: 'project|dev',
		pubkey: 'a'.repeat(64),
	};
}

describe('shared crypto property tests', () => {
	it('round-trips every formatted environment value exactly', () => {
		fc.assert(
			fc.property(envKey, secretValue, (key, value) => {
				const parsed = parseEnvFileDetailed(formatEnvLine(key, value));
				expect(parsed.issues).toEqual([]);
				expect(parsed.secrets).toEqual({ [key]: value });
			}),
			fuzzParameters('env format parse round trip'),
		);
	});

	it('reports the exact line for generated malformed environment entries', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(fc.tuple(envKey, secretValue), {
					maxLength: 20,
					selector: ([key]) => key,
				}),
				fc.nat(),
				(pairs, insertionSeed) => {
					const lines = pairs.map(([key, value]) => formatEnvLine(key, value));
					const insertionIndex = insertionSeed % (lines.length + 1);
					lines.splice(insertionIndex, 0, 'malformed');
					const parsed = parseEnvFileDetailed(lines.join('\n'));
					expect(parsed.issues).toEqual([
						{ line: insertionIndex + 1, message: 'expected KEY=value' },
					]);
					expect(parsed.secrets).toEqual(Object.fromEntries(pairs));
				},
			),
			fuzzParameters('env malformed line reporting'),
		);
	});

	it('keeps slug normalization idempotent and validation equivalent to the contract', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 100 }), (input) => {
				const normalized = normalizeSlug(input);
				expect(normalizeSlug(normalized)).toBe(normalized);
				const expected =
					normalized.length >= 1 &&
					normalized.length <= 64 &&
					/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized) &&
					!normalized.includes('--');
				expect(validateSlug(normalized).valid).toBe(expected);
			}),
			fuzzParameters('slug normalization and validation'),
		);
	});

	it('round-trips every non-empty d-tag component that excludes the delimiter', () => {
		const component = fc
			.string({ minLength: 1, maxLength: 64 })
			.filter((value) => !value.includes('|'));
		fc.assert(
			fc.property(component, component, (projectId, environment) => {
				const encoded = createDTag(projectId, environment);
				expect(parseDTag(encoded)).toEqual({ projectId, environment });
			}),
			fuzzParameters('d-tag round trip'),
		);
	});

	it('canonically round-trips bounded backup payloads and rejects trailing bytes', () => {
		fc.assert(
			fc.property(backupPayload, (payload) => {
				const canonical = validateBackupPayload(payload);
				const encoded = encodeBackupPayload(canonical);
				expect(decodeBackupPayload(encoded)).toEqual(canonical);
				const withTrailingWhitespace = new Uint8Array(encoded.length + 1);
				withTrailingWhitespace.set(encoded);
				withTrailingWhitespace[encoded.length] = 0x20;
				expect(() => decodeBackupPayload(withTrailingWhitespace)).toThrow('canonical');
			}),
			fuzzParameters('backup canonical payload round trip'),
		);
	});

	it('rejects arbitrary backup values or returns a stable canonical payload', () => {
		fc.assert(
			fc.property(fc.jsonValue(), (value) => {
				let validated: BackupPayloadV1;
				try {
					validated = validateBackupPayload(value);
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
					return;
				}
				expect(validateBackupPayload(validated)).toEqual(validated);
				expect(decodeBackupPayload(encodeBackupPayload(validated))).toEqual(validated);
			}),
			fuzzParameters('backup arbitrary payload rejection'),
		);
	});

	it('rejects arbitrary backup archives before invoking key derivation', async () => {
		await fc.assert(
			fc.asyncProperty(fc.uint8Array({ maxLength: 512 }), async (archive) => {
				let deriveKeyCalled = false;
				try {
					await decryptBackup(archive, 'synthetic fuzz passphrase', {
						deriveKey: async () => {
							deriveKeyCalled = true;
							return new Uint8Array(32).fill(1);
						},
					});
					throw new Error('Arbitrary archive unexpectedly authenticated');
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
					expect((error as Error).message).not.toBe('Arbitrary archive unexpectedly authenticated');
					expect(deriveKeyCalled).toBe(false);
				}
			}),
			fuzzParameters('backup malformed archive pre-KDF rejection'),
		);
	});

	it('fails closed for arbitrary NIP-44 structures', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 4_096 }), (payload) => {
				try {
					validateNip44CiphertextStructure(payload);
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
					return;
				}
				expect(payload.length).toBeGreaterThanOrEqual(132);
				expect(payload.length % 4).toBe(0);
				expect(payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
				expect(atob(payload.slice(0, 4)).charCodeAt(0)).toBe(2);
			}),
			fuzzParameters('NIP-44 arbitrary structure rejection'),
		);
	});

	it('round-trips bounded NIP-59 bundles with exact owner and d-tag metadata', () => {
		const ownerKey = new Uint8Array(32).fill(7);
		fc.assert(
			fc.property(
				secretPairs,
				slug,
				slug,
				fc.nat({ max: 2_000_000_000 }),
				(pairs, project, environment, createdAt) => {
					const secrets = secretBundle(pairs);
					const dTag = createDTag(project, environment);
					const { event } = wrapSecrets(secrets, ownerKey, dTag, { createdAt });
					expect(() => validateNip44CiphertextStructure(event.content)).not.toThrow();
					const unwrapped = unwrapGiftWrap(event, ownerKey, { now: createdAt });
					expect(unwrapped.secrets).toEqual(secrets);
					expect(unwrapped.dTag).toBe(dTag);
					expect(unwrapped.createdAt).toBe(createdAt);
					expect(unwrapped.eventId).toBe(event.id);
					const tamperedContent = `${event.content[0] === 'A' ? 'B' : 'A'}${event.content.slice(1)}`;
					expect(() =>
						unwrapGiftWrap({ ...event, content: tamperedContent }, ownerKey, { now: createdAt }),
					).toThrow();
				},
			),
			fuzzParameters('NIP-59 exact round trip', { defaultRuns: 75 }),
		);
	}, 120_000);

	it('orders history independently of input order and paginates without gaps', () => {
		const generatedVersion = fc.record({
			eventId: hexId,
			createdAt: fc.nat({ max: 2_000_000_000 }),
			secrets: fc.dictionary(secretKey, secretValue, { maxKeys: 5 }),
		});
		fc.assert(
			fc.property(
				fc.uniqueArray(generatedVersion, {
					minLength: 1,
					maxLength: 25,
					selector: (candidate) => candidate.eventId,
				}),
				fc.integer({ min: 1, max: 10 }),
				fc.nat(),
				fc.boolean(),
				(candidates, limit, rotation, reverseRotation) => {
					const input = candidates.map((candidate) =>
						historyVersion(candidate.eventId, candidate.createdAt, candidate.secrets),
					);
					const offset = rotation % input.length;
					const rotated = [...input.slice(offset), ...input.slice(0, offset)];
					const permuted = reverseRotation ? rotated.reverse() : rotated;
					const observation = createSecretHistoryObservation(permuted, input.length, false);
					const expectedVersions = [...candidates]
						.sort(
							(left, right) =>
								right.createdAt - left.createdAt ||
								(left.eventId < right.eventId ? -1 : left.eventId > right.eventId ? 1 : 0),
						)
						.map((candidate, index) => ({
							eventId: candidate.eventId,
							dTag: 'project|dev',
							createdAt: candidate.createdAt,
							secrets: { ...candidate.secrets },
							tombstone: Object.keys(candidate.secrets).length === 0,
							current: index === 0,
						}));
					expect(observation).toEqual({
						versions: expectedVersions,
						observedEvents: input.length,
						truncated: false,
					});

					const collected: string[] = [];
					let cursor: string | undefined;
					do {
						const page = paginateSecretHistory(
							observation,
							cursor === undefined ? { limit } : { limit, cursor },
						);
						collected.push(...page.items.map((item) => item.eventId));
						cursor = page.nextCursor ?? undefined;
					} while (cursor !== undefined);
					expect(collected).toEqual(expectedVersions.map((item) => item.eventId));
					expect(new Set(collected).size).toBe(collected.length);

					const observationSnapshot = structuredClone(observation);
					const defensivePage = paginateSecretHistory(observation, { limit: 1 });
					if (defensivePage.items[0]) defensivePage.items[0].secrets.__FUZZ = 'mutated';
					expect(observation).toEqual(observationSnapshot);
				},
			),
			fuzzParameters('history permutation and pagination'),
		);
	});

	it('round-trips every valid history cursor and partitions comparison keys exactly once', () => {
		fc.assert(
			fc.property(
				fc.nat({ max: Number.MAX_SAFE_INTEGER }),
				hexId,
				fc.dictionary(secretKey, secretValue, { maxKeys: 8 }),
				fc.dictionary(secretKey, secretValue, { maxKeys: 8 }),
				(createdAt, eventId, fromSecrets, toSecrets) => {
					const cursor = createHistoryCursor({ createdAt, eventId });
					expect(decodeHistoryCursor(cursor)).toEqual({ createdAt, eventId });

					const diff = compareSecretHistoryVersions(
						{ dTag: 'project|dev', secrets: fromSecrets },
						{ dTag: 'project|dev', secrets: toSecrets },
					);
					const allKeys = [
						...new Set([...Object.keys(fromSecrets), ...Object.keys(toSecrets)]),
					].sort();
					const inFrom = (key: string) => Object.hasOwn(fromSecrets, key);
					const inTo = (key: string) => Object.hasOwn(toSecrets, key);
					const expected = {
						added: allKeys.filter((key) => !inFrom(key) && inTo(key)),
						removed: allKeys.filter((key) => inFrom(key) && !inTo(key)),
						changed: allKeys.filter(
							(key) => inFrom(key) && inTo(key) && fromSecrets[key] !== toSecrets[key],
						),
						unchanged: allKeys.filter(
							(key) => inFrom(key) && inTo(key) && fromSecrets[key] === toSecrets[key],
						),
					};
					expect(diff).toEqual(expected);
				},
			),
			fuzzParameters('history cursor and diff partition'),
		);
	});
});
