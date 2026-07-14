import fc, {
	defaultReportMessage,
	type Arbitrary,
	type Parameters,
	type RunDetails,
} from 'fast-check';

const DEFAULT_FUZZ_SEED = 0x52454453;
const DEFAULT_FUZZ_RUNS = 250;
const DEFAULT_FUZZ_TIME_MS = 30_000;
const MAX_FUZZ_RUNS = 100_000;
const MIN_FUZZ_TIME_MS = 1_000;
const MAX_FUZZ_TIME_MS = 600_000;
const MIN_SIGNED_SEED = -0x80000000;
const MAX_UNSIGNED_SEED = 0xffffffff;

export interface FuzzDefaults {
	defaultRuns?: number;
	defaultTimeMs?: number;
}

export interface FuzzEnvironment {
	REDSHIFT_FUZZ_SEED?: string;
	REDSHIFT_FUZZ_RUNS?: string;
	REDSHIFT_FUZZ_TIME_MS?: string;
	REDSHIFT_FUZZ_PATH?: string;
}

export interface SyntheticStringOptions {
	maxLength?: number;
	allowNul?: boolean;
}

export const SYNTHETIC_STRING_BOUNDARIES = [
	'\0',
	'\r',
	'\n',
	'\t',
	'\\',
	'"',
	"'",
	',',
	'#',
	':',
	'~',
	'[a]',
	'- item',
	'*anchor',
	'|',
	'>',
] as const;

export function syntheticString({
	maxLength = 128,
	allowNul = true,
}: SyntheticStringOptions = {}): Arbitrary<string> {
	if (!Number.isSafeInteger(maxLength) || maxLength < 0 || maxLength > 65_536) {
		throw new Error('Invalid Redshift fuzz configuration: synthetic string length is unbounded');
	}
	if (maxLength === 0) return fc.constant('');
	const explicitBoundaries = SYNTHETIC_STRING_BOUNDARIES.filter(
		(value) => value.length <= maxLength && (allowNul || value !== '\0'),
	);
	const composed = fc
		.array(
			fc.oneof(
				fc.string({ maxLength: Math.min(8, maxLength) }),
				fc.constantFrom(...explicitBoundaries),
			),
			{ maxLength: Math.min(32, maxLength) },
		)
		.map((parts) => parts.join(''))
		.filter((value) => value.length <= maxLength && (allowNul || !value.includes('\0')));
	const boundaryValues = [
		...explicitBoundaries,
		'x'.repeat(Math.max(0, maxLength - 1)),
		'x'.repeat(maxLength),
		`${'x'.repeat(Math.max(0, maxLength - 1))}\r`.slice(0, maxLength),
	];
	return fc.oneof(composed, composed, composed, fc.constantFrom(...boundaryValues));
}

