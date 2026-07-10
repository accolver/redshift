/**
 * Managed Relay Tests
 *
 * L4: Integration-Contractor - Tests for managed relay integration
 * Tests for checkManagedRelayAccess, getRelaysForUser, syncSecretsToManagedRelay
 */

import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch using vi.stubGlobal (hoisted properly by Vitest)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Use vi.hoisted to set up shared mock state BEFORE vi.mock calls execute
// vi.mock is hoisted to the top of the file, so we need vi.hoisted to run first
const { mockEvents, mockPublish } = vi.hoisted(() => {
	const mockEvents: NostrEvent[] = [];
	const mockPublish = vi.fn().mockResolvedValue(undefined);
	return { mockEvents, mockPublish };
});

vi.mock('applesauce-core', () => {
	return {
		EventStore: class MockEventStore {
			add(event: NostrEvent) {
				mockEvents.push(event);
			}
			database = {
				getByFilters: (filters: { kinds?: number[] }[]) =>
					mockEvents.filter((event) =>
						filters.some((filter) => !filter.kinds || filter.kinds.includes(event.kind)),
					),
			};
			__clearMockEvents() {
				mockEvents.length = 0;
			}
			__addMockEvent(event: NostrEvent) {
				mockEvents.push(event);
			}
		},
	};
});

vi.mock('applesauce-relay', () => {
	return {
		RelayPool: class MockRelayPool {
			publish = mockPublish;
			relay = vi.fn().mockReturnValue({
				authenticated: false,
				challenge$: { subscribe: vi.fn(() => new Subscription()) },
				authenticate: vi.fn(),
			});
			subscription = vi.fn().mockReturnValue({
				pipe: vi.fn().mockReturnValue({
					subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
				}),
			});
		},
		onlyEvents: vi.fn().mockReturnValue((x: unknown) => x),
	};
});

// Mock the rate limiter to not actually wait
vi.mock('$lib/rate-limiter', () => {
	return {
		RateLimiter: class MockRateLimiter {
			waitForSlot = vi.fn().mockResolvedValue(undefined);
			reset = vi.fn();
		},
		withPublishBackoff: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
		executeWithQuorum: vi
			.fn()
			.mockImplementation(
				async (
					targets: string[],
					operationId: string,
					operation: (target: string) => Promise<void>,
				) => {
					for (const target of targets) await operation(target);
					return { operationId, required: 1, accepted: targets, failed: [] };
				},
			),
	};
});

// Import after mocks are set up
import {
	DEFAULT_RELAYS,
	MANAGED_RELAY,
	MANAGED_RELAY_API,
	checkManagedRelayAccess,
	clearPaymentCache,
	eventStore,
	getRelaysForUser,
	getRuntimeRelays,
	resetManagedRelaySync,
	syncSecretsToManagedRelay,
	watchManagedRelayAuthentication,
	withPublishTimeout,
} from '$lib/stores/nostr.svelte';

