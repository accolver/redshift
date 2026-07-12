// @vitest-environment jsdom

import type { SecretHistoryObservation } from '@redshift/crypto';
import { unwrapGiftWrap, wrapSecrets } from '@redshift/crypto';
import type { NostrEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockState } = vi.hoisted(() => ({
	mockState: {
		privateKey: new Uint8Array(32) as Uint8Array,
		pubkey: '',
		history: {
			versions: [],
			observedEvents: 0,
			truncated: false,
		} as SecretHistoryObservation,
		events: [] as NostrEvent[],
		refreshEvents: null as NostrEvent[] | null,
		published: [] as NostrEvent[],
	},
}));

vi.mock('$lib/models/gift-wrap-secrets', async () => {
	const { of } = await import('rxjs');
	return {
		clearDecryptionCache: vi.fn(),
		createSharedDecryptionPipeline: vi.fn(() => of([])),
		GiftWrapSecretsModel: vi.fn(() => of([])),
		AllGiftWrapSecretsModel: vi.fn(() => of(new Map())),
		GiftWrapHistoryModel: vi.fn(() => of(structuredClone(mockState.history))),
		boundRedshiftHistoryEvents: vi.fn((events: NostrEvent[]) => ({
			events,
			observedEvents: events.length,
			truncated: false,
		})),
	};
});

vi.mock('$lib/stores/auth.svelte', () => ({
	getAuthState: () => ({
		isConnected: true,
		pubkey: mockState.pubkey,
		method: 'nsec',
	}),
	getPrivateKey: async () => mockState.privateKey.slice(),
	getDecryptFn: () => null,
	getEncryptFn: () => null,
	signEvent: vi.fn(),
	supportsEncryption: () => true,
}));

vi.mock('$lib/stores/nostr.svelte', () => ({
	eventStore: {
		database: {
			getByFilters: () => mockState.events,
		},
	},
	refreshRedshiftEvents: vi.fn(async () => {
		if (mockState.refreshEvents) mockState.events = [...mockState.refreshEvents];
		return { observedEvents: mockState.events.length, truncated: false };
	}),
	publishEvent: vi.fn(async (event: NostrEvent) => {
		mockState.published.push(event);
		mockState.events.push(event);
		return {
			eventId: event.id,
			required: 1,
			accepted: ['wss://relay.test/'],
			failed: [],
			outcomes: [{ relay: 'wss://relay.test/', state: 'accepted' }],
		};
	}),
}));

import {
	SecretHistoryConflictError,
	getSecretHistoryState,
	restoreSecretHistoryVersion,
	subscribeToSecrets,
	unsubscribeFromSecrets,
} from '$lib/stores/secrets.svelte';

function historyFixture() {
	const current = wrapSecrets({ API_KEY: 'current' }, mockState.privateKey, 'project|dev', {
		createdAt: 103,
	});
	const older = wrapSecrets(
		{ API_KEY: 'older', OLD_ONLY: 'yes' },
		mockState.privateKey,
		'project|dev',
		{
			createdAt: 102,
		},
	);
	const tombstone = wrapSecrets({}, mockState.privateKey, 'project|dev', { createdAt: 101 });
	const observation: SecretHistoryObservation = {
		versions: [
			{
				eventId: current.event.id,
				createdAt: current.rumor.created_at,
				dTag: 'project|dev',
				secrets: { API_KEY: 'current' },
				current: true,
				tombstone: false,
			},
			{
				eventId: older.event.id,
				createdAt: older.rumor.created_at,
				dTag: 'project|dev',
				secrets: { API_KEY: 'older', OLD_ONLY: 'yes' },
				current: false,
				tombstone: false,
			},
			{
				eventId: tombstone.event.id,
				createdAt: tombstone.rumor.created_at,
				dTag: 'project|dev',
				secrets: {},
				current: false,
				tombstone: true,
			},
		],
		observedEvents: 3,
		truncated: false,
	};
	return { current, older, tombstone, observation };
}

beforeEach(() => {
	mockState.privateKey = generateSecretKey();
	mockState.pubkey = getPublicKey(mockState.privateKey);
	mockState.events = [];
	mockState.refreshEvents = null;
	mockState.published = [];
	mockState.history = { versions: [], observedEvents: 0, truncated: false };
	unsubscribeFromSecrets();
});

afterEach(() => {
	unsubscribeFromSecrets();
	vi.clearAllMocks();
});

describe('secret history store', () => {
	it('keeps observed history ephemeral and clears it on unsubscribe', async () => {
		const { observation } = historyFixture();
		mockState.history = observation;
		await subscribeToSecrets('project', 'dev', ['dev']);
		expect(getSecretHistoryState().observation.versions.map(({ eventId }) => eventId)).toEqual(
			observation.versions.map(({ eventId }) => eventId),
		);
		expect(getSecretHistoryState().isLoading).toBe(false);
		const replacement = structuredClone(observation);
		replacement.versions = [
			{
				...replacement.versions[0]!,
				eventId: 'e'.repeat(64),
				dTag: 'other|prod',
			},
		];
		mockState.history = replacement;
		await subscribeToSecrets('other', 'prod', ['prod']);
		expect(getSecretHistoryState().observation.versions.map(({ eventId }) => eventId)).toEqual([
			'e'.repeat(64),
		]);
		expect(getSecretHistoryState().observation.versions).not.toContainEqual(
			expect.objectContaining({ eventId: observation.versions[0]!.eventId }),
		);
		unsubscribeFromSecrets();
		expect(getSecretHistoryState().observation.versions).toEqual([]);
		expect(getSecretHistoryState().conflict).toBeNull();
	});

	it('detects a refreshed current-version conflict and requires explicit overwrite', async () => {
		const { current, older, observation } = historyFixture();
		mockState.history = observation;
		mockState.events = [current.event];
		await subscribeToSecrets('project', 'dev', ['dev']);
		const concurrent = wrapSecrets({ CONCURRENT: 'new' }, mockState.privateKey, 'project|dev', {
			createdAt: 104,
		});
		mockState.refreshEvents = [concurrent.event];

		await expect(
			restoreSecretHistoryVersion(older.event.id, current.event.id),
		).rejects.toBeInstanceOf(SecretHistoryConflictError);
		expect(mockState.published).toEqual([]);
		expect(getSecretHistoryState().conflict).toEqual({
			expectedEventId: current.event.id,
			observedEventId: concurrent.event.id,
		});

		const restored = await restoreSecretHistoryVersion(older.event.id, current.event.id, true);
		expect(restored).not.toBeNull();
		const result = unwrapGiftWrap(restored!, mockState.privateKey);
		expect(result.secrets).toEqual({ API_KEY: 'older', OLD_ONLY: 'yes' });
		expect(result.createdAt).toBeGreaterThan(concurrent.rumor.created_at);
		expect(mockState.published.map(({ id }) => id)).toEqual([restored!.id]);
	});

	it('restores an authenticated tombstone as a newer logical deletion', async () => {
		const { current, tombstone, observation } = historyFixture();
		mockState.history = observation;
		mockState.events = [current.event];
		mockState.refreshEvents = [current.event];
		await subscribeToSecrets('project', 'dev', ['dev']);
		const restored = await restoreSecretHistoryVersion(tombstone.event.id, current.event.id);
		const result = unwrapGiftWrap(restored!, mockState.privateKey);
		expect(result.secrets).toEqual({});
		expect(result.createdAt).toBeGreaterThan(current.rumor.created_at);
	});
});
