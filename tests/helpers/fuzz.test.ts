import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import {
	SYNTHETIC_STRING_BOUNDARIES,
	deriveFuzzSeed,
	fuzzParameters,
	syntheticString,
} from './fuzz';

describe('deterministic fuzz configuration', () => {
	it('derives stable property-specific signed 32-bit seeds', () => {
		expect(deriveFuzzSeed('env round trip', 0x52454453)).toBe(
			deriveFuzzSeed('env round trip', 0x52454453),
		);
		expect(deriveFuzzSeed('env round trip', 0x52454453)).not.toBe(
			deriveFuzzSeed('history pagination', 0x52454453),
		);
		expect(Number.isInteger(deriveFuzzSeed('signed seed', 0xffffffff))).toBe(true);
		expect(deriveFuzzSeed('signed seed', 0xffffffff)).toBeGreaterThanOrEqual(-0x80000000);
		expect(deriveFuzzSeed('signed seed', 0xffffffff)).toBeLessThanOrEqual(0x7fffffff);
	});

	it('uses bounded deterministic defaults and property-specific overrides', () => {
		const parameters = fuzzParameters('default property', {}, {});
		expect(parameters).toMatchObject({
			seed: deriveFuzzSeed('default property', 0x52454453),
			numRuns: 250,
			interruptAfterTimeLimit: 30_000,
			markInterruptAsFailure: true,
		});
		expect(parameters.reporter).toBeTypeOf('function');
		expect(
			fuzzParameters('small property', { defaultRuns: 25, defaultTimeMs: 5_000 }, {}),
		).toMatchObject({ numRuns: 25, interruptAfterTimeLimit: 5_000 });
	});

	it('accepts replayable decimal and hexadecimal environment overrides', () => {
		const decimal = fuzzParameters(
			'replay',
			{},
			{
				REDSHIFT_FUZZ_SEED: '-42',
				REDSHIFT_FUZZ_RUNS: '1000',
				REDSHIFT_FUZZ_TIME_MS: '45000',
			},
		);
		const hexadecimal = fuzzParameters(
			'replay',
			{},
			{
				REDSHIFT_FUZZ_SEED: '0xFFFFFFD6',
				REDSHIFT_FUZZ_RUNS: '1000',
				REDSHIFT_FUZZ_TIME_MS: '45000',
			},
		);
		expect(decimal.seed).toBe(hexadecimal.seed);
		expect(decimal.numRuns).toBe(hexadecimal.numRuns);
		expect(decimal.interruptAfterTimeLimit).toBe(hexadecimal.interruptAfterTimeLimit);
		expect(decimal.numRuns).toBe(1000);
		expect(decimal.interruptAfterTimeLimit).toBe(45_000);
		expect(fuzzParameters('replay', {}, { REDSHIFT_FUZZ_PATH: '0:2:1' }).path).toBe('0:2:1');
	});

	it('generates bounded synthetic strings with explicit control-character coverage', () => {
		fc.assert(
			fc.property(syntheticString({ maxLength: 32, allowNul: false }), (value) => {
				expect(value.length).toBeLessThanOrEqual(32);
				expect(value).not.toContain('\0');
			}),
			fuzzParameters('synthetic string bounds'),
		);
		const samples = fc.sample(syntheticString({ maxLength: 32 }), { seed: 42, numRuns: 2_000 });
		for (const boundary of SYNTHETIC_STRING_BOUNDARIES) {
			expect(samples.some((value) => value.includes(boundary))).toBe(true);
		}
		for (const maxLength of [511, 512, 513, 2_048]) {
			const boundarySamples = fc.sample(syntheticString({ maxLength }), {
				seed: 42,
				numRuns: 2_000,
			});
			expect(boundarySamples.some((value) => value.length === maxLength)).toBe(true);
			expect(boundarySamples.every((value) => value.length <= maxLength)).toBe(true);
		}
	});

	it('adds replay metadata and reproduces the same minimized shrink path', () => {
		const property = fc.property(fc.integer({ min: 0, max: 100 }), (value) => value < 10);
		const captureFailure = (environment: {
			REDSHIFT_FUZZ_SEED: string;
			REDSHIFT_FUZZ_PATH?: string;
		}) => {
			try {
				fc.assert(property, fuzzParameters('replay metadata', { defaultRuns: 100 }, environment));
				throw new Error('Expected the replay property to fail');
			} catch (error) {
				if (!(error instanceof Error) || error.message === 'Expected the replay property to fail') {
					throw error;
				}
				return error.message;
			}
		};
		const initial = captureFailure({ REDSHIFT_FUZZ_SEED: '42' });
		const path = /path: "([0-9:]+)"/.exec(initial)?.[1];
		const counterexample = /Counterexample: (\[[^\n]+\])/.exec(initial)?.[1];
		if (!path || !counterexample) throw new Error('Missing fast-check shrink replay metadata');
		const replay = captureFailure({ REDSHIFT_FUZZ_SEED: '42', REDSHIFT_FUZZ_PATH: path });
		expect(replay).toContain(`Counterexample: ${counterexample}`);
		expect(replay).toContain('Shrunk 0 time(s)');
	});

	it('fails closed for malformed or unbounded overrides', () => {
		for (const environment of [
			{ REDSHIFT_FUZZ_SEED: '1.5' },
			{ REDSHIFT_FUZZ_SEED: 'not-a-seed' },
			{ REDSHIFT_FUZZ_SEED: '0x100000000' },
			{ REDSHIFT_FUZZ_RUNS: '0' },
			{ REDSHIFT_FUZZ_RUNS: '100001' },
			{ REDSHIFT_FUZZ_TIME_MS: '999' },
			{ REDSHIFT_FUZZ_TIME_MS: '600001' },
			{ REDSHIFT_FUZZ_PATH: '../escape' },
			{ REDSHIFT_FUZZ_PATH: '0:'.repeat(2_049) },
		]) {
			expect(() => fuzzParameters('invalid configuration', {}, environment)).toThrow(
				'Invalid Redshift fuzz configuration',
			);
		}
	});
});
