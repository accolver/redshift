// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}

		interface Platform {
			env: {
				// BTCPay webhook secret for HMAC validation
				BTCPAY_WEBHOOK_SECRET?: string;
				// BTCPay API credentials
				BTCPAY_URL?: string;
				BTCPAY_API_KEY?: string;
				BTCPAY_STORE_ID?: string;
				// Relay operator private key for signing tokens
				RELAY_OPERATOR_NSEC?: string;
				// Optional: KV namespace for caching
				CACHE?: KVNamespace;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
