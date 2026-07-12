import { describe, expect, it } from 'bun:test';
import { PrincipalQuotaRegistry } from '../src/principal-quota';

describe('PrincipalQuotaRegistry', () => {
	it('shares publish capacity across multiple sessions for one principal', () => {
		const quotas = new PrincipalQuotaRegistry(
			{ rate: 0, capacity: 2 },
			{ rate: 0, capacity: 2 },
			10,
		);
		expect(quotas.consumePublish('owner')).toBe(true);
		expect(quotas.consumePublish('owner')).toBe(true);
		expect(quotas.consumePublish('owner')).toBe(false);
		expect(quotas.consumePublish('different-owner')).toBe(true);
	});

	it('shares request capacity across multiple sessions for one principal', () => {
		const quotas = new PrincipalQuotaRegistry(
			{ rate: 0, capacity: 2 },
			{ rate: 0, capacity: 1 },
			10,
		);
		expect(quotas.consumeRequest('owner')).toBe(true);
		expect(quotas.consumeRequest('owner')).toBe(false);
	});

	it('caps subscriptions across sessions and releases closed sessions', () => {
		const quotas = new PrincipalQuotaRegistry(
			{ rate: 0, capacity: 2 },
			{ rate: 0, capacity: 2 },
			2,
		);
		expect(quotas.reserveSubscription('owner', 'session-a', 'sub-a')).toBe(true);
		expect(quotas.reserveSubscription('owner', 'session-b', 'sub-b')).toBe(true);
		expect(quotas.reserveSubscription('owner', 'session-c', 'sub-c')).toBe(false);
		quotas.releaseSession('session-a');
		expect(quotas.reserveSubscription('owner', 'session-c', 'sub-c')).toBe(true);
	});

	it('does not double-count replacement of a subscription ID in one session', () => {
		const quotas = new PrincipalQuotaRegistry(
			{ rate: 0, capacity: 2 },
			{ rate: 0, capacity: 2 },
			1,
		);
		expect(quotas.reserveSubscription('owner', 'session-a', 'sub-a')).toBe(true);
		expect(quotas.reserveSubscription('owner', 'session-a', 'sub-a')).toBe(true);
	});
});
