/**
 * Subscription Command Tests
 *
 * L2: Function-Author - Tests for subscription logic
 * L5: Journey-Validator - Subscription management flow
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nsecEncode } from 'nostr-tools/nip19';

import {
	subscriptionCommand,
	getSubscriptionLabel,
	type SubscriptionStatus,
	type CachedSubscription,
} from '../../src/commands/subscription';
import { saveConfig, loadConfig } from '../../src/lib/config';

/**
 * Helper to mock fetch with proper typing
 */
function mockFetch(fn: () => Promise<Response>): typeof fetch {
	return mock(fn) as unknown as typeof fetch;
}

describe('Subscription Command', () => {
	const testDir = join(tmpdir(), `redshift-subscription-test-${Date.now()}`);
	const originalEnv = { ...process.env };
	const consoleLogs: string[] = [];
	const originalConsoleLog = console.log;
	const originalConsoleError = console.error;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		// Clean test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });

		// Set test config directory
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		// Clear any existing nsec env var
		delete process.env.REDSHIFT_NSEC;
		delete process.env.REDSHIFT_BUNKER;

		// Capture console output
		consoleLogs.length = 0;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.map(String).join(' '));
		};
		console.error = (...args: unknown[]) => {
			consoleLogs.push(args.map(String).join(' '));
		};
	});

	afterEach(() => {
		// Restore environment
		process.env = { ...originalEnv };
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		globalThis.fetch = originalFetch;
		// Clean up
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	describe('subscriptionCommand - status subcommand', () => {
		it('shows not logged in message when no auth', async () => {
			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Not logged in'))).toBe(true);
		});

		it('outputs JSON when not logged in with --json flag', async () => {
			await subscriptionCommand({ subcommand: 'status', json: true });

			const jsonOutput = consoleLogs.find((log) => log.startsWith('{'));
			expect(jsonOutput).toBeDefined();
			const parsed = JSON.parse(jsonOutput!);
			expect(parsed.authenticated).toBe(false);
			expect(parsed.subscription).toBeNull();
		});

		it('shows free tier when logged in but no subscription', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(JSON.stringify({ active: false }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					}),
				),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Plan: Free'))).toBe(true);
			expect(consoleLogs.some((log) => log.includes('You are using the free tier'))).toBe(true);
		});

		it('shows active subscription details', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'cloud',
							expiresAt,
							daysRemaining: 30,
							relayUrl: 'wss://relay.cloud.redshiftapp.com',
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Cloud'))).toBe(true);
			expect(consoleLogs.some((log) => log.includes('Days remaining: 30'))).toBe(true);
			expect(consoleLogs.some((log) => log.includes('wss://relay.cloud.redshiftapp.com'))).toBe(
				true,
			);
			expect(consoleLogs.some((log) => log.includes('subscription is active'))).toBe(true);
		});

		it('shows expiring soon warning when < 7 days remaining', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'cloud',
							daysRemaining: 5,
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('expiring soon'))).toBe(true);
		});

		it('outputs JSON with subscription details when --json flag', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'cloud',
							daysRemaining: 30,
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
			);

			await subscriptionCommand({ subcommand: 'status', json: true });

			const jsonOutput = consoleLogs.find((log) => log.startsWith('{'));
			expect(jsonOutput).toBeDefined();
			const parsed = JSON.parse(jsonOutput!);
			expect(parsed.authenticated).toBe(true);
			expect(parsed.pubkey).toBe(pubkey);
			expect(parsed.npub).toMatch(/^npub1/);
			expect(parsed.subscription.active).toBe(true);
			expect(parsed.subscription.tier).toBe('cloud');
		});

		it('uses cached subscription when available', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);

			const cachedStatus: SubscriptionStatus = {
				active: true,
				tier: 'cloud',
				daysRemaining: 25,
			};

			await saveConfig({
				authMethod: 'nsec',
				nsec,
			});

			// Save cached subscription separately (since it's not typed in Config)
			const config = await loadConfig();
			(config as Record<string, unknown>).subscription = {
				status: cachedStatus,
				fetchedAt: Date.now(), // Recent cache
				pubkey,
			} satisfies CachedSubscription;
			await saveConfig(config);

			// Fetch should not be called
			let fetchCalled = false;
			globalThis.fetch = mockFetch(() => {
				fetchCalled = true;
				return Promise.resolve(new Response('{}'));
			});

			await subscriptionCommand({ subcommand: 'status' });

			expect(fetchCalled).toBe(false);
			expect(consoleLogs.some((log) => log.includes('Days remaining: 25'))).toBe(true);
		});

		it('ignores stale cache and fetches fresh data', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);

			const cachedStatus: SubscriptionStatus = {
				active: true,
				tier: 'cloud',
				daysRemaining: 25,
			};

			await saveConfig({
				authMethod: 'nsec',
				nsec,
			});

			// Save stale cached subscription (2 hours old)
			const config = await loadConfig();
			(config as Record<string, unknown>).subscription = {
				status: cachedStatus,
				fetchedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
				pubkey,
			} satisfies CachedSubscription;
			await saveConfig(config);

			// Fetch should be called since cache is stale
			let fetchCalled = false;
			globalThis.fetch = mockFetch(() => {
				fetchCalled = true;
				return Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'cloud',
							daysRemaining: 20,
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				);
			});

			await subscriptionCommand({ subcommand: 'status' });

			expect(fetchCalled).toBe(true);
			// Should show fresh data
			expect(consoleLogs.some((log) => log.includes('Days remaining: 20'))).toBe(true);
		});

		it('skips cache when --refresh flag is set', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);

			const cachedStatus: SubscriptionStatus = {
				active: true,
				tier: 'cloud',
				daysRemaining: 25,
			};

			await saveConfig({
				authMethod: 'nsec',
				nsec,
			});

			// Save fresh cached subscription
			const config = await loadConfig();
			(config as Record<string, unknown>).subscription = {
				status: cachedStatus,
				fetchedAt: Date.now(), // Fresh cache
				pubkey,
			} satisfies CachedSubscription;
			await saveConfig(config);

			// Fetch should be called due to --refresh
			let fetchCalled = false;
			globalThis.fetch = mockFetch(() => {
				fetchCalled = true;
				return Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'cloud',
							daysRemaining: 20,
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				);
			});

			await subscriptionCommand({ subcommand: 'status', refresh: true });

			expect(fetchCalled).toBe(true);
			// Should show fresh data, not cached
			expect(consoleLogs.some((log) => log.includes('Days remaining: 20'))).toBe(true);
		});

		it('handles API errors gracefully', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(new Response('Server Error', { status: 500 })),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Unable to fetch'))).toBe(true);
		});

		it('handles rate limiting', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(new Response('Rate Limited', { status: 429 })),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Rate limited'))).toBe(true);
		});

		it('handles network errors gracefully', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mock(() =>
				Promise.reject(new Error('Network error')),
			) as unknown as typeof fetch;

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Unable to fetch'))).toBe(true);
		});
	});

	describe('subscriptionCommand - upgrade subcommand', () => {
		it('shows not logged in message when no auth', async () => {
			await subscriptionCommand({ subcommand: 'upgrade' });

			expect(consoleLogs.some((log) => log.includes('Not logged in'))).toBe(true);
		});

		it('shows upgrade URL when logged in', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			// Mock Bun.spawn to not actually open browser
			const originalSpawn = Bun.spawn;
			(Bun as unknown as { spawn: typeof Bun.spawn }).spawn = mock(
				() => ({ pid: 123 }) as ReturnType<typeof Bun.spawn>,
			);

			try {
				await subscriptionCommand({ subcommand: 'upgrade' });

				expect(consoleLogs.some((log) => log.includes('Opening subscription page'))).toBe(true);
				expect(
					consoleLogs.some((log) => log.includes('https://redshiftapp.com/admin/subscribe')),
				).toBe(true);
			} finally {
				(Bun as unknown as { spawn: typeof Bun.spawn }).spawn = originalSpawn;
			}
		});
	});

	describe('getSubscriptionLabel', () => {
		it('returns "Free (not logged in)" when no auth', async () => {
			const label = await getSubscriptionLabel();
			expect(label).toBe('Free (not logged in)');
		});

		it('returns "Free" when logged in but no cached subscription', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			const label = await getSubscriptionLabel();
			expect(label).toBe('Free');
		});

		it('returns tier label from cached subscription', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);

			await saveConfig({
				authMethod: 'nsec',
				nsec,
			});

			const config = await loadConfig();
			(config as Record<string, unknown>).subscription = {
				status: {
					active: true,
					tier: 'cloud',
					daysRemaining: 30,
				} satisfies SubscriptionStatus,
				fetchedAt: Date.now(),
				pubkey,
			} satisfies CachedSubscription;
			await saveConfig(config);

			const label = await getSubscriptionLabel();
			expect(label).toBe('Cloud');
		});

		it('includes days remaining warning when < 7 days', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);

			await saveConfig({
				authMethod: 'nsec',
				nsec,
			});

			const config = await loadConfig();
			(config as Record<string, unknown>).subscription = {
				status: {
					active: true,
					tier: 'cloud',
					daysRemaining: 3,
				} satisfies SubscriptionStatus,
				fetchedAt: Date.now(),
				pubkey,
			} satisfies CachedSubscription;
			await saveConfig(config);

			const label = await getSubscriptionLabel();
			expect(label).toBe('Cloud (3d left)');
		});

		it('returns "Free" for inactive subscription', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const pubkey = getPublicKey(sk);

			await saveConfig({
				authMethod: 'nsec',
				nsec,
			});

			const config = await loadConfig();
			(config as Record<string, unknown>).subscription = {
				status: {
					active: false,
				} satisfies SubscriptionStatus,
				fetchedAt: Date.now(),
				pubkey,
			} satisfies CachedSubscription;
			await saveConfig(config);

			const label = await getSubscriptionLabel();
			expect(label).toBe('Free');
		});
	});

	describe('tier label formatting', () => {
		it('formats cloud tier correctly', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'cloud',
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Cloud ($5/month)'))).toBe(true);
		});

		it('formats teams tier correctly', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'teams',
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Teams'))).toBe(true);
		});

		it('formats enterprise tier correctly', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await saveConfig({ authMethod: 'nsec', nsec });

			globalThis.fetch = mockFetch(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							active: true,
							tier: 'enterprise',
						} satisfies SubscriptionStatus),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
			);

			await subscriptionCommand({ subcommand: 'status' });

			expect(consoleLogs.some((log) => log.includes('Enterprise'))).toBe(true);
		});
	});
});
