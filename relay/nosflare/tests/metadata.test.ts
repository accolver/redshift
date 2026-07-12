import { describe, expect, it } from 'bun:test';
import {
	AUTH_REQUIRED,
	PAY_TO_RELAY_ENABLED,
	allowedEventKinds,
	pruneProtectedKinds,
	relayInfo,
} from '../src/config';

describe('managed relay metadata truth', () => {
	it('advertises only implemented protocol and access behavior', () => {
		expect(relayInfo.name).toBe('Redshift Managed Relay');
		expect(relayInfo.supported_nips).toEqual([1, 11, 40, 42, 59]);
		expect(relayInfo.supported_nips).not.toContain(9);
		expect(relayInfo.supported_nips).not.toContain(78);
		expect(relayInfo.limitation?.auth_required).toBe(AUTH_REQUIRED);
		expect(relayInfo.limitation?.payment_required).toBe(PAY_TO_RELAY_ENABLED);
		expect([...allowedEventKinds]).toEqual([1059]);
		expect(pruneProtectedKinds.has(1059)).toBe(true);
	});
});
