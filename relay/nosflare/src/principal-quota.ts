import { RateLimiter, type RateLimiterConfig } from './types';

export class PrincipalQuotaRegistry {
	private readonly publishLimiters = new Map<string, RateLimiter>();
	private readonly requestLimiters = new Map<string, RateLimiter>();
	private readonly subscriptions = new Map<string, Set<string>>();

	constructor(
		private readonly publishConfig: RateLimiterConfig,
		private readonly requestConfig: RateLimiterConfig,
		private readonly maxSubscriptions: number,
	) {}

	consumePublish(principal: string) {
		return this.getLimiter(this.publishLimiters, principal, this.publishConfig).removeToken();
	}

	consumeRequest(principal: string) {
		return this.getLimiter(this.requestLimiters, principal, this.requestConfig).removeToken();
	}

	reserveSubscription(principal: string, sessionId: string, subscriptionId: string) {
		const key = `${sessionId}\0${subscriptionId}`;
		const active = this.subscriptions.get(principal) ?? new Set<string>();
		if (active.has(key)) return true;
		if (active.size >= this.maxSubscriptions) return false;
		active.add(key);
		this.subscriptions.set(principal, active);
		return true;
	}

	releaseSubscription(principal: string, sessionId: string, subscriptionId: string) {
		const active = this.subscriptions.get(principal);
		if (!active) return;
		active.delete(`${sessionId}\0${subscriptionId}`);
		if (active.size === 0) this.subscriptions.delete(principal);
	}

	releaseSession(sessionId: string) {
		const prefix = `${sessionId}\0`;
		for (const [principal, active] of this.subscriptions) {
			for (const key of active) {
				if (key.startsWith(prefix)) active.delete(key);
			}
			if (active.size === 0) this.subscriptions.delete(principal);
		}
	}

	private getLimiter(
		limiters: Map<string, RateLimiter>,
		principal: string,
		config: RateLimiterConfig,
	) {
		let limiter = limiters.get(principal);
		if (!limiter) {
			limiter = new RateLimiter(config.rate, config.capacity);
			limiters.set(principal, limiter);
		}
		return limiter;
	}
}
