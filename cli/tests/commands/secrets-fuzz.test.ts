import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { formatEnvLine } from '@redshift/crypto';
import { fuzzParameters, syntheticString } from '../../../tests/helpers/fuzz';
import { parseSecretUpload, prepareSecretsForOutput } from '../../src/commands/secrets';

const uploadKey = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,15}$/).map((key) => `FUZZ_${key}`);
const uploadValue = syntheticString({ maxLength: 128, allowNul: false });

describe('CLI secret boundary property tests', () => {
	it('round-trips valid uploads after canonical key normalization', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(fc.tuple(uploadKey, uploadValue), {
					minLength: 1,
					maxLength: 20,
					selector: ([key]) => key.toUpperCase(),
				}),
				(pairs) => {
					const content = pairs.map(([key, value]) => formatEnvLine(key, value)).join('\n');
					const expected = Object.fromEntries(
						pairs.map(([key, value]) => [key.toUpperCase(), value]),
					);
					expect(parseSecretUpload(content)).toEqual(expected);
				},
			),
			fuzzParameters('CLI secret upload round trip'),
		);
	});

	it('rejects every duplicate created by case normalization', () => {
		fc.assert(
			fc.property(uploadKey, uploadValue, uploadValue, (key, first, second) => {
				const content = [
					formatEnvLine(key.toLowerCase(), first),
					formatEnvLine(key.toUpperCase(), second),
				].join('\n');
				expect(() => parseSecretUpload(content)).toThrow(
					`duplicate key after normalization: ${key.toUpperCase()}`,
				);
			}),
			fuzzParameters('CLI normalized duplicate rejection'),
		);
	});

	it('either rejects arbitrary files with an Error or returns injectable canonical secrets', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 2_048 }), (content) => {
				let parsed: Record<string, string>;
				try {
					parsed = parseSecretUpload(content);
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
					return;
				}
				for (const [key, value] of Object.entries(parsed)) {
					expect(key).toMatch(/^[A-Z_][A-Z0-9_]*$/);
					expect(key.length).toBeLessThanOrEqual(256);
					expect(value.length).toBeLessThanOrEqual(65_536);
					expect(value).not.toContain('\0');
				}
			}),
			fuzzParameters('CLI arbitrary upload rejection'),
		);
	});

	it('never exposes non-empty values when raw output is disabled', () => {
		fc.assert(
			fc.property(fc.dictionary(uploadKey, uploadValue, { maxKeys: 20 }), (secrets) => {
				const redacted = prepareSecretsForOutput(secrets, false);
				const raw = prepareSecretsForOutput(secrets, true);
				expect(raw).toEqual(secrets);
				for (const [key, value] of Object.entries(secrets)) {
					expect(redacted[key]).toBe(value.length > 0 ? '****' : '(empty)');
				}
			}),
			fuzzParameters('CLI output redaction'),
		);
	});
});
