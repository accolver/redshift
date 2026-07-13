import { describe, expect, it } from 'bun:test';
import {
	AUTH_REQUIRED,
	PAY_TO_RELAY_ENABLED,
	allowedEventKinds,
	pruneProtectedKinds,
	relayInfo,
} from '../src/config';
import relayWorker, { handleRelayInfoRequest, serveLandingPage } from '../src/relay-worker';
import type { Env } from '../src/types';

describe('managed relay metadata truth', () => {
	it('advertises only implemented protocol and access behavior', () => {
		expect(relayInfo.name).toBe('Redshift Managed Relay Candidate');
		expect(relayInfo.supported_nips).toEqual([1, 11, 40, 42, 59]);
		expect(relayInfo.supported_nips).not.toContain(9);
		expect(relayInfo.supported_nips).not.toContain(78);
		expect(relayInfo.limitation?.auth_required).toBe(AUTH_REQUIRED);
		expect(PAY_TO_RELAY_ENABLED).toBe(false);
		expect(relayInfo.limitation?.payment_required).toBe(false);
		expect(relayInfo.description).toContain('Development candidate');
		expect([...allowedEventKinds]).toEqual([1059]);
		expect(pruneProtectedKinds.has(1059)).toBe(true);
	});

	it('omits payment metadata, endpoints, and controls while commercial access is disabled', async () => {
		const response = handleRelayInfoRequest(
			new Request('https://relay.redshiftapp.com/', {
				headers: { Accept: 'application/nostr+json' },
			}),
		);
		const metadata = (await response.json()) as Record<string, unknown>;
		expect(metadata).not.toHaveProperty('fees');
		expect(metadata).not.toHaveProperty('payments_url');

		const landingPage = await serveLandingPage().text();
		expect(landingPage).not.toContain('id="paySection"');
		expect(landingPage).not.toContain('/api/check-payment');
		expect(landingPage).not.toContain('payment-success');

		const disabledEndpoint = await relayWorker.fetch(
			new Request('https://relay.redshiftapp.com/api/check-payment?pubkey=test'),
			{} as Env,
			{} as ExecutionContext,
		);
		expect(disabledEndpoint.status).toBe(400);
	});
});
