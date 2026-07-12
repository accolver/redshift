// @vitest-environment jsdom

import type { NostrEvent } from 'nostr-tools';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { wrapSecrets } from '@redshift/crypto';
import { concat, NEVER, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPublish, mockRequest, mockEvents } = vi.hoisted(() => ({
	mockPublish: vi.fn(),
	mockRequest: vi.fn(),
	mockEvents: [] as NostrEvent[],
}));

vi.mock('applesauce-core', () => ({
	EventStore: class MockEventStore {
		add(event: NostrEvent) {
			if (!mockEvents.some(({ id }) => id === event.id)) mockEvents.push(event);
		}
		database = { getByFilters: () => mockEvents };
	},
}));

vi.mock('applesauce-relay', () => ({
	RelayPool: class MockRelayPool {
		publish = mockPublish;
		request = mockRequest;
		subscription = vi.fn().mockReturnValue({
			pipe: vi
				.fn()
				.mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
		});
		relay = vi.fn();
	},
	onlyEvents: vi.fn().mockReturnValue((value: unknown) => value),
}));

vi.mock('$lib/rate-limiter', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/rate-limiter')>();
	return {
		...actual,
		RateLimiter: class MockRateLimiter {
			waitForSlot = vi.fn().mockResolvedValue(undefined);
			reset = vi.fn();
		},
		withPublishBackoff: vi
			.fn()
			.mockImplementation(async (operation: () => Promise<void>) => operation()),
	};
});

import {
	disconnect,
	publishEvent,
	refreshRedshiftEvents,
	retryPublication,
} from '$lib/stores/nostr.svelte';
import {
	clearPublicationRecovery,
	getPublicationRecoveryRecord,
} from '$lib/stores/publication-recovery.svelte';

const privateKey = generateSecretKey();
const ownerPubkey = getPublicKey(privateKey);
const relays = [
	'wss://accepted-one.test/',
	'wss://accepted-two.test/',
	'wss://accepted-three.test/',
	'wss://rejected.test/',
	'wss://offline.test/',
];

function signedEvent() {
	return wrapSecrets({ KEY: 'value' }, privateKey, 'project|dev').event as NostrEvent;
}

beforeEach(() => {
	mockEvents.length = 0;
	mockRequest.mockReset();
	mockPublish.mockReset().mockImplementation(async ([relay]: string[]) => {
		if (relay === 'wss://rejected.test/')
			return [{ ok: false, from: relay, message: 'restricted: policy' }];
		if (relay === 'wss://offline.test/') return [{ ok: false, from: relay, message: 'timeout' }];
		return [{ ok: true, from: relay }];
	});
	sessionStorage.clear();
	clearPublicationRecovery();
});

afterEach(() => {
	disconnect();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('Nostr publication recovery', () => {
	it('aborts a bounded history refresh at a total deadline when EOSE never arrives', async () => {
		vi.useFakeTimers();
		const event = signedEvent();
		mockRequest.mockReturnValue(concat(of(event), NEVER));
		const pending = refreshRedshiftEvents(ownerPubkey);
		const assertion = expect(pending).rejects.toThrow('timed out before completion');
		await vi.advanceTimersByTimeAsync(10_001);
		await assertion;
		expect(mockEvents).toEqual([]);
	});

	it('records five classified relay outcomes after degraded quorum success', async () => {
		const event = signedEvent();
		const report = await publishEvent(event, relays, { ownerPubkey, project: 'project' });
		expect(report.accepted).toEqual(relays.slice(0, 3));
		expect(report.outcomes.map(({ state }) => state)).toEqual([
			'accepted',
			'accepted',
			'accepted',
			'rejected',
			'unavailable',
		]);
		expect(getPublicationRecoveryRecord(event.id)?.event.id).toBe(event.id);
		expect(mockEvents.map(({ id }) => id)).toEqual([event.id]);
	});

	it('retries the exact event only to unavailable relays and retains rejection', async () => {
		const event = signedEvent();
		await publishEvent(event, relays, { ownerPubkey, project: 'project' });
		mockPublish.mockClear();
		mockPublish.mockImplementation(async ([relay]: string[]) => [{ ok: true, from: relay }]);
		const merged = await retryPublication(event.id);
		expect(mockPublish).toHaveBeenCalledTimes(1);
		expect(mockPublish.mock.calls[0]?.[0]).toEqual(['wss://offline.test/']);
		expect(mockPublish.mock.calls[0]?.[1]).toEqual(JSON.parse(JSON.stringify(event)));
		expect(merged.outcomes.map(({ state }) => state)).toEqual([
			'accepted',
			'accepted',
			'accepted',
			'rejected',
			'accepted',
		]);
		expect(getPublicationRecoveryRecord(event.id)?.report.outcomes[3]?.state).toBe('rejected');
		expect(mockEvents).toHaveLength(1);
	});

	it('does not persist public project metadata as encrypted secret recovery', async () => {
		const metadata = finalizeEvent(
			{
				kind: 30078,
				created_at: Math.floor(Date.now() / 1000),
				tags: [['d', 'project:test']],
				content: JSON.stringify({ type: 'project', displayName: 'Public metadata' }),
			},
			privateKey,
		);
		await publishEvent(metadata, relays, { ownerPubkey, project: 'project' });
		expect(getPublicationRecoveryRecord(metadata.id)).toBeUndefined();
		expect(sessionStorage.getItem('redshift_publication_recovery_v1')).toBeNull();
	});

	it('clears persisted recovery on disconnect', async () => {
		const event = signedEvent();
		await publishEvent(event, relays, { ownerPubkey });
		disconnect();
		expect(getPublicationRecoveryRecord(event.id)).toBeUndefined();
		expect(sessionStorage.length).toBe(0);
	});
});