describe('Managed Relay Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockReset();
		mockPublish.mockReset().mockResolvedValue(undefined);
		// Reset internal state
		resetManagedRelaySync();
		clearPaymentCache();
		// Clear mock events
		const store = eventStore as unknown as { __clearMockEvents: () => void };
		store.__clearMockEvents?.();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('publish timeout cleanup', () => {
		it('clears the timeout immediately after a successful publish', async () => {
			vi.useFakeTimers();
			await withPublishTimeout(Promise.resolve('ok'), 'wss://relay.test', 5000);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('rejects and clears the timeout when publication stalls', async () => {
			vi.useFakeTimers();
			const stalled = withPublishTimeout(new Promise<never>(() => {}), 'wss://relay.test', 5000);
			const rejection = expect(stalled).rejects.toThrow('Publish timeout for wss://relay.test');
			await vi.advanceTimersByTimeAsync(5000);
			await rejection;
			expect(vi.getTimerCount()).toBe(0);
		});
	});

	describe('NIP-42 authentication', () => {
		it('signs an AUTH template when the managed relay issues a challenge', async () => {
			let challengeObserver: ((challenge: string | null) => void) | undefined;
			const authenticate = vi.fn(
				async (signer: { signEvent: (event: EventTemplate) => Promise<NostrEvent> }) => {
					const event = await signer.signEvent({
						kind: 22242,
						created_at: 1,
						tags: [['challenge', 'challenge-value']],
						content: '',
					});
					expect(event.kind).toBe(22242);
					return { ok: true };
				},
			);
			const signAuthEvent = vi.fn(async (template: EventTemplate) => ({
				...template,
				id: 'signed-auth-id',
				pubkey: 'a'.repeat(64),
				sig: 'b'.repeat(128),
			}));
			const onError = vi.fn();
			const subscription = watchManagedRelayAuthentication(
				{
					authenticated: false,
					challenge$: {
						subscribe(observer) {
							challengeObserver = observer;
							return new Subscription();
						},
					},
					authenticate,
				},
				signAuthEvent,
				onError,
			);

			challengeObserver?.('challenge-value');
			await vi.waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
			expect(signAuthEvent).toHaveBeenCalledTimes(1);
			expect(onError).not.toHaveBeenCalled();
			subscription.unsubscribe();
		});
	});

	describe('embedded runtime relays', () => {
		it('uses normalized nonce-injected custom relays and rejects unsafe transports', () => {
			expect(
				getRuntimeRelays({
					relays: ['wss://custom.example', 'ws://127.0.0.1:4777'],
				}),
			).toEqual(['wss://custom.example/', 'ws://127.0.0.1:4777/']);
			expect(getRuntimeRelays({ relays: ['ws://remote.example'] })).toEqual(DEFAULT_RELAYS);
			expect(getRuntimeRelays({ relays: [] })).toEqual(DEFAULT_RELAYS);
		});
	});

	describe('Constants', () => {
		it('exports MANAGED_RELAY with correct URL', () => {
			expect(MANAGED_RELAY).toBe('wss://relay.redshiftapp.com');
		});

		it('exports MANAGED_RELAY_API with correct URL', () => {
			expect(MANAGED_RELAY_API).toBe('https://relay.redshiftapp.com');
		});

		it('exports DEFAULT_RELAYS array', () => {
			expect(DEFAULT_RELAYS).toBeInstanceOf(Array);
			expect(DEFAULT_RELAYS.length).toBeGreaterThan(0);
			expect(DEFAULT_RELAYS).toContain('wss://relay.damus.io');
		});

		it('MANAGED_RELAY is not in DEFAULT_RELAYS', () => {
			expect(DEFAULT_RELAYS).not.toContain(MANAGED_RELAY);
		});
	});

	describe('checkManagedRelayAccess', () => {
		// Use unique pubkeys for each test to avoid cache interference
		// Even though beforeEach clears the cache, using unique keys is more robust

		it('returns true when API returns paid: true', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000001';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: true }),
			});

			const result = await checkManagedRelayAccess(pubkey);
			expect(result).toBe(true);
		});

		it('returns false when API returns paid: false', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000002';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: false }),
			});

			const result = await checkManagedRelayAccess(pubkey);
			expect(result).toBe(false);
		});

		it('returns false when API response is not ok', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000003';
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
			});

			const result = await checkManagedRelayAccess(pubkey);
			expect(result).toBe(false);
		});

		it('returns false when fetch throws an error', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000004';
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await checkManagedRelayAccess(pubkey);
			expect(result).toBe(false);
		});

		it('calls the correct API endpoint', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000005';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: false }),
			});

			await checkManagedRelayAccess(pubkey);

			expect(mockFetch).toHaveBeenCalledWith(
				`${MANAGED_RELAY_API}/api/check-payment?pubkey=${pubkey}`,
			);
		});

		it('uses cached result for same pubkey within TTL', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000006';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: true }),
			});

			// First call - should hit API
			const result1 = await checkManagedRelayAccess(pubkey);
			expect(result1).toBe(true);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			const result2 = await checkManagedRelayAccess(pubkey);
			expect(result2).toBe(true);
			expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, no new API call
		});

		it('bypasses cache for different pubkey', async () => {
			const pubkey1 = '0000000000000000000000000000000000000000000000000000000000000007';
			const pubkey2 = '0000000000000000000000000000000000000000000000000000000000000008';

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ paid: true }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ paid: false }),
				});

			// First pubkey
			const result1 = await checkManagedRelayAccess(pubkey1);
			expect(result1).toBe(true);

			// Different pubkey - should hit API again
			const result2 = await checkManagedRelayAccess(pubkey2);
			expect(result2).toBe(false);

			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('handles non-boolean paid value as false', async () => {
			const pubkey = '0000000000000000000000000000000000000000000000000000000000000009';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: 'yes' }), // string instead of boolean
			});

			const result = await checkManagedRelayAccess(pubkey);
			expect(result).toBe(false);
		});

		it('handles missing paid field as false', async () => {
			const pubkey = '000000000000000000000000000000000000000000000000000000000000000a';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ status: 'ok' }), // no paid field
			});

			const result = await checkManagedRelayAccess(pubkey);
			expect(result).toBe(false);
		});
	});

	describe('getRelaysForUser', () => {
		it('returns managed relay first when user has paid', async () => {
			const pubkey = '000000000000000000000000000000000000000000000000000000000000000b';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: true }),
			});

			const relays = await getRelaysForUser(pubkey);

			expect(relays[0]).toBe(MANAGED_RELAY);
			expect(relays).toContain(MANAGED_RELAY);
			expect(relays.length).toBe(DEFAULT_RELAYS.length + 1);
		});

		it('includes all default relays when user has paid', async () => {
			const pubkey = '000000000000000000000000000000000000000000000000000000000000000c';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: true }),
			});

			const relays = await getRelaysForUser(pubkey);

			for (const relay of DEFAULT_RELAYS) {
				expect(relays).toContain(relay);
			}
		});

		it('returns only default relays when user has not paid', async () => {
			const pubkey = '000000000000000000000000000000000000000000000000000000000000000d';
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ paid: false }),
			});

			const relays = await getRelaysForUser(pubkey);

			expect(relays).toEqual(DEFAULT_RELAYS);
			expect(relays).not.toContain(MANAGED_RELAY);
		});

		it('returns default relays on API error', async () => {
			const pubkey = '000000000000000000000000000000000000000000000000000000000000000e';
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const relays = await getRelaysForUser(pubkey);

			expect(relays).toEqual(DEFAULT_RELAYS);
		});
	});

	describe('syncSecretsToManagedRelay', () => {
		const createMockEvent = (kind: number, id: string): NostrEvent => ({
			id,
			kind,
			pubkey: 'test-pubkey',
			created_at: Math.floor(Date.now() / 1000),
			content: 'test-content',
			tags: [],
			sig: 'test-sig',
		});

		it('returns zeros if already synced this session', async () => {
			// First sync
			const result1 = await syncSecretsToManagedRelay();
			expect(result1).toEqual({ synced: 0, errors: 0 });

			// Second sync should return zeros without doing anything
			const result2 = await syncSecretsToManagedRelay();
			expect(result2).toEqual({ synced: 0, errors: 0 });
		});

		it('syncs kind 1059 (gift-wrapped) events', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			const giftWrapEvent = createMockEvent(1059, 'gift-wrap-1');
			store.__addMockEvent(giftWrapEvent);

			const result = await syncSecretsToManagedRelay();

			expect(result.synced).toBe(1);
			expect(result.errors).toBe(0);
			expect(mockPublish).toHaveBeenCalledWith([MANAGED_RELAY], giftWrapEvent);
		});

		it('syncs kind 30078 (Redshift) events', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			const redshiftEvent = createMockEvent(30078, 'redshift-1');
			store.__addMockEvent(redshiftEvent);

			const result = await syncSecretsToManagedRelay();

			expect(result.synced).toBe(1);
			expect(result.errors).toBe(0);
			expect(mockPublish).toHaveBeenCalledWith([MANAGED_RELAY], redshiftEvent);
		});

		it('ignores other event kinds', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			store.__addMockEvent(createMockEvent(0, 'profile-1')); // Kind 0 - profile
			store.__addMockEvent(createMockEvent(1, 'note-1')); // Kind 1 - note
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-1')); // Should be synced

			const result = await syncSecretsToManagedRelay();

			expect(result.synced).toBe(1);
			expect(mockPublish).toHaveBeenCalledTimes(1);
		});

		it('counts multiple synced events correctly', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-1'));
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-2'));
			store.__addMockEvent(createMockEvent(30078, 'redshift-1'));
			store.__addMockEvent(createMockEvent(30078, 'redshift-2'));

			const result = await syncSecretsToManagedRelay();

			expect(result.synced).toBe(4);
			expect(result.errors).toBe(0);
			expect(mockPublish).toHaveBeenCalledTimes(4);
		});

		it('counts errors when publish fails', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-1'));
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-2'));

			// First publish succeeds, second fails
			mockPublish
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('Publish failed'));

			const result = await syncSecretsToManagedRelay();

			expect(result.synced).toBe(1);
			expect(result.errors).toBe(1);
		});

		it('continues syncing after an error', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-1'));
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-2'));
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-3'));

			// First fails, second and third succeed
			mockPublish
				.mockRejectedValueOnce(new Error('First failed'))
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(undefined);

			const result = await syncSecretsToManagedRelay();

			expect(result.synced).toBe(2);
			expect(result.errors).toBe(1);
			expect(mockPublish).toHaveBeenCalledTimes(3);
		});

		it('sets synced flag to prevent duplicate syncs', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-1'));

			// First sync
			await syncSecretsToManagedRelay();
			expect(mockPublish).toHaveBeenCalledTimes(1);

			// Add another event
			store.__addMockEvent(createMockEvent(1059, 'gift-wrap-2'));

			// Second sync should not publish
			const result = await syncSecretsToManagedRelay();
			expect(result).toEqual({ synced: 0, errors: 0 });
			expect(mockPublish).toHaveBeenCalledTimes(1); // Still 1
		});
	});

	describe('resetManagedRelaySync', () => {
		it('allows sync to run again after reset', async () => {
			const store = eventStore as unknown as { __addMockEvent: (e: NostrEvent) => void };
			store.__addMockEvent({
				id: 'event-1',
				kind: 1059,
				pubkey: 'test',
				created_at: 123,
				content: '',
				tags: [],
				sig: '',
			});

			// First sync
			await syncSecretsToManagedRelay();
			expect(mockPublish).toHaveBeenCalledTimes(1);

			// Reset
			resetManagedRelaySync();

			// Second sync should work
			await syncSecretsToManagedRelay();
			expect(mockPublish).toHaveBeenCalledTimes(2);
		});
	});

	describe('clearPaymentCache', () => {
		it('clears cached payment status', async () => {
			const pubkey = '000000000000000000000000000000000000000000000000000000000000000f';
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ paid: true }),
			});

			// First call caches the result
			await checkManagedRelayAccess(pubkey);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Second call uses cache
			await checkManagedRelayAccess(pubkey);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Clear cache
			clearPaymentCache();

			// Third call should hit API again
			await checkManagedRelayAccess(pubkey);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});
});
