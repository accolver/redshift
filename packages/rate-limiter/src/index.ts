/**
 * Rate Limiter with Exponential Backoff for Relay Connections
 *
 * L4: Integration-Contractor - Provides resilient relay communication
 *
 * This module implements rate limiting and retry logic for Nostr relay
 * connections to prevent abuse and handle transient failures gracefully.
 */

import { type BackoffOptions, backOff } from 'exponential-backoff';

export interface QuorumReport<T> {
	operationId: string;
	required: number;
	accepted: T[];
	failed: Array<{ target: T; reason: string }>;
}

export class QuorumError<T> extends Error {
	readonly report: QuorumReport<T>;

	constructor(report: QuorumReport<T>) {
		super(
			`Quorum failed: ${report.accepted.length}/${report.required} targets accepted ${report.operationId}`,
		);
		this.name = 'QuorumError';
		this.report = report;
	}
}

export async function executeWithQuorum<T>(
	targets: T[],
	operationId: string,
	operation: (target: T) => Promise<void>,
	required = Math.floor(targets.length / 2) + 1,
): Promise<QuorumReport<T>> {
	const uniqueTargets = [...new Set(targets)];
	const normalizedRequired = Math.max(1, Math.min(required, uniqueTargets.length));
	const outcomes = await Promise.allSettled(uniqueTargets.map(operation));
	const report: QuorumReport<T> = {
		operationId,
		required: normalizedRequired,
		accepted: [],
		failed: [],
	};
	for (let index = 0; index < outcomes.length; index++) {
		const target = uniqueTargets[index];
		const outcome = outcomes[index];
		if (target === undefined || !outcome) continue;
		if (outcome.status === 'fulfilled') {
			report.accepted.push(target);
		} else {
			report.failed.push({
				target,
				reason: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
			});
		}
	}
	if (uniqueTargets.length === 0 || report.accepted.length < report.required) {
		throw new QuorumError(report);
	}
	return report;
}

/**
 * Default backoff configuration optimized for relay connections
 */
export const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
	numOfAttempts: 5,
	startingDelay: 1000, // 1 second
	timeMultiple: 2, // Double delay each attempt
	maxDelay: 30000, // Max 30 seconds between retries
	jitter: 'full', // Randomize to prevent thundering herd
	retry: (error: Error, attemptNumber: number) => {
		// Log retry attempts for debugging
		console.debug(`Relay operation failed (attempt ${attemptNumber}): ${error.message}`);
		// Continue retrying unless it's a permanent error
		return !isPermanentError(error);
	},
};

/**
 * Stricter backoff for publish operations (we want faster feedback)
 */
export const PUBLISH_BACKOFF_OPTIONS: BackoffOptions = {
	numOfAttempts: 3,
	startingDelay: 500, // 500ms
	timeMultiple: 2,
	maxDelay: 5000, // Max 5 seconds
	jitter: 'full',
	retry: (error: Error, attemptNumber: number) => {
		console.debug(`Publish failed (attempt ${attemptNumber}): ${error.message}`);
		return !isPermanentError(error);
	},
};

/**
 * Lenient backoff for query operations (we can wait longer)
 */
export const QUERY_BACKOFF_OPTIONS: BackoffOptions = {
	numOfAttempts: 5,
	startingDelay: 1000, // 1 second
	timeMultiple: 2,
	maxDelay: 60000, // Max 1 minute
	jitter: 'full',
	retry: (error: Error, attemptNumber: number) => {
		console.debug(`Query failed (attempt ${attemptNumber}): ${error.message}`);
		return !isPermanentError(error);
	},
};

/**
 * Error types that should not be retried
 */
const PERMANENT_ERROR_PATTERNS = [
	'invalid signature',
	'invalid event',
	'blocked',
	'banned',
	'forbidden',
	'unauthorized',
	'not found',
	'404',
	'401',
	'403',
];

/**
 * Check if an error is permanent and should not be retried
 */
