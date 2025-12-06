/**
 * Tests for secrets upload command
 *
 * L2: Function-Author - TDD for .env parsing
 */

import { describe, expect, test } from 'bun:test';

// Import the parsing functions by re-implementing them here for testing
// (The actual functions are private in secrets.ts)

/**
 * Parse a .env file content into a secrets object.
 */
function parseEnvFile(content: string): Record<string, string | number | boolean> {
	const secrets: Record<string, string | number | boolean> = {};
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const eqIndex = trimmed.indexOf('=');
		if (eqIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, eqIndex).trim();
		let value = trimmed.slice(eqIndex + 1);

		if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
			continue;
		}

		value = parseEnvValue(value);

		try {
			const parsed = JSON.parse(value);
			if (typeof parsed === 'number' || typeof parsed === 'boolean') {
				secrets[key] = parsed;
				continue;
			}
		} catch {
			// Not JSON, keep as string
		}

		secrets[key] = value;
	}

	return secrets;
}

/**
 * Parse a .env value, handling quotes and escapes.
 */
function parseEnvValue(value: string): string {
	value = value.trim();

	if (value.startsWith('"') && value.endsWith('"')) {
		value = value.slice(1, -1);
		value = value
			.replace(/\\n/g, '\n')
			.replace(/\\r/g, '\r')
			.replace(/\\t/g, '\t')
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, '\\');
		return value;
	}

	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1);
	}

	const commentIndex = value.indexOf(' #');
	if (commentIndex !== -1) {
		value = value.slice(0, commentIndex).trim();
	}

	return value;
}

describe('parseEnvFile', () => {
	test('parses simple key=value pairs', () => {
		const content = `
API_KEY=sk_live_xxx
DEBUG=true
PORT=3000
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			API_KEY: 'sk_live_xxx',
			DEBUG: true,
			PORT: 3000,
		});
	});

	test('handles double-quoted values', () => {
		const content = `
DATABASE_URL="postgres://localhost:5432/db"
MESSAGE="Hello World"
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			DATABASE_URL: 'postgres://localhost:5432/db',
			MESSAGE: 'Hello World',
		});
	});

	test('handles single-quoted values', () => {
		const content = `
API_KEY='sk_live_xxx'
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			API_KEY: 'sk_live_xxx',
		});
	});

	test('handles escape sequences in double quotes', () => {
		const content = `
MULTILINE="line1\\nline2"
TAB="col1\\tcol2"
ESCAPED="has \\"quotes\\""
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			MULTILINE: 'line1\nline2',
			TAB: 'col1\tcol2',
			ESCAPED: 'has "quotes"',
		});
	});

	test('ignores comments', () => {
		const content = `
# This is a comment
API_KEY=value
# Another comment
DEBUG=true
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			API_KEY: 'value',
			DEBUG: true,
		});
	});

	test('handles inline comments (unquoted values only)', () => {
		const content = `
API_KEY=value # this is a comment
QUOTED="value # not a comment"
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			API_KEY: 'value',
			QUOTED: 'value # not a comment',
		});
	});

	test('ignores empty lines', () => {
		const content = `

API_KEY=value

DEBUG=true

`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			API_KEY: 'value',
			DEBUG: true,
		});
	});

	test('handles empty values', () => {
		const content = `
EMPTY=
EMPTY_QUOTED=""
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			EMPTY: '',
			EMPTY_QUOTED: '',
		});
	});

	test('ignores invalid key names', () => {
		const content = `
VALID_KEY=value
123_INVALID=value
-INVALID=value
ALSO-INVALID=value
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			VALID_KEY: 'value',
		});
	});

	test('handles values with equals signs', () => {
		const content = `
URL="https://example.com?foo=bar&baz=qux"
EQUATION=1+1=2
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			URL: 'https://example.com?foo=bar&baz=qux',
			EQUATION: '1+1=2',
		});
	});

	test('handles complex real-world example', () => {
		const content = `
# Database configuration
DATABASE_URL="postgres://user:pass@localhost:5432/mydb"
REDIS_URL=redis://localhost:6379

# Feature flags
DEBUG=true
VERBOSE=false

# API Keys
STRIPE_KEY=sk_live_xxx
OPENAI_API_KEY="sk-proj-xxx"

# Numeric values
PORT=3000
MAX_CONNECTIONS=100
TIMEOUT=30.5

# Empty and special
EMPTY=
SPECIAL_CHARS="!@#$%^&*()"
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
			REDIS_URL: 'redis://localhost:6379',
			DEBUG: true,
			VERBOSE: false,
			STRIPE_KEY: 'sk_live_xxx',
			OPENAI_API_KEY: 'sk-proj-xxx',
			PORT: 3000,
			MAX_CONNECTIONS: 100,
			TIMEOUT: 30.5,
			EMPTY: '',
			SPECIAL_CHARS: '!@#$%^&*()',
		});
	});

	test('handles unicode values', () => {
		const content = `
EMOJI="Hello World"
JAPANESE="日本語"
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			EMOJI: 'Hello World',
			JAPANESE: '日本語',
		});
	});

	test('preserves underscores in keys', () => {
		const content = `
_PRIVATE=value
__DUNDER__=value
SNAKE_CASE_KEY=value
`;
		const result = parseEnvFile(content);
		expect(result).toEqual({
			_PRIVATE: 'value',
			__DUNDER__: 'value',
			SNAKE_CASE_KEY: 'value',
		});
	});
});
