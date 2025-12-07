/**
 * Secure Storage using IndexedDB + Web Crypto API
 *
 * This module provides encrypted storage for sensitive data like nsec keys.
 * It uses a non-extractable AES-GCM key stored in IndexedDB to encrypt data
 * before storing it in sessionStorage.
 *
 * Security properties:
 * - The encryption key is marked as non-extractable, meaning JavaScript cannot
 *   read the raw key bytes - it can only be used for encrypt/decrypt operations
 * - An XSS attacker reading sessionStorage only gets encrypted ciphertext
 * - The attacker would need same-origin access to call crypto.subtle.decrypt()
 *
 * Limitations:
 * - A sophisticated attacker with full XSS could still call decrypt()
 * - This is defense-in-depth, not bulletproof
 * - For maximum security, use a NIP-07 extension instead
 */

const DB_NAME = 'redshift-secure';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_ID = 'encryption-key';
const STORAGE_PREFIX = 'redshift_encrypted_';

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
	});
}

/**
 * Generate a new AES-GCM encryption key
 * The key is marked as non-extractable for security
 */
async function generateEncryptionKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(
		{
			name: 'AES-GCM',
			length: 256,
		},
		false, // non-extractable - cannot read raw key bytes
		['encrypt', 'decrypt'],
	);
}

/**
 * Store the encryption key in IndexedDB
 */
async function storeKey(key: CryptoKey): Promise<void> {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.put({ id: KEY_ID, key });

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		transaction.oncomplete = () => db.close();
	});
}

/**
 * Retrieve the encryption key from IndexedDB
 */
async function getKey(): Promise<CryptoKey | null> {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(KEY_ID);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const result = request.result;
			resolve(result?.key ?? null);
		};
		transaction.oncomplete = () => db.close();
	});
}

/**
 * Get or create the encryption key
 */
async function getOrCreateKey(): Promise<CryptoKey> {
	let key = await getKey();
	if (!key) {
		key = await generateEncryptionKey();
		await storeKey(key);
	}
	return key;
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(key: CryptoKey, data: string): Promise<string> {
	const encoder = new TextEncoder();
	const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

	const encryptedBuffer = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv,
		},
		key,
		encoder.encode(data),
	);

	// Combine IV + ciphertext and encode as base64
	const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encryptedBuffer), iv.length);

	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(key: CryptoKey, encryptedData: string): Promise<string> {
	// Decode base64
	const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

	// Extract IV and ciphertext
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);

	const decryptedBuffer = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv,
		},
		key,
		ciphertext,
	);

	return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Get sessionStorage safely (handles SSR and test environments)
 */
function getSessionStorage(): Storage | null {
	if (typeof sessionStorage !== 'undefined') {
		return sessionStorage;
	}
	return null;
}

/**
 * Securely store a value
 * The value is encrypted with a non-extractable key before storage
 */
export async function secureStore(name: string, value: string): Promise<void> {
	const storage = getSessionStorage();
	if (!storage) return;

	const key = await getOrCreateKey();
	const encrypted = await encrypt(key, value);
	storage.setItem(STORAGE_PREFIX + name, encrypted);
}

/**
 * Securely retrieve a value
 * Returns null if the value doesn't exist or decryption fails
 */
export async function secureRetrieve(name: string): Promise<string | null> {
	const storage = getSessionStorage();
	if (!storage) return null;

	const encrypted = storage.getItem(STORAGE_PREFIX + name);
	if (!encrypted) {
		return null;
	}

	const key = await getKey();
	if (!key) {
		// Key was deleted but encrypted data exists - clear it
		storage.removeItem(STORAGE_PREFIX + name);
		return null;
	}

	try {
		return await decrypt(key, encrypted);
	} catch {
		// Decryption failed (corrupted data, wrong key, etc.)
		storage.removeItem(STORAGE_PREFIX + name);
		return null;
	}
}

/**
 * Remove a securely stored value
 */
export function secureRemove(name: string): void {
	const storage = getSessionStorage();
	if (!storage) return;
	storage.removeItem(STORAGE_PREFIX + name);
}

/**
 * Clear all secure storage (both IndexedDB key and sessionStorage)
 */
export async function secureClearAll(): Promise<void> {
	// Clear sessionStorage items with our prefix
	const storage = getSessionStorage();
	if (storage) {
		const keysToRemove: string[] = [];
		for (let i = 0; i < storage.length; i++) {
			const key = storage.key(i);
			if (key?.startsWith(STORAGE_PREFIX)) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			storage.removeItem(key);
		}
	}

	// Delete the encryption key from IndexedDB
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(KEY_ID);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		transaction.oncomplete = () => db.close();
	});
}

/**
 * Check if secure storage is available (Web Crypto + IndexedDB)
 */
export function isSecureStorageAvailable(): boolean {
	return (
		typeof crypto !== 'undefined' &&
		typeof crypto.subtle !== 'undefined' &&
		typeof indexedDB !== 'undefined'
	);
}
