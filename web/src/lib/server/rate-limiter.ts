/**
 * Server-side Rate Limiter for API Endpoints
 *
 * Uses Cloudflare KV for distributed rate limiting across edge locations.
 * Falls back to in-memory storage for development.
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	/** Maximum requests allowed in the window */
	maxRequests: number;
	/** Time window in seconds */
	windowSeconds: number;
	/** Key prefix for storage */
	keyPrefix?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** Requests remaining in the current window */
	remaining: number;
	/** Unix timestamp when the window resets */
	resetAt: number;
	/** Current request count in the window */
	current: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
	/** Standard API endpoint: 60 requests per minute */
	standard: { maxRequests: 60, windowSeconds: 60 } as RateLimitConfig,
	/** Subscription endpoint: 10 requests per minute (creates invoices) */
	subscribe: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
	/** Webhook endpoint: 100 requests per minute (called by BTCPay) */
	webhook: { maxRequests: 100, windowSeconds: 60 } as RateLimitConfig,
	/** Strict limit for auth operations: 5 per minute */
	auth: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
} as const;

/**
 * In-memory rate limit storage (for development/fallback)
 */
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * Clean up expired entries from memory store
 */
function cleanMemoryStore(): void {
	const now = Date.now();
	for (const [key, value] of memoryStore.entries()) {
		if (value.expiresAt < now) {
			memoryStore.delete(key);
		}
	}
}

// Clean memory store every 60 seconds
if (typeof setInterval !== 'undefined') {
	setInterval(cleanMemoryStore, 60000);
}

/**
 * Check and update rate limit using Cloudflare KV
 */
async function checkRateLimitKV(
	kv: KVNamespace,
	key: string,
	config: RateLimitConfig,
): Promise<RateLimitResult> {
	const now = Math.floor(Date.now() / 1000);
	const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
	const resetAt = windowStart + config.windowSeconds;
	const storageKey = `${config.keyPrefix ?? 'rate'}:${key}:${windowStart}`;

	// Get current count
	const currentValue = await kv.get(storageKey);
	const current = currentValue ? Number.parseInt(currentValue, 10) : 0;

	if (current >= config.maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetAt,
			current,
		};
	}

	// Increment count
	const newCount = current + 1;
	await kv.put(storageKey, newCount.toString(), {
		expirationTtl: config.windowSeconds + 60, // Extra 60s buffer
	});

	return {
		allowed: true,
		remaining: config.maxRequests - newCount,
		resetAt,
		current: newCount,
	};
}

/**
 * Check and update rate limit using in-memory storage
 */
function checkRateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
	const now = Date.now();
	const windowStart =
		Math.floor(now / (config.windowSeconds * 1000)) * (config.windowSeconds * 1000);
	const resetAt = Math.floor((windowStart + config.windowSeconds * 1000) / 1000);
	const storageKey = `${config.keyPrefix ?? 'rate'}:${key}:${windowStart}`;

	const entry = memoryStore.get(storageKey);
	const current = entry?.count ?? 0;

	if (current >= config.maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetAt,
			current,
		};
	}

	// Increment count
	const newCount = current + 1;
	memoryStore.set(storageKey, {
		count: newCount,
		expiresAt: windowStart + config.windowSeconds * 1000 + 60000,
	});

	return {
		allowed: true,
		remaining: config.maxRequests - newCount,
		resetAt,
		current: newCount,
	};
}

/**
 * Check rate limit for a request
 *
 * @param identifier - Unique identifier for the client (IP, pubkey, etc.)
 * @param config - Rate limit configuration
 * @param kv - Optional Cloudflare KV namespace
 * @returns Rate limit result
 */
export async function checkRateLimit(
	identifier: string,
	config: RateLimitConfig,
	kv?: KVNamespace,
): Promise<RateLimitResult> {
	if (kv) {
		return checkRateLimitKV(kv, identifier, config);
	}
	return checkRateLimitMemory(identifier, config);
}

/**
 * Get rate limit headers for a response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
	return {
		'X-RateLimit-Limit': result.current.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': result.resetAt.toString(),
	};
}

/**
 * Extract client identifier from request
 * Prefers CF-Connecting-IP, falls back to X-Forwarded-For, then X-Real-IP
 */
export function getClientIdentifier(request: Request): string {
	return (
		request.headers.get('CF-Connecting-IP') ??
		request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
		request.headers.get('X-Real-IP') ??
		'unknown'
	);
}
