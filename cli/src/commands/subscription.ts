/**
 * Subscription Command - Manage Cloud tier subscription
 *
 * Commands:
 * - redshift subscription status  - Show current subscription status
 * - redshift subscription upgrade - Open browser to upgrade/renew
 *
 * L5: Journey-Validator - Subscription management workflow
 */

import { getPublicKey } from 'nostr-tools/pure';
import { npubEncode } from 'nostr-tools/nip19';
import { tryAuth } from './login';
import { loadConfig, saveConfig } from '../lib/config';

/**
 * Cloud subscription status from API or local cache
 */
export interface SubscriptionStatus {
	active: boolean;
	tier?: 'cloud' | 'teams' | 'enterprise';
	expiresAt?: number;
	daysRemaining?: number;
	relayUrl?: string;
}

// Re-export for use in tests
export type { CachedSubscription } from '../lib/config';

export type SubscriptionSubcommand = 'status' | 'upgrade';

export interface SubscriptionOptions {
	subcommand: SubscriptionSubcommand;
	/** Force refresh from API (skip cache) */
	refresh?: boolean;
	/** Output as JSON */
	json?: boolean;
}

// Cache duration: 1 hour
const CACHE_DURATION_MS = 60 * 60 * 1000;

// API base URL
const API_BASE_URL = 'https://redshiftapp.com';

/**
 * Execute the subscription command
 */
export async function subscriptionCommand(options: SubscriptionOptions): Promise<void> {
	switch (options.subcommand) {
		case 'status':
			await showSubscriptionStatus(options);
			break;
		case 'upgrade':
			await openUpgradePage();
			break;
		default:
			// Default to status
			await showSubscriptionStatus(options);
	}
}

/**
 * Show current subscription status
 */
async function showSubscriptionStatus(options: SubscriptionOptions): Promise<void> {
	const auth = await tryAuth();

	if (!auth) {
		if (options.json) {
			console.log(JSON.stringify({ authenticated: false, subscription: null }));
		} else {
			console.log('Not logged in. Run `redshift login` first.');
		}
		return;
	}

	const pubkey = getPublicKey(auth.privateKey);

	// Try to get cached status first (unless refresh requested)
	let status: SubscriptionStatus | null = null;

	if (!options.refresh) {
		status = await getCachedSubscription(pubkey);
	}

	// Fetch from API if no cache or cache is stale
	if (!status) {
		status = await fetchSubscriptionStatus(pubkey);

		// Cache the result
		if (status) {
			await cacheSubscription(pubkey, status);
		}
	}

	// Display status
	if (options.json) {
		console.log(
			JSON.stringify({
				authenticated: true,
				pubkey,
				npub: npubEncode(pubkey),
				subscription: status,
			}),
		);
		return;
	}

	if (!status) {
		console.log('Unable to fetch subscription status.');
		console.log('You may be offline or the service is unavailable.');
		return;
	}

	console.log('Subscription Status');
	console.log('===================');
	console.log('');

	if (status.active) {
		const tierLabel = getTierLabel(status.tier);
		console.log(`  Plan: ${tierLabel}`);

		if (status.expiresAt) {
			const expiresDate = new Date(status.expiresAt * 1000).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
			console.log(`  Expires: ${expiresDate}`);
		}

		if (status.daysRemaining !== undefined) {
			if (status.daysRemaining <= 7) {
				console.log(`  Days remaining: ${status.daysRemaining} (expiring soon!)`);
			} else {
				console.log(`  Days remaining: ${status.daysRemaining}`);
			}
		}

		if (status.relayUrl) {
			console.log(`  Managed relay: ${status.relayUrl}`);
		}

		console.log('');
		console.log('✓ Your Cloud subscription is active.');

		if (status.daysRemaining !== undefined && status.daysRemaining <= 7) {
			console.log('');
			console.log('⚠ Your subscription is expiring soon.');
			console.log('  Run `redshift subscription upgrade` to renew.');
		}
	} else {
		console.log('  Plan: Free');
		console.log('');
		console.log('You are using the free tier with public relays.');
		console.log('');
		console.log('Upgrade to Cloud for:');
		console.log('  • Managed relay infrastructure');
		console.log('  • Automatic encrypted backups');
		console.log('  • 99.5% uptime SLA');
		console.log('  • 90-day audit log retention');
		console.log('');
		console.log('Run `redshift subscription upgrade` to subscribe ($5/month).');
	}
}

