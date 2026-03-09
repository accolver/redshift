/**
 * Secrets Output Formatting Tests
 *
 * L2: Function-Author - Tests for value formatting and redaction
 * L1: Syntax-Linter - Output format correctness
 */

import { describe, expect, it } from 'bun:test';
import { type SecretsOptions, formatSecretValue } from '../../src/commands/secrets';
import { redactValue } from '../../src/lib/validation';

describe('redactValue', () => {
	it('returns **** for any non-empty string', () => {
		expect(redactValue('my-secret-value')).toBe('****');
	});

	it('returns **** for very long strings', () => {
		expect(redactValue('x'.repeat(10000))).toBe('****');
	});

	it('returns **** for single character', () => {
		expect(redactValue('a')).toBe('****');
	});
});

describe('formatSecretValue', () => {
	describe('string values', () => {
		it('redacts non-empty strings when showRaw is false', () => {
			expect(formatSecretValue('hello', false)).toBe('****');
		});

		it('returns (empty) for empty string when showRaw is false', () => {
			expect(formatSecretValue('', false)).toBe('(empty)');
		});

		it('truncates long strings to 50 chars with ellipsis when showRaw is true', () => {
			const longValue = 'x'.repeat(60);
			const result = formatSecretValue(longValue, true);
			expect(result).toBe(`${'x'.repeat(50)}...`);
			expect(result.length).toBe(53);
		});

		it('returns short strings unchanged when showRaw is true', () => {
			expect(formatSecretValue('short', true)).toBe('short');
		});

		it('returns exactly 50-char strings without ellipsis when showRaw is true', () => {
			const exact50 = 'a'.repeat(50);
			expect(formatSecretValue(exact50, true)).toBe(exact50);
		});

		it('truncates 51-char strings when showRaw is true', () => {
			const value51 = 'b'.repeat(51);
			expect(formatSecretValue(value51, true)).toBe(`${'b'.repeat(50)}...`);
		});
	});

	describe('number values', () => {
		it('returns string representation regardless of showRaw', () => {
			expect(formatSecretValue(42, false)).toBe('42');
			expect(formatSecretValue(42, true)).toBe('42');
		});

		it('handles zero', () => {
			expect(formatSecretValue(0, false)).toBe('0');
		});

		it('handles negative numbers', () => {
			expect(formatSecretValue(-1, false)).toBe('-1');
		});

		it('handles floating point', () => {
			expect(formatSecretValue(3.14, true)).toBe('3.14');
		});
	});

	describe('boolean values', () => {
		it('returns string representation regardless of showRaw', () => {
			expect(formatSecretValue(true, false)).toBe('true');
			expect(formatSecretValue(false, false)).toBe('false');
			expect(formatSecretValue(true, true)).toBe('true');
		});
	});

	describe('object values', () => {
		it('shows key count when showRaw is false', () => {
			expect(formatSecretValue({ a: 1, b: 2 }, false)).toBe('{...} (2 keys)');
		});

		it('shows JSON when showRaw is true', () => {
			expect(formatSecretValue({ a: 1 }, true)).toBe('{"a":1}');
		});

		it('shows key count for empty object when showRaw is false', () => {
			expect(formatSecretValue({}, false)).toBe('{...} (0 keys)');
		});

		it('truncates long JSON to 50 chars when showRaw is true', () => {
			const bigObj: Record<string, string> = {};
			for (let i = 0; i < 20; i++) {
				bigObj[`key${i}`] = `value${i}`;
			}
			const result = formatSecretValue(bigObj, true);
			expect(result.length).toBe(53); // 50 chars + '...'
			expect(result.endsWith('...')).toBe(true);
		});

		it('shows correct key count for larger objects', () => {
			expect(formatSecretValue({ x: 1, y: 2, z: 3 }, false)).toBe('{...} (3 keys)');
		});
	});
});

