/**
 * Secrets Download Format Tests
 *
 * L2: Function-Author - TDD for download format functions
 * L1: Syntax-Linter - Output format correctness
 */

import { describe, expect, it } from 'bun:test';
import {
	type SecretsOptions,
	formatSecretsAsDocker,
	formatSecretsAsEnv,
	formatSecretsAsEnvNoQuotes,
	formatSecretsAsJson,
	formatSecretsAsYaml,
	getDownloadExtension,
} from '../../src/commands/secrets';

// ---------------------------------------------------------------------------
// SecretsOptions type tests
// ---------------------------------------------------------------------------

describe('SecretsOptions download fields', () => {
	it('accepts downloadFormat', () => {
		const opts: SecretsOptions = {
			subcommand: 'download',
			downloadFormat: 'json',
		};
		expect(opts.downloadFormat).toBe('json');
	});

	it('accepts noFile boolean', () => {
		const opts: SecretsOptions = {
			subcommand: 'download',
			noFile: true,
		};
		expect(opts.noFile).toBe(true);
	});

	it('accepts filepath string', () => {
		const opts: SecretsOptions = {
			subcommand: 'download',
			filepath: 'my-secrets.env',
		};
		expect(opts.filepath).toBe('my-secrets.env');
	});

	it('all download fields default to undefined', () => {
		const opts: SecretsOptions = {
			subcommand: 'download',
		};
		expect(opts.downloadFormat).toBeUndefined();
		expect(opts.noFile).toBeUndefined();
		expect(opts.filepath).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getDownloadExtension
// ---------------------------------------------------------------------------

describe('getDownloadExtension', () => {
	it('returns "json" for json format', () => {
		expect(getDownloadExtension('json')).toBe('json');
	});

	it('returns "env" for env format', () => {
		expect(getDownloadExtension('env')).toBe('env');
	});

	it('returns "yaml" for yaml format', () => {
		expect(getDownloadExtension('yaml')).toBe('yaml');
	});

	it('returns "txt" for docker format', () => {
		expect(getDownloadExtension('docker')).toBe('txt');
	});

	it('returns "env" for env-no-quotes format', () => {
		expect(getDownloadExtension('env-no-quotes')).toBe('env');
	});
});

// ---------------------------------------------------------------------------
// formatSecretsAsJson
// ---------------------------------------------------------------------------

describe('formatSecretsAsJson', () => {
	it('produces pretty-printed JSON', () => {
		const secrets = { API_KEY: 'secret', DB_URL: 'postgres://localhost' };
		const result = formatSecretsAsJson(secrets);
		expect(result).toBe(JSON.stringify(secrets, null, 2));
	});

	it('handles empty object', () => {
		expect(formatSecretsAsJson({})).toBe('{}');
	});

	it('handles non-string values', () => {
		const secrets: Record<string, unknown> = { PORT: 3000, DEBUG: true, META: { nested: 'obj' } };
		const result = formatSecretsAsJson(secrets);
		const parsed = JSON.parse(result) as Record<string, unknown>;
		expect(parsed.PORT).toBe(3000);
		expect(parsed.DEBUG).toBe(true);
		expect(parsed.META).toEqual({ nested: 'obj' });
	});

	it('handles values with special characters', () => {
		const secrets = { KEY: 'value with "quotes" and \nnewlines' };
		const result = formatSecretsAsJson(secrets);
		const parsed = JSON.parse(result) as Record<string, unknown>;
		expect(parsed.KEY).toBe('value with "quotes" and \nnewlines');
	});
});

// ---------------------------------------------------------------------------
// formatSecretsAsEnv
// ---------------------------------------------------------------------------

describe('formatSecretsAsEnv', () => {
	it('produces KEY="value" lines', () => {
		const secrets = { API_KEY: 'secret123' };
		expect(formatSecretsAsEnv(secrets)).toBe('API_KEY="secret123"');
	});

	it('escapes double quotes in values', () => {
		const secrets = { MSG: 'say "hello"' };
		expect(formatSecretsAsEnv(secrets)).toBe('MSG="say \\"hello\\""');
	});

	it('escapes newlines in values', () => {
		const secrets = { MULTI: 'line1\nline2' };
		expect(formatSecretsAsEnv(secrets)).toBe('MULTI="line1\\nline2"');
	});

	it('escapes both quotes and newlines', () => {
		const secrets = { BOTH: 'say "hi"\nthen bye' };
		expect(formatSecretsAsEnv(secrets)).toBe('BOTH="say \\"hi\\"\\nthen bye"');
	});

	it('handles empty value', () => {
		const secrets = { EMPTY: '' };
		expect(formatSecretsAsEnv(secrets)).toBe('EMPTY=""');
	});

	it('handles multiple keys', () => {
		const secrets = { A: '1', B: '2', C: '3' };
		const lines = formatSecretsAsEnv(secrets).split('\n');
		expect(lines).toEqual(['A="1"', 'B="2"', 'C="3"']);
	});

	it('stringifies non-string values', () => {
		const secrets: Record<string, unknown> = { PORT: 3000, DEBUG: true };
		const result = formatSecretsAsEnv(secrets);
		expect(result).toContain('PORT="3000"');
		expect(result).toContain('DEBUG="true"');
	});

	it('handles backslashes in values', () => {
		const secrets = { PATH: 'C:\\Users\\test' };
		const result = formatSecretsAsEnv(secrets);
		expect(result).toBe('PATH="C:\\\\Users\\\\test"');
	});
});

// ---------------------------------------------------------------------------
// formatSecretsAsYaml
// ---------------------------------------------------------------------------

describe('formatSecretsAsYaml', () => {
	it('produces KEY: value lines for simple values', () => {
		const secrets = { API_KEY: 'secret123' };
		expect(formatSecretsAsYaml(secrets)).toBe('API_KEY: secret123');
	});

	it('quotes values containing colons', () => {
		const secrets = { URL: 'postgres://host:5432' };
		expect(formatSecretsAsYaml(secrets)).toBe('URL: "postgres://host:5432"');
	});

	it('quotes values containing hash (#)', () => {
		const secrets = { COLOR: '#ff0000' };
		expect(formatSecretsAsYaml(secrets)).toBe('COLOR: "#ff0000"');
	});

	it('quotes values containing curly braces', () => {
		const secrets = { JSON_VAL: '{key: val}' };
		expect(formatSecretsAsYaml(secrets)).toBe('JSON_VAL: "{key: val}"');
	});

	it('quotes values containing square brackets', () => {
		const secrets = { ARR: '[1, 2, 3]' };
		expect(formatSecretsAsYaml(secrets)).toBe('ARR: "[1, 2, 3]"');
	});

	it('quotes values containing commas', () => {
		const secrets = { LIST: 'a, b, c' };
		expect(formatSecretsAsYaml(secrets)).toBe('LIST: "a, b, c"');
	});

	it('quotes values containing ampersand', () => {
		const secrets = { REF: '&anchor' };
		expect(formatSecretsAsYaml(secrets)).toBe('REF: "&anchor"');
	});

	it('quotes values containing asterisk', () => {
		const secrets = { ALIAS: '*ref' };
		expect(formatSecretsAsYaml(secrets)).toBe('ALIAS: "*ref"');
	});

	it('quotes values containing question mark', () => {
		const secrets = { Q: '?query' };
		expect(formatSecretsAsYaml(secrets)).toBe('Q: "?query"');
	});

	it('quotes values containing pipe', () => {
		const secrets = { PIPE: '|literal' };
		expect(formatSecretsAsYaml(secrets)).toBe('PIPE: "|literal"');
	});

	it('quotes values containing dash at start', () => {
		const secrets = { DASH: '-item' };
		expect(formatSecretsAsYaml(secrets)).toBe('DASH: "-item"');
	});

	it('quotes values containing angle brackets', () => {
		const secrets = { TAG: '<html>' };
		expect(formatSecretsAsYaml(secrets)).toBe('TAG: "<html>"');
	});

	it('quotes values containing equals sign', () => {
		const secrets = { EQ: 'a=b' };
		expect(formatSecretsAsYaml(secrets)).toBe('EQ: "a=b"');
	});

	it('quotes values containing exclamation mark', () => {
		const secrets = { BANG: '!important' };
		expect(formatSecretsAsYaml(secrets)).toBe('BANG: "!important"');
	});

	it('quotes values containing percent', () => {
		const secrets = { PCT: '100%' };
		expect(formatSecretsAsYaml(secrets)).toBe('PCT: "100%"');
	});

	it('quotes values containing at sign', () => {
		const secrets = { EMAIL: 'user@host' };
		expect(formatSecretsAsYaml(secrets)).toBe('EMAIL: "user@host"');
	});

	it('quotes values containing newlines', () => {
		const secrets = { MULTI: 'line1\nline2' };
		const result = formatSecretsAsYaml(secrets);
		expect(result).toBe('MULTI: "line1\\nline2"');
	});

	it('quotes values with leading spaces', () => {
		const secrets = { PADDED: '  leading' };
		expect(formatSecretsAsYaml(secrets)).toBe('PADDED: "  leading"');
	});

	it('quotes values with trailing spaces', () => {
		const secrets = { PADDED: 'trailing  ' };
		expect(formatSecretsAsYaml(secrets)).toBe('PADDED: "trailing  "');
	});

	it('does not quote simple alphanumeric values', () => {
		const secrets = { SIMPLE: 'hello123' };
		expect(formatSecretsAsYaml(secrets)).toBe('SIMPLE: hello123');
	});

	it('handles empty value', () => {
		const secrets = { EMPTY: '' };
		expect(formatSecretsAsYaml(secrets)).toBe('EMPTY: ""');
	});

	it('handles multiple keys', () => {
		const secrets = { A: 'simple', B: 'has:colon' };
		const lines = formatSecretsAsYaml(secrets).split('\n');
		expect(lines).toEqual(['A: simple', 'B: "has:colon"']);
	});

	it('stringifies non-string values', () => {
		const secrets: Record<string, unknown> = { PORT: 3000, DEBUG: true };
		const result = formatSecretsAsYaml(secrets);
		expect(result).toContain('PORT: 3000');
		expect(result).toContain('DEBUG: true');
	});

	it('escapes double quotes inside YAML quoted values', () => {
		const secrets = { MSG: 'say "hello"' };
		expect(formatSecretsAsYaml(secrets)).toBe('MSG: "say \\"hello\\""');
	});
});

// ---------------------------------------------------------------------------
// formatSecretsAsDocker
// ---------------------------------------------------------------------------

describe('formatSecretsAsDocker', () => {
	it('produces --env KEY=value lines', () => {
		const secrets = { API_KEY: 'secret123' };
		expect(formatSecretsAsDocker(secrets)).toBe('--env API_KEY=secret123');
	});

	it('handles values with spaces', () => {
		const secrets = { MSG: 'hello world' };
		expect(formatSecretsAsDocker(secrets)).toBe('--env MSG=hello world');
	});

	it('handles empty value', () => {
		const secrets = { EMPTY: '' };
		expect(formatSecretsAsDocker(secrets)).toBe('--env EMPTY=');
	});

	it('handles multiple keys', () => {
		const secrets = { A: '1', B: '2' };
		const lines = formatSecretsAsDocker(secrets).split('\n');
		expect(lines).toEqual(['--env A=1', '--env B=2']);
	});

	it('stringifies non-string values', () => {
		const secrets: Record<string, unknown> = { PORT: 3000 };
		expect(formatSecretsAsDocker(secrets)).toBe('--env PORT=3000');
	});

	it('handles values with special characters', () => {
		const secrets = { URL: 'postgres://user:pass@host:5432/db' };
		expect(formatSecretsAsDocker(secrets)).toBe('--env URL=postgres://user:pass@host:5432/db');
	});
});

// ---------------------------------------------------------------------------
// formatSecretsAsEnvNoQuotes
// ---------------------------------------------------------------------------

describe('formatSecretsAsEnvNoQuotes', () => {
	it('produces KEY=value lines without quotes', () => {
		const secrets = { API_KEY: 'secret123' };
		expect(formatSecretsAsEnvNoQuotes(secrets)).toBe('API_KEY=secret123');
	});

	it('does not quote values with spaces', () => {
		const secrets = { MSG: 'hello world' };
		expect(formatSecretsAsEnvNoQuotes(secrets)).toBe('MSG=hello world');
	});

	it('does not escape special characters', () => {
		const secrets = { MSG: 'say "hello"\nnewline' };
		expect(formatSecretsAsEnvNoQuotes(secrets)).toBe('MSG=say "hello"\nnewline');
	});

	it('handles empty value', () => {
		const secrets = { EMPTY: '' };
		expect(formatSecretsAsEnvNoQuotes(secrets)).toBe('EMPTY=');
	});

	it('handles multiple keys', () => {
		const secrets = { A: '1', B: '2' };
		const lines = formatSecretsAsEnvNoQuotes(secrets).split('\n');
		expect(lines).toEqual(['A=1', 'B=2']);
	});

	it('stringifies non-string values', () => {
		const secrets: Record<string, unknown> = { PORT: 3000, DEBUG: true };
		const result = formatSecretsAsEnvNoQuotes(secrets);
		expect(result).toContain('PORT=3000');
		expect(result).toContain('DEBUG=true');
	});
});

// ---------------------------------------------------------------------------
// Edge cases across formats
// ---------------------------------------------------------------------------

describe('edge cases across formats', () => {
	const edgeSecrets: Record<string, unknown> = {
		EMPTY: '',
		UNICODE: '日本語',
		BACKSLASH: 'C:\\path\\to\\file',
		MULTILINE: 'line1\nline2\nline3',
		QUOTES: 'has "double" and \'single\' quotes',
	};

	it('json handles all edge cases', () => {
		const result = formatSecretsAsJson(edgeSecrets);
		const parsed = JSON.parse(result) as Record<string, unknown>;
		expect(parsed.EMPTY).toBe('');
		expect(parsed.UNICODE).toBe('日本語');
		expect(parsed.BACKSLASH).toBe('C:\\path\\to\\file');
		expect(parsed.MULTILINE).toBe('line1\nline2\nline3');
		expect(parsed.QUOTES).toBe('has "double" and \'single\' quotes');
	});

	it('env escapes all edge cases properly', () => {
		const result = formatSecretsAsEnv(edgeSecrets);
		expect(result).toContain('EMPTY=""');
		expect(result).toContain('UNICODE="日本語"');
		expect(result).toContain('BACKSLASH="C:\\\\path\\\\to\\\\file"');
		expect(result).toContain('MULTILINE="line1\\nline2\\nline3"');
		expect(result).toContain('QUOTES="has \\"double\\" and \'single\' quotes"');
	});

	it('yaml quotes edge case values appropriately', () => {
		const result = formatSecretsAsYaml(edgeSecrets);
		expect(result).toContain('EMPTY: ""');
		// UNICODE has no special YAML chars, so unquoted
		expect(result).toContain('UNICODE: 日本語');
		// BACKSLASH contains \, which is not a special YAML char by itself
		expect(result).toContain('BACKSLASH:');
		// MULTILINE contains newlines → must be quoted
		expect(result).toContain('MULTILINE: "line1\\nline2\\nline3"');
	});

	it('docker handles all edge cases', () => {
		const result = formatSecretsAsDocker(edgeSecrets);
		expect(result).toContain('--env EMPTY=');
		expect(result).toContain('--env UNICODE=日本語');
	});

	it('env-no-quotes handles all edge cases', () => {
		const result = formatSecretsAsEnvNoQuotes(edgeSecrets);
		expect(result).toContain('EMPTY=');
		expect(result).toContain('UNICODE=日本語');
	});
});
