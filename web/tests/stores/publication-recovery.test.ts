// @vitest-environment jsdom

import type { QuorumReport } from '$lib/rate-limiter';
import {
	PUBLICATION_RECOVERY_STORAGE_KEY,
	clearPublicationRecovery,
	finalizePublicationRecovery,
	getPublicationRecoveryRecord,
	getPublicationRecoveryState,
	mergePublicationRecovery,
	preparePublicationRecovery,
	removePublicationRecovery,
	restorePublicationRecovery,
	setPublicationRetrying,
} from '$lib/stores/publication-recovery.svelte';
import type { NostrEvent } from 'nostr-tools';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const privateKey = generateSecretKey();
const ownerPubkey = getPublicKey(privateKey);

function signedEvent(content = 'encrypted-ciphertext') {
	return finalizeEvent(
		{
			kind: 1059,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				['p', ownerPubkey],
				['t', 'redshift-secrets'],
			],
			content,
		},
		generateSecretKey(),
	) as NostrEvent;
}

function report(
	eventId: string,
	states: Array<'accepted' | 'rejected' | 'unavailable'>,
): QuorumReport<string> {
	const outcomes = states.map((state, index) => ({
		target: `wss://${index + 1}.test/`,
		state,
		...(state === 'accepted'
			? {}
			: { reason: state === 'rejected' ? 'restricted: policy' : 'timeout' }),
	}));
	return {
		operationId: eventId,
		required: Math.floor(states.length / 2) + 1,
		accepted: outcomes.filter(({ state }) => state === 'accepted').map(({ target }) => target),
		failed: outcomes
			.filter(({ state }) => state !== 'accepted')
			.map(({ target, reason }) => ({ target, reason: reason ?? 'unknown' })),
		outcomes,
	};
}

beforeEach(() => {
	sessionStorage.clear();
	clearPublicationRecovery();
});

afterEach(() => {
	vi.restoreAllMocks();
	clearPublicationRecovery();
});

