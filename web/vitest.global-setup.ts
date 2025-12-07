// Global setup - runs once before all tests
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

export function setup() {
	globalThis.indexedDB = indexedDB;
	globalThis.IDBKeyRange = IDBKeyRange;

	// sessionStorage mock
	if (typeof globalThis.sessionStorage === 'undefined') {
		const storage = new Map<string, string>();
		globalThis.sessionStorage = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => { storage.set(key, value); },
			removeItem: (key: string) => { storage.delete(key); },
			clear: () => storage.clear(),
			key: (index: number) => Array.from(storage.keys())[index] ?? null,
			get length() { return storage.size; },
		} as Storage;
	}
}