/**
 * Open the upgrade page in the browser
 */
async function openUpgradePage(): Promise<void> {
	const auth = await tryAuth();

	if (!auth) {
		console.log('Not logged in. Run `redshift login` first.');
		return;
	}

	const url = `${API_BASE_URL}/admin/subscribe`;

	console.log('Opening subscription page in your browser...');
	console.log(`  ${url}`);
	console.log('');
	console.log('Complete payment with Bitcoin (Lightning or on-chain).');

	// Open browser
	await openBrowser(url);
}

/**
 * Fetch subscription status from API
 */
async function fetchSubscriptionStatus(pubkey: string): Promise<SubscriptionStatus | null> {
	try {
		const response = await fetch(`${API_BASE_URL}/api/subscription/${pubkey}`, {
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			if (response.status === 429) {
				console.error('Rate limited. Please try again later.');
			}
			return null;
		}

		return (await response.json()) as SubscriptionStatus;
	} catch (error) {
		// Network error - could be offline
		return null;
	}
}

/**
 * Get cached subscription status
 */
async function getCachedSubscription(pubkey: string): Promise<SubscriptionStatus | null> {
	try {
		const config = await loadConfig();
		const cached = config.subscription;

		if (!cached) return null;

		// Check if cache is for the same user
		if (cached.pubkey !== pubkey) return null;

		// Check if cache is stale
		if (Date.now() - cached.fetchedAt > CACHE_DURATION_MS) return null;

		return cached.status;
	} catch {
		return null;
	}
}

/**
 * Cache subscription status
 */
async function cacheSubscription(pubkey: string, status: SubscriptionStatus): Promise<void> {
	try {
		const config = await loadConfig();
		config.subscription = {
			status,
			fetchedAt: Date.now(),
			pubkey,
		};
		await saveConfig(config);
	} catch {
		// Ignore cache errors
	}
}

/**
 * Get human-readable tier label
 */
function getTierLabel(tier: string | undefined): string {
	switch (tier) {
		case 'cloud':
			return 'Cloud ($5/month)';
		case 'teams':
			return 'Teams';
		case 'enterprise':
			return 'Enterprise';
		default:
			return 'Free';
	}
}

/**
 * Open URL in the default browser
 */
async function openBrowser(url: string): Promise<void> {
	const platform = process.platform;

	try {
		if (platform === 'darwin') {
			// macOS
			Bun.spawn(['open', url]);
		} else if (platform === 'win32') {
			// Windows
			Bun.spawn(['cmd', '/c', 'start', url]);
		} else {
			// Linux and others
			Bun.spawn(['xdg-open', url]);
		}
	} catch {
		console.log('');
		console.log('Could not open browser automatically.');
		console.log(`Please visit: ${url}`);
	}
}

/**
 * Get subscription status for display in version output
 * Returns a short string like "Cloud" or "Free"
 */
export async function getSubscriptionLabel(): Promise<string> {
	const auth = await tryAuth();

	if (!auth) {
		return 'Free (not logged in)';
	}

	const pubkey = getPublicKey(auth.privateKey);
	const status = await getCachedSubscription(pubkey);

	if (!status) {
		return 'Free';
	}

	if (status.active && status.tier) {
		const daysInfo =
			status.daysRemaining !== undefined && status.daysRemaining <= 7
				? ` (${status.daysRemaining}d left)`
				: '';
		return `${getTierLabel(status.tier).split(' ')[0]}${daysInfo}`;
	}

	return 'Free';
}
