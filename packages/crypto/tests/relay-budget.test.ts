import { describe, expect, it } from 'bun:test';
import { HISTORY_LIMITS, RelayObservationBudget, type NostrEvent } from '../src/index';

const event: NostrEvent = {
	id: 'a'.repeat(64),
	pubkey: 'b'.repeat(64),
	sig: 'c'.repeat(128),
	created_at: 1,
	kind: 1059,
	tags: [],
	content: 'encrypted',
};

describe('local relay observation budget', () => {
	it('deduplicates across relays without consuming the observation count', () => {
		const budget = new RelayObservationBudget();
		expect(budget.accept(event)).toBe(true);
		for (let i = 0; i < HISTORY_LIMITS.maxObservedEvents; i++) {
			expect(budget.accept(event)).toBe(false);
		}
		expect(budget.accept({ ...event, id: 'd'.repeat(64) })).toBe(true);
	});

	it('accounts for UTF-8 and tags, and stays closed after aggregate overflow', () => {
		const budget = new RelayObservationBudget();
		const content = 'é'.repeat(1024 * 1024);
		for (let i = 0; i < 7; i++) {
			expect(
				budget.accept({ ...event, id: String(i), content, tags: [['t', 'redshift-secrets']] }),
			).toBe(true);
		}
		expect(() => budget.accept({ ...event, content, tags: [['t', 'redshift-secrets']] })).toThrow(
			'bound',
		);
		expect(() => budget.accept(event)).toThrow('bound');
	});
});