export function deriveFuzzSeed(propertyName: string, baseSeed: number): number {
	if (!propertyName || propertyName.length > 256) {
		throw new Error('Invalid Redshift fuzz configuration: property name must be 1-256 characters');
	}
	if (!Number.isInteger(baseSeed) || baseSeed < MIN_SIGNED_SEED || baseSeed > MAX_UNSIGNED_SEED) {
		throw new Error('Invalid Redshift fuzz configuration: seed is outside the 32-bit range');
	}
	let hash = 0x811c9dc5;
	for (let index = 0; index < propertyName.length; index++) {
		hash ^= propertyName.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (baseSeed ^ hash) | 0;
}

export function fuzzParameters(
	propertyName: string,
	defaults: FuzzDefaults = {},
	environment: FuzzEnvironment = runtimeEnvironment(),
): Parameters<unknown> {
	const defaultRuns = validateBoundedInteger(
		defaults.defaultRuns ?? DEFAULT_FUZZ_RUNS,
		'run count',
		1,
		MAX_FUZZ_RUNS,
	);
	const defaultTimeMs = validateBoundedInteger(
		defaults.defaultTimeMs ?? DEFAULT_FUZZ_TIME_MS,
		'time limit',
		MIN_FUZZ_TIME_MS,
		MAX_FUZZ_TIME_MS,
	);
	const baseSeed = parseSeed(environment.REDSHIFT_FUZZ_SEED);
	const seed = deriveFuzzSeed(propertyName, baseSeed);
	const path = parsePath(environment.REDSHIFT_FUZZ_PATH);
	const numRuns = parseBoundedOverride(
		environment.REDSHIFT_FUZZ_RUNS,
		defaultRuns,
		'run count',
		1,
		MAX_FUZZ_RUNS,
	);
	const interruptAfterTimeLimit = parseBoundedOverride(
		environment.REDSHIFT_FUZZ_TIME_MS,
		defaultTimeMs,
		'time limit',
		MIN_FUZZ_TIME_MS,
		MAX_FUZZ_TIME_MS,
	);
	return {
		seed,
		numRuns,
		interruptAfterTimeLimit,
		markInterruptAsFailure: true,
		reporter: createReplayReporter(propertyName, baseSeed, seed, numRuns),
		...(path === undefined ? {} : { path }),
	};
}

function runtimeEnvironment(): FuzzEnvironment {
	const runtime = globalThis as {
		process?: { env?: Record<string, string | undefined> };
	};
	const environment = runtime.process?.env;
	return {
		...(environment?.REDSHIFT_FUZZ_SEED === undefined
			? {}
			: { REDSHIFT_FUZZ_SEED: environment.REDSHIFT_FUZZ_SEED }),
		...(environment?.REDSHIFT_FUZZ_RUNS === undefined
			? {}
			: { REDSHIFT_FUZZ_RUNS: environment.REDSHIFT_FUZZ_RUNS }),
		...(environment?.REDSHIFT_FUZZ_TIME_MS === undefined
			? {}
			: { REDSHIFT_FUZZ_TIME_MS: environment.REDSHIFT_FUZZ_TIME_MS }),
		...(environment?.REDSHIFT_FUZZ_PATH === undefined
			? {}
			: { REDSHIFT_FUZZ_PATH: environment.REDSHIFT_FUZZ_PATH }),
	};
}

function createReplayReporter(
	propertyName: string,
	baseSeed: number,
	effectiveSeed: number,
	numRuns: number,
) {
	return (details: RunDetails<unknown>) => {
		if (!details.failed) return;
		const report = defaultReportMessage(details) ?? 'Property failed without a fast-check report';
		throw new Error(
			`Redshift fuzz property "${propertyName}" failed. ` +
				`Replay with REDSHIFT_FUZZ_SEED=${baseSeed}, REDSHIFT_FUZZ_RUNS=${numRuns}, ` +
				`and the reported REDSHIFT_FUZZ_PATH. Effective fast-check seed: ${effectiveSeed}.\n${report}`,
		);
	};
}

function parsePath(raw: string | undefined): string | undefined {
	if (raw === undefined) return undefined;
	if (raw.length === 0 || raw.length > 4_096 || !/^[0-9]+(?::[0-9]+)*$/.test(raw)) {
		throw new Error('Invalid Redshift fuzz configuration: path must be a bounded shrink path');
	}
	return raw;
}

function parseSeed(raw: string | undefined): number {
	if (raw === undefined) return DEFAULT_FUZZ_SEED;
	if (!/^(?:-?[0-9]+|0x[0-9a-f]+)$/i.test(raw)) {
		throw new Error('Invalid Redshift fuzz configuration: seed must be a 32-bit integer');
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value < MIN_SIGNED_SEED || value > MAX_UNSIGNED_SEED) {
		throw new Error('Invalid Redshift fuzz configuration: seed is outside the 32-bit range');
	}
	return value | 0;
}

function parseBoundedOverride(
	raw: string | undefined,
	fallback: number,
	label: string,
	minimum: number,
	maximum: number,
): number {
	if (raw === undefined) return fallback;
	if (!/^[0-9]+$/.test(raw)) {
		throw new Error(`Invalid Redshift fuzz configuration: ${label} must be an integer`);
	}
	return validateBoundedInteger(Number(raw), label, minimum, maximum);
}

function validateBoundedInteger(
	value: number,
	label: string,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
		throw new Error(
			`Invalid Redshift fuzz configuration: ${label} must be between ${minimum} and ${maximum}`,
		);
	}
	return value;
}
