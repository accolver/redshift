// Set up fake-indexeddb globals BEFORE any imports that might use them
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

import '@testing-library/jest-dom/vitest';
import '@testing-library/svelte/vitest';

// Ensure sessionStorage is available in test environment
// jsdom provides it but it may not be globally available in all test contexts
if (typeof globalThis.sessionStorage === 'undefined') {
	const storage = new Map<string, string>();
	globalThis.sessionStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
		clear: () => storage.clear(),
		key: (index: number) => Array.from(storage.keys())[index] ?? null,
		get length() {
			return storage.size;
		},
	};
}
