/**
 * Keychain Integration - Secure credential storage
 *
 * L2: Function-Author - Keychain operations
 * L4: Integration-Contractor - OS keychain APIs
 *
 * Uses Bun.secrets for cross-platform keychain access:
 * - macOS: Keychain Services
 * - Windows: Windows Credential Manager
 * - Linux: libsecret (GNOME Keyring, KWallet, etc.)
 */

/**
 * Service identifier for Redshift CLI credentials
 * Using reverse domain notation (UTI format) for best compatibility
 */
const KEYCHAIN_SERVICE = 'com.redshiftapp.cli';

/**
 * Credential names stored in keychain
 */
const KEYCHAIN_NSEC = 'nsec';

/**
 * Check if keychain is available on this system
 */
export async function isKeychainAvailable(): Promise<boolean> {
	// Bun.secrets is only available in Bun runtime
	if (typeof Bun === 'undefined' || !Bun.secrets) {
		return false;
	}

	try {
		// Try a get operation to test availability
		// This will fail gracefully if the keychain service isn't running
		await Bun.secrets.get({ service: KEYCHAIN_SERVICE, name: '__test__' });
		return true;
	} catch {
		// Keychain not available (e.g., no secret service on Linux)
		return false;
	}
}

/**
 * Store nsec in the system keychain
 *
 * @param nsec - The nsec (bech32 format) to store
 * @returns true if stored successfully, false if keychain unavailable
 */
export async function storeNsecInKeychain(nsec: string): Promise<boolean> {
	if (typeof Bun === 'undefined' || !Bun.secrets) {
		return false;
	}

	try {
		await Bun.secrets.set({
			service: KEYCHAIN_SERVICE,
			name: KEYCHAIN_NSEC,
			value: nsec,
		});
		return true;
	} catch (error) {
		// Log for debugging but don't throw - caller will fall back to file
		console.error('Keychain storage failed:', error instanceof Error ? error.message : error);
		return false;
	}
}

/**
 * Retrieve nsec from the system keychain
 *
 * @returns The nsec if found, null if not found or keychain unavailable
 */
export async function getNsecFromKeychain(): Promise<string | null> {
	if (typeof Bun === 'undefined' || !Bun.secrets) {
		return null;
	}

	try {
		const nsec = await Bun.secrets.get({
			service: KEYCHAIN_SERVICE,
			name: KEYCHAIN_NSEC,
		});
		return nsec;
	} catch {
		// Keychain unavailable or error - return null
		return null;
	}
}

/**
 * Delete nsec from the system keychain
 *
 * @returns true if deleted (or didn't exist), false if keychain unavailable
 */
export async function deleteNsecFromKeychain(): Promise<boolean> {
	if (typeof Bun === 'undefined' || !Bun.secrets) {
		return false;
	}

	try {
		await Bun.secrets.delete({
			service: KEYCHAIN_SERVICE,
			name: KEYCHAIN_NSEC,
		});
		return true;
	} catch {
		// Keychain unavailable - return false
		return false;
	}
}

/**
 * Get the keychain service name (for display/debugging)
 */
export function getKeychainServiceName(): string {
	return KEYCHAIN_SERVICE;
}
