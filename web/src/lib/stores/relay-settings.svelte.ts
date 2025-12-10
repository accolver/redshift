/**
 * Relay Settings Store using Svelte 5 Runes
 *
 * Manages user relay configuration including:
 * - Custom relay list
 * - Redshift Cloud relay (for subscribers)
 * - Persistence to localStorage
 * - Auto-detection of Cloud relay for subscribers
 */

import { DEFAULT_RELAYS } from './nostr.svelte';
import { hasActiveSubscription, getManagedRelayUrl } from './subscription.svelte';

/** Redshift Cloud relay URL */
export const REDSHIFT_CLOUD_RELAY = 'wss://relay.redshiftapp.com';

/**
 * Relay configuration
 */
export interface RelayConfig {
	/** User's custom relays */
	customRelays: string[];
	/** Whether to use Redshift Cloud relay (if subscribed) */
	useCloudRelay: boolean;
	/** Whether to include default public relays as fallback */
	useDefaultRelays: boolean;
}

/**
 * Relay settings state
 */
interface RelaySettingsState {
	/** Current relay configuration */
	config: RelayConfig;
	/** Whether settings have been modified */
	isDirty: boolean;
	/** Loading state */
	loading: boolean;
	/** Error message if any */
	error: string | null;
}

// Storage key for localStorage
const STORAGE_KEY = 'redshift_relay_settings';

// Default configuration
const DEFAULT_CONFIG: RelayConfig = {
	customRelays: [],
	useCloudRelay: true, // Auto-use Cloud relay when subscribed
	useDefaultRelays: true, // Include public relays as fallback
};

/**
 * Load config from localStorage
 */
function loadFromStorage(): RelayConfig {
	if (typeof window === 'undefined') return DEFAULT_CONFIG;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as Partial<RelayConfig>;
			return {
				...DEFAULT_CONFIG,
				...parsed,
			};
		}
	} catch {
		// Ignore parse errors, use defaults
	}
	return DEFAULT_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveToStorage(config: RelayConfig): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// Ignore storage errors (quota exceeded, etc.)
	}
}

// Store state using $state rune
let relaySettingsState = $state<RelaySettingsState>({
	config: loadFromStorage(),
	isDirty: false,
	loading: false,
	error: null,
});

/**
 * Get the current relay settings state (reactive)
 */
export function getRelaySettingsState(): RelaySettingsState {
	return relaySettingsState;
}

/**
 * Get the effective relay list based on current settings and subscription
 *
 * Priority:
 * 1. Redshift Cloud relay (if subscribed and enabled)
 * 2. Custom relays (if any)
 * 3. Default public relays (if enabled)
 */
export function getEffectiveRelays(): string[] {
	const config = relaySettingsState.config;
	const relays: string[] = [];

	// Add Cloud relay first if subscribed and enabled
	if (config.useCloudRelay && hasActiveSubscription()) {
		const cloudRelay = getManagedRelayUrl() || REDSHIFT_CLOUD_RELAY;
		relays.push(cloudRelay);
	}

	// Add custom relays
	if (config.customRelays.length > 0) {
		for (const relay of config.customRelays) {
			if (!relays.includes(relay)) {
				relays.push(relay);
			}
		}
	}

	// Add default relays as fallback
	if (config.useDefaultRelays) {
		for (const relay of DEFAULT_RELAYS) {
			if (!relays.includes(relay)) {
				relays.push(relay);
			}
		}
	}

	// If nothing is configured, always return defaults
	if (relays.length === 0) {
		return [...DEFAULT_RELAYS];
	}

	return relays;
}

/**
 * Check if Cloud relay is available (user has active subscription)
 */
export function isCloudRelayAvailable(): boolean {
	return hasActiveSubscription();
}

/**
 * Check if Cloud relay is currently in use
 */
export function isUsingCloudRelay(): boolean {
	return relaySettingsState.config.useCloudRelay && hasActiveSubscription();
}

/**
 * Add a custom relay
 */
export function addCustomRelay(url: string): boolean {
	const normalizedUrl = normalizeRelayUrl(url);

	if (!normalizedUrl) {
		relaySettingsState.error = 'Invalid relay URL';
		return false;
	}

	if (relaySettingsState.config.customRelays.includes(normalizedUrl)) {
		relaySettingsState.error = 'Relay already added';
		return false;
	}

	relaySettingsState.config = {
		...relaySettingsState.config,
		customRelays: [...relaySettingsState.config.customRelays, normalizedUrl],
	};
	relaySettingsState.isDirty = true;
	relaySettingsState.error = null;

	saveToStorage(relaySettingsState.config);
	return true;
}

/**
 * Remove a custom relay
 */
export function removeCustomRelay(url: string): void {
	relaySettingsState.config = {
		...relaySettingsState.config,
		customRelays: relaySettingsState.config.customRelays.filter((r) => r !== url),
	};
	relaySettingsState.isDirty = true;
	relaySettingsState.error = null;

	saveToStorage(relaySettingsState.config);
}

/**
 * Toggle use of Cloud relay
 */
export function setUseCloudRelay(enabled: boolean): void {
	relaySettingsState.config = {
		...relaySettingsState.config,
		useCloudRelay: enabled,
	};
	relaySettingsState.isDirty = true;
	relaySettingsState.error = null;

	saveToStorage(relaySettingsState.config);
}

/**
 * Toggle use of default public relays
 */
export function setUseDefaultRelays(enabled: boolean): void {
	relaySettingsState.config = {
		...relaySettingsState.config,
		useDefaultRelays: enabled,
	};
	relaySettingsState.isDirty = true;
	relaySettingsState.error = null;

	saveToStorage(relaySettingsState.config);
}

/**
 * Reset to default configuration
 */
export function resetRelaySettings(): void {
	relaySettingsState.config = { ...DEFAULT_CONFIG };
	relaySettingsState.isDirty = true;
	relaySettingsState.error = null;

	saveToStorage(relaySettingsState.config);
}

/**
 * Clear error
 */
export function clearRelaySettingsError(): void {
	relaySettingsState.error = null;
}

/**
 * Normalize a relay URL
 * - Ensure wss:// prefix
 * - Remove trailing slash
 * - Validate format
 */
function normalizeRelayUrl(url: string): string | null {
	try {
		let normalized = url.trim();

		// Add wss:// if no protocol specified
		if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
			normalized = `wss://${normalized}`;
		}

		// Parse and validate
		const parsed = new URL(normalized);

		// Must be websocket protocol
		if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
			return null;
		}

		// Return normalized URL without trailing slash
		return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
	} catch {
		return null;
	}
}

/**
 * Validate a relay URL format
 */
export function isValidRelayUrl(url: string): boolean {
	return normalizeRelayUrl(url) !== null;
}
