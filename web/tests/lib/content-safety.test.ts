import { sanitizeBlogHtml, serializeScriptJson } from '$lib/content-safety';
import { describe, expect, it } from 'vitest';

describe('external content safety boundary', () => {
	it('removes executable markup, handlers, and unsafe URL schemes', () => {
		const sanitized = sanitizeBlogHtml(
			'<h2>Safe</h2><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">bad</a>',
		);
		expect(sanitized).toContain('<h2>Safe</h2>');
		expect(sanitized).not.toContain('<script');
		expect(sanitized).not.toContain('<img');
		expect(sanitized).not.toContain('onerror');
		expect(sanitized).not.toContain('javascript:');
	});

	it('adds opener isolation to new-window links', () => {
		const sanitized = sanitizeBlogHtml('<a href="https://example.com" target="_blank">example</a>');
		expect(sanitized).toContain('rel="noopener noreferrer"');
	});

	it('prevents JSON-LD script end-tag breakout', () => {
		const serialized = serializeScriptJson({ title: '</script><script>alert(1)</script>&' });
		expect(serialized).not.toContain('</script>');
		expect(serialized).toContain('\\u003c/script\\u003e');
		expect(JSON.parse(serialized)).toEqual({ title: '</script><script>alert(1)</script>&' });
	});
});
