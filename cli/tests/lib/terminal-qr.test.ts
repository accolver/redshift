import { describe, expect, it } from 'bun:test';
import { renderTerminalQr } from '../../src/lib/terminal-qr';

describe('terminal QR rendering', () => {
	it('renders a scannable terminal QR block for nostrconnect URIs', () => {
		const qr = renderTerminalQr(
			'nostrconnect://'.concat('a'.repeat(64), '?relay=wss%3A%2F%2Frelay.test&secret=test-secret'),
		);

		expect(qr).toContain('█');
		expect(qr.split('\n').filter((line) => line.trim().length > 0).length).toBeGreaterThan(8);
	});
});
