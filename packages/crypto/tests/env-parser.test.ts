/**
 * Tests for shared .env parser
 *
 * L2: Function-Author - TDD for unified .env parsing
 */

import { describe, it, expect } from 'bun:test';
import { parseEnvFile, parseEnvValue, formatEnvLine } from '../src/env-parser';

describe('parseEnvFile', () => {
	it('parses simple key=value pairs', () => {
		const result = parseEnvFile('FOO=bar\nBAZ=qux');
		expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
	});

	it('handles export prefix', () => {
		const result = parseEnvFile('export API_KEY=secret');
		expect(result).toEqual({ API_KEY: 'secret' });
	});

	it('handles double-quoted values with escapes', () => {
		const result = parseEnvFile('MSG="hello\\nworld"');
		expect(result).toEqual({ MSG: 'hello\nworld' });
	});

	it('handles single-quoted values (no escaping)', () => {
		const result = parseEnvFile("MSG='hello\\nworld'");
		expect(result).toEqual({ MSG: 'hello\\nworld' });
	});

	it('skips comments and blank lines', () => {
		const result = parseEnvFile('# comment\n\nFOO=bar');
		expect(result).toEqual({ FOO: 'bar' });
	});

	it('handles inline comments', () => {
		const result = parseEnvFile('FOO=bar # a comment');
		expect(result).toEqual({ FOO: 'bar' });
	});

	it('handles empty values', () => {
		const result = parseEnvFile('EMPTY=\nEMPTY_QUOTED=""');
		expect(result).toEqual({ EMPTY: '', EMPTY_QUOTED: '' });
	});

	it('ignores invalid key names', () => {
		const result = parseEnvFile('VALID=ok\n123_BAD=no\n-BAD=no\nALSO-BAD=no');
		expect(result).toEqual({ VALID: 'ok' });
	});

	it('handles values with equals signs', () => {
		const result = parseEnvFile('URL="https://example.com?foo=bar"\nEQ=1+1=2');
		expect(result).toEqual({
			URL: 'https://example.com?foo=bar',
			EQ: '1+1=2',
		});
	});

	it('handles escape sequences in double quotes', () => {
		const content = 'TAB="col1\\tcol2"\nESCAPED="has \\"quotes\\""';
		const result = parseEnvFile(content);
		expect(result).toEqual({
			TAB: 'col1\tcol2',
			ESCAPED: 'has "quotes"',
		});
	});

	it('preserves underscores in keys', () => {
		const result = parseEnvFile('_PRIVATE=val\n__DUNDER__=val\nSNAKE_CASE=val');
		expect(result).toEqual({
			_PRIVATE: 'val',
			__DUNDER__: 'val',
			SNAKE_CASE: 'val',
		});
	});

	it('handles export prefix with quoted values', () => {
		const result = parseEnvFile('export DB_URL="postgres://localhost/db"');
		expect(result).toEqual({ DB_URL: 'postgres://localhost/db' });
	});
});

describe('parseEnvValue', () => {
	it('trims unquoted values', () => {
		expect(parseEnvValue('  hello  ')).toBe('hello');
	});

	it('strips double quotes and processes escapes', () => {
		expect(parseEnvValue('"line1\\nline2"')).toBe('line1\nline2');
	});

	it('strips single quotes without processing escapes', () => {
		expect(parseEnvValue("'line1\\nline2'")).toBe('line1\\nline2');
	});

	it('strips inline comments from unquoted values', () => {
		expect(parseEnvValue('value # comment')).toBe('value');
	});
});

describe('formatEnvLine', () => {
	it('formats simple value', () => {
		expect(formatEnvLine('KEY', 'value')).toBe('KEY="value"');
	});

	it('escapes double quotes', () => {
		expect(formatEnvLine('KEY', 'say "hi"')).toBe('KEY="say \\"hi\\""');
	});

	it('escapes newlines', () => {
		expect(formatEnvLine('KEY', 'line1\nline2')).toBe('KEY="line1\\nline2"');
	});

	it('escapes backslashes', () => {
		expect(formatEnvLine('KEY', 'path\\to\\file')).toBe('KEY="path\\\\to\\\\file"');
	});
});
