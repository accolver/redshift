import fc from 'fast-check';
import { parse as parseYamlDocument } from 'yaml';
import { describe, expect, it } from 'vitest';
import { calculateMissingSecrets, removeSecret, upsertSecret } from '$lib/models/secrets';
import {
	exportToCsv,
	exportToEnv,
	exportToJson,
	exportToYaml,
	parseCsv,
	parseEnv,
	parseJson,
	parseYaml,
} from '$lib/models/secrets-export';
import { fuzzyMatch, matchScore, searchAndSort } from '$lib/utils/search';
import type { Secret } from '$lib/types/nostr';
import { fuzzParameters, syntheticString } from '../../../tests/helpers/fuzz';

const secretKey = fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,31}$/);
const secretValue = syntheticString({ maxLength: 128, allowNul: false });
const secrets = fc.uniqueArray(fc.record({ key: secretKey, value: secretValue }), {
	maxLength: 20,
	selector: (secret) => secret.key,
});
const environmentSlug = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);

describe('web property tests', () => {
	it('keeps fuzzy matching and score classification consistent', () => {
		fc.assert(
			fc.property(
				syntheticString({ maxLength: 128 }),
				syntheticString({ maxLength: 64 }),
				(text, query) => {
					const score = matchScore(text, query);
					expect(Number.isInteger(score)).toBe(true);
					expect(score).toBeGreaterThanOrEqual(-1);
					expect(score).toBeLessThanOrEqual(100);
					expect(fuzzyMatch(text, query)).toBe(score >= 0);
				},
			),
			fuzzParameters('web search score consistency'),
		);
	});

	it('returns an immutable score-ordered subset of search inputs', () => {
		const item = fc.record({ id: fc.uuid(), text: syntheticString({ maxLength: 64 }) });
		fc.assert(
			fc.property(
				fc.array(item, { maxLength: 40 }),
				syntheticString({ maxLength: 32 }),
				(items, query) => {
					const snapshot = structuredClone(items);
					const expected = items
						.map((candidate, index) => ({
							candidate,
							index,
							score: matchScore(candidate.text, query),
						}))
						.filter(({ score }) => score >= 0)
						.sort((left, right) => right.score - left.score || left.index - right.index)
						.map(({ candidate }) => candidate);
					const result = searchAndSort(items, query, (candidate) => candidate.text);
					expect(items).toEqual(snapshot);
					expect(result).toEqual(expected);
				},
			),
			fuzzParameters('web search immutable ordered subset'),
		);
	});

	it('keeps secret upsert and removal immutable and idempotent', () => {
		fc.assert(
			fc.property(secrets, secretKey, secretValue, (source, key, value) => {
				const snapshot = structuredClone(source);
				const upserted = upsertSecret(source, key, value);
				expect(source).toEqual(snapshot);
				expect(upsertSecret(upserted, key, value)).toEqual(upserted);
				expect(upserted.filter((secret) => secret.key === key)).toEqual([{ key, value }]);
				const removed = removeSecret(upserted, key);
				expect(upserted.some((secret) => secret.key === key)).toBe(true);
				expect(removed.some((secret) => secret.key === key)).toBe(false);
				expect(removeSecret(removed, key)).toEqual(removed);
			}),
			fuzzParameters('web secret collection algebra'),
		);
	});

	it('calculates missing secrets independently of environment insertion order', () => {
		const environment = fc.record({ slug: environmentSlug, secrets });
		fc.assert(
			fc.property(
				fc.uniqueArray(environment, {
					minLength: 1,
					maxLength: 8,
					selector: (candidate) => candidate.slug,
				}),
				fc.integer({ min: 0, max: 100 }),
				(environments, currentIndex) => {
					const current = environments[currentIndex % environments.length]?.slug ?? 'dev';
					const forward = new Map<string, Secret[]>(
						environments.map((environment) => [environment.slug, environment.secrets]),
					);
					const reverse = new Map<string, Secret[]>(
						[...environments]
							.reverse()
							.map((environment) => [environment.slug, environment.secrets]),
					);
					expect(calculateMissingSecrets(reverse, current)).toEqual(
						calculateMissingSecrets(forward, current),
					);
				},
			),
			fuzzParameters('web missing secret insertion order'),
		);
	});

	it('round-trips valid secret collections through every supported export format', () => {
		fc.assert(
			fc.property(secrets, (values) => {
				const yaml = exportToYaml(values);
				expect(parseEnv(exportToEnv(values))).toEqual(values);
				expect(parseJson(exportToJson(values))).toEqual(values);
				expect(parseYaml(yaml)).toEqual(values);
				expect(parseYamlDocument(yaml || '{}')).toEqual(
					Object.fromEntries(values.map(({ key, value }) => [key, value])),
				);
				expect(parseCsv(exportToCsv(values))).toEqual(values);
			}),
			fuzzParameters('web secret export round trips'),
		);
	});
});