describe('browser publication recovery', () => {
	it('persists provisional state synchronously before final classified outcomes', () => {
		const event = signedEvent();
		preparePublicationRecovery(event, ['wss://1.test', 'wss://2.test'], {
			ownerPubkey,
			project: 'project',
			environment: 'dev',
		});
		const provisional = getPublicationRecoveryRecord(event.id);
		expect(provisional?.event).toEqual(JSON.parse(JSON.stringify(event)));
		expect(provisional?.report.outcomes.every(({ state }) => state === 'unavailable')).toBe(true);
		expect(sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY)).toContain(event.id);

		finalizePublicationRecovery(event.id, report(event.id, ['accepted', 'unavailable']));
		expect(getPublicationRecoveryRecord(event.id)?.report.accepted).toEqual(['wss://1.test/']);
	});

	it('removes only fully accepted state and retains permanent rejection', () => {
		const accepted = signedEvent('accepted');
		preparePublicationRecovery(accepted, ['wss://1.test'], { ownerPubkey });
		finalizePublicationRecovery(accepted.id, report(accepted.id, ['accepted']));
		expect(getPublicationRecoveryRecord(accepted.id)).toBeUndefined();

		const rejected = signedEvent('rejected');
		preparePublicationRecovery(rejected, ['wss://1.test', 'wss://2.test'], { ownerPubkey });
		finalizePublicationRecovery(rejected.id, report(rejected.id, ['accepted', 'rejected']));
		expect(getPublicationRecoveryRecord(rejected.id)?.report.outcomes[1]?.state).toBe('rejected');
	});

	it('merges unavailable-only retry outcomes without changing event bytes', () => {
		const event = signedEvent();
		preparePublicationRecovery(event, ['wss://1.test', 'wss://2.test', 'wss://3.test'], {
			ownerPubkey,
		});
		finalizePublicationRecovery(
			event.id,
			report(event.id, ['accepted', 'rejected', 'unavailable']),
		);
		mergePublicationRecovery(event.id, {
			operationId: event.id,
			required: 1,
			accepted: ['wss://3.test/'],
			failed: [],
			outcomes: [{ target: 'wss://3.test/', state: 'accepted' }],
		});
		const merged = getPublicationRecoveryRecord(event.id);
		expect(merged?.event).toEqual(JSON.parse(JSON.stringify(event)));
		expect(merged?.report.outcomes.map(({ state }) => state)).toEqual([
			'accepted',
			'rejected',
			'accepted',
		]);
	});

	it('rejects a stale overlapping retry that would downgrade an accepted relay', () => {
		const event = signedEvent();
		preparePublicationRecovery(event, ['wss://1.test', 'wss://2.test', 'wss://3.test'], {
			ownerPubkey,
		});
		finalizePublicationRecovery(
			event.id,
			report(event.id, ['accepted', 'rejected', 'unavailable']),
		);
		mergePublicationRecovery(event.id, {
			operationId: event.id,
			required: 1,
			accepted: ['wss://3.test/'],
			failed: [],
			outcomes: [{ target: 'wss://3.test/', state: 'accepted' }],
		});
		expect(() =>
			mergePublicationRecovery(event.id, {
				operationId: event.id,
				required: 1,
				accepted: [],
				failed: [{ target: 'wss://3.test/', reason: 'timeout' }],
				outcomes: [{ target: 'wss://3.test/', state: 'unavailable', reason: 'timeout' }],
			}),
		).toThrow('no longer unavailable');
		expect(getPublicationRecoveryRecord(event.id)?.report.outcomes[2]?.state).toBe('accepted');
	});

	it('merges a majority-threshold retry report for three unavailable relays', () => {
		const event = signedEvent();
		preparePublicationRecovery(
			event,
			['wss://1.test', 'wss://2.test', 'wss://3.test', 'wss://4.test', 'wss://5.test'],
			{ ownerPubkey },
		);
		finalizePublicationRecovery(
			event.id,
			report(event.id, ['accepted', 'accepted', 'unavailable', 'unavailable', 'unavailable']),
		);
		const merged = mergePublicationRecovery(event.id, {
			operationId: event.id,
			required: 2,
			accepted: ['wss://3.test/', 'wss://4.test/', 'wss://5.test/'],
			failed: [],
			outcomes: [
				{ target: 'wss://3.test/', state: 'accepted' },
				{ target: 'wss://4.test/', state: 'accepted' },
				{ target: 'wss://5.test/', state: 'accepted' },
			],
		});
		expect(merged.required).toBe(3);
		expect(merged.outcomes.every(({ state }) => state === 'accepted')).toBe(true);
		expect(getPublicationRecoveryRecord(event.id)).toBeUndefined();
	});

	it('restores only valid same-owner records and drops tampering', () => {
		const event = signedEvent();
		preparePublicationRecovery(event, ['wss://1.test'], { ownerPubkey });
		const stored = JSON.parse(sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY) ?? '{}');
		const validStored = structuredClone(stored);
		clearPublicationRecovery();
		sessionStorage.setItem(PUBLICATION_RECOVERY_STORAGE_KEY, JSON.stringify(stored));
		restorePublicationRecovery(ownerPubkey);
		expect(getPublicationRecoveryRecord(event.id)).toBeDefined();

		stored.records[0].event.content = 'tampered';
		sessionStorage.setItem(PUBLICATION_RECOVERY_STORAGE_KEY, JSON.stringify(stored));
		restorePublicationRecovery(ownerPubkey);
		expect(getPublicationRecoveryState().records).toEqual([]);
		expect(sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY)).toBeNull();

		validStored.records[0].updatedAt = Date.now() + 120_000;
		sessionStorage.setItem(PUBLICATION_RECOVERY_STORAGE_KEY, JSON.stringify(validStored));
		restorePublicationRecovery(ownerPubkey);
		expect(getPublicationRecoveryState().records).toEqual([]);
		expect(sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY)).toBeNull();
	});

	it('rejects public metadata at the recovery-store trust boundary', () => {
		const publicEvent = finalizeEvent(
			{
				kind: 30078,
				created_at: Math.floor(Date.now() / 1000),
				tags: [['d', 'project']],
				content: '{}',
			},
			privateKey,
		) as NostrEvent;
		expect(() =>
			preparePublicationRecovery(publicEvent, ['wss://1.test'], { ownerPubkey }),
		).toThrow('kind 1059');
	});

	it('contains session storage read and cleanup failures while clearing in-memory state', () => {
		const event = signedEvent();
		preparePublicationRecovery(event, ['wss://1.test'], { ownerPubkey });
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new DOMException('disabled', 'SecurityError');
		});
		expect(() => clearPublicationRecovery()).not.toThrow();
		expect(getPublicationRecoveryState().records).toEqual([]);

		vi.restoreAllMocks();
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('disabled', 'SecurityError');
		});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new DOMException('disabled', 'SecurityError');
		});
		expect(() => restorePublicationRecovery(ownerPubkey)).not.toThrow();
		expect(getPublicationRecoveryState().records).toEqual([]);
		expect(getPublicationRecoveryState().error).toContain('could not be read');
	});

	it('aborts synchronously when provisional persistence fails', () => {
		const event = signedEvent();
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('quota', 'QuotaExceededError');
		});
		expect(() => preparePublicationRecovery(event, ['wss://1.test'], { ownerPubkey })).toThrow(
			'before relay publication',
		);
		expect(getPublicationRecoveryState().records).toEqual([]);
	});

	it('retains provisional state when final outcome persistence fails after publication', () => {
		const event = signedEvent();
		preparePublicationRecovery(event, ['wss://1.test', 'wss://2.test'], { ownerPubkey });
		const provisional = sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY);
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('quota', 'QuotaExceededError');
		});
		expect(() =>
			finalizePublicationRecovery(event.id, report(event.id, ['accepted', 'unavailable'])),
		).toThrow(event.id);
		expect(sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY)).toBe(provisional);
		expect(getPublicationRecoveryRecord(event.id)?.report.accepted).toEqual([]);
	});

	it('tracks retry state and clears only its namespaced session key', () => {
		const event = signedEvent();
		sessionStorage.setItem('unrelated', 'keep');
		preparePublicationRecovery(event, ['wss://1.test'], { ownerPubkey });
		setPublicationRetrying(event.id, true);
		expect(getPublicationRecoveryState().retryingEventIds.has(event.id)).toBe(true);
		removePublicationRecovery(event.id);
		expect(getPublicationRecoveryState().records).toEqual([]);
		clearPublicationRecovery();
		expect(sessionStorage.getItem(PUBLICATION_RECOVERY_STORAGE_KEY)).toBeNull();
		expect(sessionStorage.getItem('unrelated')).toBe('keep');
	});
});
