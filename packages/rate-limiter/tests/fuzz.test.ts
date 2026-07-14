import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { fuzzParameters, syntheticString } from '../../../tests/helpers/fuzz';
import {
	QuorumError,
	classifyQuorumFailure,
	executeWithQuorum,
	mergeQuorumReports,
	parseNip20Reason,
	sanitizeRelayReason,
	type QuorumOutcome,
	type QuorumReport,
} from '../src';

const target = syntheticString({ maxLength: 24 }).filter((value) => value.length > 0);
const relayReason = syntheticString({ maxLength: 2_048 });
const outcomeState = fc.constantFrom<'accepted' | 'rejected' | 'unavailable'>(
	'accepted',
	'rejected',
	'unavailable',
);

function reportFromOutcomes(
	operationId: string,
	required: number,
	outcomes: Array<QuorumOutcome<string>>,
): QuorumReport<string> {
	return {
		operationId,
		required,
		accepted: outcomes
			.filter((outcome) => outcome.state === 'accepted')
			.map((outcome) => outcome.target),
		failed: outcomes
			.filter((outcome) => outcome.state !== 'accepted')
			.map((outcome) => ({
				target: outcome.target,
				reason: outcome.reason ?? 'Unknown failure',
			})),
		outcomes,
	};
}

describe('rate limiter and quorum property tests', () => {
	it('sanitizes arbitrary relay reasons idempotently within the fixed bound', () => {
		fc.assert(
			fc.property(relayReason, (reason) => {
				const sanitized = sanitizeRelayReason(reason);
				expect(sanitized).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
				expect(sanitized.length).toBeLessThanOrEqual(512);
				expect(sanitizeRelayReason(sanitized)).toBe(sanitized);
			}),
			fuzzParameters('relay reason sanitization'),
		);
	});

	it('recognizes only exact lowercase NIP-20 prefixes at position zero', () => {
		const knownCode = fc.constantFrom(
			'duplicate',
			'pow',
			'blocked',
			'rate-limited',
			'invalid',
			'restricted',
			'error',
		);
		fc.assert(
			fc.property(knownCode, relayReason, (code, message) => {
				const exact = new Error(`${code}:${message}`);
				expect(parseNip20Reason(exact)).toEqual({ code, message: message.trim() });
				expect(classifyQuorumFailure(exact)).toBe(
					code === 'invalid' || code === 'pow' || code === 'blocked' || code === 'restricted'
						? 'rejected'
						: 'unavailable',
				);
				for (const misleading of [` ${code}:${message}`, `${code.toUpperCase()}:${message}`]) {
					expect(parseNip20Reason(new Error(misleading)).code).toBe('unknown');
					expect(classifyQuorumFailure(new Error(misleading))).toBe('unavailable');
				}
			}),
			fuzzParameters('NIP-20 exact prefix classification'),
		);
	});

	it('projects deduplicated target outcomes and normalized thresholds exactly', async () => {
		const targetStates = fc.uniqueArray(
			fc.record({ target, state: outcomeState, reason: relayReason }),
			{ minLength: 1, maxLength: 12, selector: (candidate) => candidate.target },
		);
		await fc.assert(
			fc.asyncProperty(
				targetStates,
				fc.integer({ min: -20, max: 30 }),
				async (candidates, requestedRequired) => {
					const operationCalls = new Map<string, number>();
					const expectedOutcomes: Array<QuorumOutcome<string>> = candidates.map((candidate) => {
						if (candidate.state === 'accepted') {
							return { target: candidate.target, state: 'accepted' };
						}
						const reason =
							candidate.state === 'rejected'
								? `restricted:${candidate.reason}`
								: `error:${candidate.reason}`;
						return {
							target: candidate.target,
							state: candidate.state,
							reason: sanitizeRelayReason(reason),
						};
					});
					const expectedRequired = Math.max(1, Math.min(requestedRequired, candidates.length));
					const expectedAccepted = candidates
						.filter((candidate) => candidate.state === 'accepted')
						.map((candidate) => candidate.target);
					const shouldSucceed = expectedAccepted.length >= expectedRequired;
					let report: QuorumReport<string>;
					let thrownQuorumError = false;
					try {
						report = await executeWithQuorum(
							candidates.map((candidate) => candidate.target),
							'property-operation',
							async (currentTarget) => {
								operationCalls.set(currentTarget, (operationCalls.get(currentTarget) ?? 0) + 1);
								const candidate = candidates.find((item) => item.target === currentTarget);
								if (!candidate || candidate.state === 'accepted') return;
								throw new Error(
									candidate.state === 'rejected'
										? `restricted:${candidate.reason}`
										: `error:${candidate.reason}`,
								);
							},
							requestedRequired,
						);
					} catch (error) {
						if (!(error instanceof QuorumError)) throw error;
						thrownQuorumError = true;
						report = error.report;
					}
					expect(thrownQuorumError).toBe(!shouldSucceed);
					expect(report.required).toBe(expectedRequired);
					expect(report.outcomes).toEqual(expectedOutcomes);
					expect(report.accepted).toEqual(expectedAccepted);
					expect(report.failed).toEqual(
						expectedOutcomes.flatMap((outcome) =>
							outcome.state === 'accepted'
								? []
								: [{ target: outcome.target, reason: outcome.reason ?? 'Unknown failure' }],
						),
					);
					expect([...operationCalls.values()].every((count) => count === 1)).toBe(true);
				},
			),
			fuzzParameters('quorum projection and threshold'),
		);
	});

	it('allows retries to replace only unavailable outcomes while preserving report order', () => {
		fc.assert(
			fc.property(fc.array(outcomeState, { minLength: 1, maxLength: 12 }), (retryStates) => {
				const previousOutcomes: Array<QuorumOutcome<string>> = [
					{ target: 'terminal-accepted', state: 'accepted' },
					{ target: 'terminal-rejected', state: 'rejected', reason: 'restricted: policy' },
					...retryStates.map((_, index) => ({
						target: `retry-${index}`,
						state: 'unavailable' as const,
						reason: 'timeout',
					})),
				];
				const retryOutcomes: Array<QuorumOutcome<string>> = retryStates.map((state, index) => ({
					target: `retry-${index}`,
					state,
					...(state === 'accepted'
						? {}
						: { reason: state === 'rejected' ? 'invalid: retry' : 'timeout' }),
				}));
				const previous = reportFromOutcomes('operation', 2, previousOutcomes);
				const retry = reportFromOutcomes('operation', 1, retryOutcomes);
				const merged = mergeQuorumReports(previous, retry);
				expect(merged.required).toBe(previous.required);
				expect(merged.outcomes.slice(0, 2)).toEqual(previous.outcomes.slice(0, 2));
				expect(merged.outcomes.map((outcome) => outcome.target)).toEqual(
					previous.outcomes.map((outcome) => outcome.target),
				);
				expect(merged.outcomes.slice(2)).toEqual(retryOutcomes);
			}),
			fuzzParameters('quorum retry monotonic merge'),
		);
	});
});
