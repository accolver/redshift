import { describe, expect, it } from 'bun:test';
import { MAX_PRINCIPAL_SUBSCRIPTIONS, PUBKEY_RATE_LIMIT } from '../src/config';
import { PrincipalQuota } from '../src/quota-object';

interface TestStorageTransaction {
	get<T>(key: string): Promise<T | undefined>;
	put(key: string, value: unknown): Promise<void>;
}

function createQuota() {
	const values = new Map<string, unknown>();
	const transaction: TestStorageTransaction = {
		async get<T>(key: string) {
			return values.get(key) as T | undefined;
		},
		async put(key: string, value: unknown) {
			values.set(key, structuredClone(value));
		},
	};
	const storage = {
		async transaction<T>(callback: (transaction: TestStorageTransaction) => Promise<T>) {
			return callback(transaction);
		},
	};
	return new PrincipalQuota({ storage } as unknown as DurableObjectState);
}

async function apply(quota: PrincipalQuota, body: Record<string, string>) {
	const response = await quota.fetch(
		new Request('https://quota.internal/', {
			method: 'POST',
			body: JSON.stringify(body),
		}),
	);
	return response.json() as Promise<{ allowed: boolean }>;
}

describe('durable cross-region principal quota', () => {
	it('persists one publish bucket per principal', async () => {
		const quota = createQuota();
		for (let index = 0; index < PUBKEY_RATE_LIMIT.capacity; index++) {
			expect((await apply(quota, { action: 'consume-publish', principal: 'owner' })).allowed).toBe(
				true,
			);
		}
		expect((await apply(quota, { action: 'consume-publish', principal: 'owner' })).allowed).toBe(
			false,
		);
		expect(
			(await apply(quota, { action: 'consume-publish', principal: 'different' })).allowed,
		).toBe(true);
	});

	it('caps subscriptions shared by all regional sessions and releases a session', async () => {
		const quota = createQuota();
		for (let index = 0; index < MAX_PRINCIPAL_SUBSCRIPTIONS; index++) {
			expect(
				(
					await apply(quota, {
						action: 'reserve-subscription',
						principal: 'owner',
						sessionId: `session-${index}`,
						subscriptionId: 'sub',
					})
				).allowed,
			).toBe(true);
		}
		expect(
			(
				await apply(quota, {
					action: 'reserve-subscription',
					principal: 'owner',
					sessionId: 'overflow',
					subscriptionId: 'sub',
				})
			).allowed,
		).toBe(false);
		await apply(quota, {
			action: 'release-session',
			principal: 'owner',
			sessionId: 'session-0',
		});
		expect(
			(
				await apply(quota, {
					action: 'reserve-subscription',
					principal: 'owner',
					sessionId: 'overflow',
					subscriptionId: 'sub',
				})
			).allowed,
		).toBe(true);
	});
});
