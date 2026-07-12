import { MAX_PRINCIPAL_SUBSCRIPTIONS, PUBKEY_RATE_LIMIT, REQ_RATE_LIMIT } from './config';

interface RateState {
	tokens: number;
	updatedAt: number;
}

interface LeaseState {
	entries: Record<string, number>;
}

type QuotaAction =
	| 'consume-publish'
	| 'consume-request'
	| 'reserve-subscription'
	| 'release-subscription'
	| 'release-session'
	| 'reserve-preauth'
	| 'release-preauth';

interface QuotaRequest {
	action: QuotaAction;
	principal?: string;
	sessionId?: string;
	subscriptionId?: string;
}

const SUBSCRIPTION_LEASE_MS = 60 * 60 * 1000;
const PREAUTH_LEASE_MS = 10 * 60 * 1000;
const MAX_PREAUTH_CONNECTIONS = 500;

function isQuotaRequest(value: unknown): value is QuotaRequest {
	if (!value || typeof value !== 'object') return false;
	const request = value as Partial<QuotaRequest>;
	return typeof request.action === 'string';
}

export class PrincipalQuota implements DurableObject {
	constructor(private readonly state: DurableObjectState) {}

	async fetch(request: Request) {
		if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
		const body: unknown = await request.json();
		if (!isQuotaRequest(body)) return Response.json({ allowed: false }, { status: 400 });
		const allowed = await this.apply(body);
		return Response.json({ allowed });
	}

	private async apply(request: QuotaRequest) {
		switch (request.action) {
			case 'consume-publish':
				return request.principal
					? this.consume('publish', request.principal, PUBKEY_RATE_LIMIT)
					: false;
			case 'consume-request':
				return request.principal
					? this.consume('request', request.principal, REQ_RATE_LIMIT)
					: false;
			case 'reserve-subscription':
				return request.principal && request.sessionId && request.subscriptionId
					? this.reserveSubscription(request.principal, request.sessionId, request.subscriptionId)
					: false;
			case 'release-subscription':
				return request.principal && request.sessionId && request.subscriptionId
					? this.releaseSubscription(request.principal, request.sessionId, request.subscriptionId)
					: false;
			case 'release-session':
				return request.principal && request.sessionId
					? this.releaseSession(request.principal, request.sessionId)
					: false;
			case 'reserve-preauth':
				return request.sessionId ? this.reservePreAuth(request.sessionId) : false;
			case 'release-preauth':
				return request.sessionId ? this.releasePreAuth(request.sessionId) : false;
		}
	}

	private async consume(
		type: 'publish' | 'request',
		principal: string,
		config: { rate: number; capacity: number },
	) {
		return this.state.storage.transaction(async (transaction) => {
			const key = `rate:${type}:${principal}`;
			const now = Date.now();
			const previous = await transaction.get<RateState>(key);
			const elapsed = previous ? Math.max(0, now - previous.updatedAt) : 0;
			const available = previous
				? Math.min(config.capacity, previous.tokens + elapsed * config.rate)
				: config.capacity;
			const allowed = available >= 1;
			await transaction.put(key, {
				tokens: allowed ? available - 1 : available,
				updatedAt: now,
			} satisfies RateState);
			return allowed;
		});
	}

	private async reserveSubscription(principal: string, sessionId: string, subscriptionId: string) {
		return this.state.storage.transaction(async (transaction) => {
			const key = `subscriptions:${principal}`;
			const state = (await transaction.get<LeaseState>(key)) ?? { entries: {} };
			const now = Date.now();
			for (const [entry, expiresAt] of Object.entries(state.entries)) {
				if (expiresAt <= now) delete state.entries[entry];
			}
			const entry = `${sessionId}\0${subscriptionId}`;
			if (
				!Object.prototype.hasOwnProperty.call(state.entries, entry) &&
				Object.keys(state.entries).length >= MAX_PRINCIPAL_SUBSCRIPTIONS
			) {
				return false;
			}
			state.entries[entry] = now + SUBSCRIPTION_LEASE_MS;
			await transaction.put(key, state);
			return true;
		});
	}

	private async releaseSubscription(principal: string, sessionId: string, subscriptionId: string) {
		return this.state.storage.transaction(async (transaction) => {
			const key = `subscriptions:${principal}`;
			const state = await transaction.get<LeaseState>(key);
			if (!state) return true;
			delete state.entries[`${sessionId}\0${subscriptionId}`];
			await transaction.put(key, state);
			return true;
		});
	}

	private async releaseSession(principal: string, sessionId: string) {
		return this.state.storage.transaction(async (transaction) => {
			const key = `subscriptions:${principal}`;
			const state = await transaction.get<LeaseState>(key);
			if (!state) return true;
			const prefix = `${sessionId}\0`;
			for (const entry of Object.keys(state.entries)) {
				if (entry.startsWith(prefix)) delete state.entries[entry];
			}
			await transaction.put(key, state);
			return true;
		});
	}

	private async reservePreAuth(sessionId: string) {
		return this.state.storage.transaction(async (transaction) => {
			const key = 'preauth';
			const state = (await transaction.get<LeaseState>(key)) ?? { entries: {} };
			const now = Date.now();
			for (const [entry, expiresAt] of Object.entries(state.entries)) {
				if (expiresAt <= now) delete state.entries[entry];
			}
			if (
				!Object.prototype.hasOwnProperty.call(state.entries, sessionId) &&
				Object.keys(state.entries).length >= MAX_PREAUTH_CONNECTIONS
			) {
				return false;
			}
			state.entries[sessionId] = now + PREAUTH_LEASE_MS;
			await transaction.put(key, state);
			return true;
		});
	}

	private async releasePreAuth(sessionId: string) {
		return this.state.storage.transaction(async (transaction) => {
			const state = await transaction.get<LeaseState>('preauth');
			if (!state) return true;
			delete state.entries[sessionId];
			await transaction.put('preauth', state);
			return true;
		});
	}
}