export function isPermanentError(error: unknown): boolean {
	if (!error || typeof error !== 'object' || !('message' in error)) return false;
	const message = String((error as Error).message).toLowerCase();
	return PERMANENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Execute a relay operation with exponential backoff retry logic
 *
 * @param operation - The async operation to execute
 * @param options - Optional backoff configuration
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function withBackoff<T>(
	operation: () => Promise<T>,
	options: Partial<BackoffOptions> = {},
): Promise<T> {
	const mergedOptions: BackoffOptions = {
		...DEFAULT_BACKOFF_OPTIONS,
		...options,
	};

	return backOff(operation, mergedOptions);
}

/**
 * Execute a publish operation with appropriate backoff settings
 */
export async function withPublishBackoff<T>(
	operation: () => Promise<T>,
	options: Partial<BackoffOptions> = {},
): Promise<T> {
	const mergedOptions: BackoffOptions = {
		...PUBLISH_BACKOFF_OPTIONS,
		...options,
	};

	return backOff(operation, mergedOptions);
}

/**
 * Execute a query operation with appropriate backoff settings
 */
export async function withQueryBackoff<T>(
	operation: () => Promise<T>,
	options: Partial<BackoffOptions> = {},
): Promise<T> {
	const mergedOptions: BackoffOptions = {
		...QUERY_BACKOFF_OPTIONS,
		...options,
	};

	return backOff(operation, mergedOptions);
}

/**
 * Rate limiter state for tracking request frequency
 */
interface RateLimiterState {
	lastRequestTime: number;
	requestCount: number;
	windowStart: number;
}

/**
 * Simple rate limiter to prevent too many requests in a short time window.
 * Uses a promise-chain mutex to serialize concurrent waitForSlot() calls,
 * preventing race conditions where multiple callers read stale state.
 */
export class RateLimiter {
	private state: RateLimiterState = {
		lastRequestTime: 0,
		requestCount: 0,
		windowStart: Date.now(),
	};

	/** Promise-chain mutex: serializes concurrent waitForSlot() calls */
	private pending: Promise<void> = Promise.resolve();

	constructor(
		private readonly maxRequestsPerWindow: number = 10,
		private readonly windowMs: number = 1000,
		private readonly minDelayMs: number = 100,
	) {}

	/**
	 * Wait if necessary before making a request.
	 * Serialized via promise-chain mutex to prevent concurrent callers
	 * from reading stale state between async awaits.
	 */
	async waitForSlot(): Promise<void> {
		const slot = this.pending.then(() => this._waitForSlotInternal());
		this.pending = slot.catch(() => {}); // Don't let rejections block the chain
		return slot;
	}

	/**
	 * Internal implementation of waitForSlot rate limiting logic.
	 * Only called serially via the promise-chain mutex.
	 */
	private async _waitForSlotInternal(): Promise<void> {
		const now = Date.now();

		// Reset window if expired
		if (now - this.state.windowStart >= this.windowMs) {
			this.state.windowStart = now;
			this.state.requestCount = 0;
		}

		// Check if we're at the limit
		if (this.state.requestCount >= this.maxRequestsPerWindow) {
			const waitTime = this.windowMs - (now - this.state.windowStart);
			if (waitTime > 0) {
				await this.delay(waitTime);
				// Reset after waiting
				this.state.windowStart = Date.now();
				this.state.requestCount = 0;
			}
		}

		// Enforce minimum delay between requests
		const timeSinceLastRequest = now - this.state.lastRequestTime;
		if (timeSinceLastRequest < this.minDelayMs) {
			await this.delay(this.minDelayMs - timeSinceLastRequest);
		}

		this.state.lastRequestTime = Date.now();
		this.state.requestCount++;
	}

	/**
	 * Reset the rate limiter state
	 */
	reset(): void {
		this.state = {
			lastRequestTime: 0,
			requestCount: 0,
			windowStart: Date.now(),
		};
		this.pending = Promise.resolve();
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Create a rate-limited version of an async function
 */
export function withRateLimit<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	limiter: RateLimiter,
): (...args: T) => Promise<R> {
	return async (...args: T): Promise<R> => {
		await limiter.waitForSlot();
		return fn(...args);
	};
}

/**
 * Combine rate limiting with exponential backoff
 * This is the recommended wrapper for relay operations
 */
export function createResilientOperation<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	limiter: RateLimiter,
	backoffOptions: Partial<BackoffOptions> = {},
): (...args: T) => Promise<R> {
	return async (...args: T): Promise<R> => {
		await limiter.waitForSlot();
		return withBackoff(() => fn(...args), backoffOptions);
	};
}