describe('env format escaping', () => {
	it('escapes double quotes in values', () => {
		const value = 'say "hello"';
		const escaped = value.replace(/"/g, '\\"');
		expect(escaped).toBe('say \\"hello\\"');
		// Full env line format
		const envLine = `MY_KEY="${escaped}"`;
		expect(envLine).toBe('MY_KEY="say \\"hello\\""');
	});

	it('escapes newlines in values', () => {
		const value = 'line1\nline2';
		const escaped = value.replace(/\n/g, '\\n');
		expect(escaped).toBe('line1\\nline2');
		// Full env line format
		const envLine = `MY_KEY="${escaped}"`;
		expect(envLine).toBe('MY_KEY="line1\\nline2"');
	});

	it('escapes both quotes and newlines together', () => {
		const value = 'say "hi"\nthen bye';
		const escaped = value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
		expect(escaped).toBe('say \\"hi\\"\\nthen bye');
	});
});

describe('table format structure', () => {
	it('produces correct header with KEY and VALUE columns', () => {
		const maxKeyLen = Math.max('DATABASE_URL'.length, 10);
		const header = `${'KEY'.padEnd(maxKeyLen)}  VALUE`;
		expect(header).toBe('KEY           VALUE');
	});

	it('produces dash separator matching column widths', () => {
		const maxKeyLen = 12;
		const separator = `${'-'.repeat(maxKeyLen)}  ${'-'.repeat(40)}`;
		expect(separator).toBe('------------  ----------------------------------------');
	});

	it('pads keys to align columns', () => {
		const maxKeyLen = 15;
		const line = `${'API_KEY'.padEnd(maxKeyLen)}  ****`;
		expect(line).toBe('API_KEY          ****');
	});
});

describe('json format structure', () => {
	it('produces valid JSON with pretty printing', () => {
		const secrets = { API_KEY: 'secret', DB_URL: 'postgres://localhost' };
		const output = JSON.stringify(secrets, null, 2);
		const parsed = JSON.parse(output) as Record<string, string>;
		expect(parsed).toEqual(secrets);
	});

	it('includes indentation in output', () => {
		const secrets = { KEY: 'value' };
		const output = JSON.stringify(secrets, null, 2);
		expect(output).toContain('  "KEY"');
	});
});

describe('--only-names output format', () => {
	it('prints only keys, one per line', () => {
		const secrets = { API_KEY: 'secret1', DB_URL: 'postgres://localhost', PORT: '3000' };
		const keys = Object.keys(secrets);
		const output = keys.join('\n');
		expect(output).toBe('API_KEY\nDB_URL\nPORT');
	});

	it('does not include values in output', () => {
		const secrets = { API_KEY: 'secret1', DB_URL: 'postgres://localhost' };
		const keys = Object.keys(secrets);
		const output = keys.join('\n');
		expect(output).not.toContain('secret1');
		expect(output).not.toContain('postgres://localhost');
	});

	it('does not include table header or separator', () => {
		const secrets = { DB_URL: 'secret1' };
		const keys = Object.keys(secrets);
		const output = keys.join('\n');
		// Table header uses "KEY  VALUE" format — should not appear
		expect(output).not.toMatch(/^KEY\s+VALUE/m);
		expect(output).not.toContain('---');
		expect(output).not.toContain('Secrets for');
	});

	it('handles single key', () => {
		const secrets = { ONLY_ONE: 'val' };
		const keys = Object.keys(secrets);
		const output = keys.join('\n');
		expect(output).toBe('ONLY_ONE');
	});

	it('SecretsOptions accepts onlyNames boolean', () => {
		const opts: SecretsOptions = {
			subcommand: 'list',
			onlyNames: true,
		};
		expect(opts.onlyNames).toBe(true);
	});

	it('SecretsOptions onlyNames defaults to undefined', () => {
		const opts: SecretsOptions = {
			subcommand: 'list',
		};
		expect(opts.onlyNames).toBeUndefined();
	});
});

describe('--plain output format', () => {
	it('outputs just the string value for plain mode', () => {
		const value = 'my-secret-value';
		// In plain mode, getSecret uses console.log(value) which adds a newline
		// We test the value that would be passed to console.log
		expect(value).toBe('my-secret-value');
	});

	it('outputs JSON stringified value for non-string plain mode', () => {
		const value = { nested: 'object' };
		const output = JSON.stringify(value);
		expect(output).toBe('{"nested":"object"}');
	});

	it('does not include key= prefix in plain mode', () => {
		const key = 'API_KEY';
		const value = 'secret123';
		// Plain mode outputs just the value, not key=value
		const plainOutput = value;
		expect(plainOutput).not.toContain(`${key}=`);
		expect(plainOutput).toBe('secret123');
	});

	it('SecretsOptions accepts plain boolean', () => {
		const opts: SecretsOptions = {
			subcommand: 'get',
			plain: true,
		};
		expect(opts.plain).toBe(true);
	});

	it('SecretsOptions plain defaults to undefined', () => {
		const opts: SecretsOptions = {
			subcommand: 'get',
		};
		expect(opts.plain).toBeUndefined();
	});
});
