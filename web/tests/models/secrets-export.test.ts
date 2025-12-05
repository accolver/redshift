import { describe, it, expect } from 'vitest';
import {
	exportToEnv,
	exportToJson,
	exportToYaml,
	exportToCsv,
	parseEnv,
	parseJson,
	parseYaml,
	parseCsv,
} from '$lib/models/secrets-export';
import type { Secret } from '$lib/types/nostr';

describe('Secrets Export/Import', () => {
	const testSecrets: Secret[] = [
		{ key: 'API_KEY', value: 'sk_test_12345' },
		{ key: 'DATABASE_URL', value: 'postgres://user:pass@localhost:5432/db' },
		{ key: 'DEBUG', value: 'true' },
	];

	describe('exportToEnv', () => {
		it('exports secrets to .env format', () => {
			const result = exportToEnv(testSecrets);
			expect(result).toBe(
				'API_KEY=sk_test_12345\nDATABASE_URL=postgres://user:pass@localhost:5432/db\nDEBUG=true',
			);
		});

		it('handles empty secrets array', () => {
			const result = exportToEnv([]);
			expect(result).toBe('');
		});

		it('escapes values with special characters', () => {
			const secrets: Secret[] = [
				{ key: 'MULTILINE', value: 'line1\nline2' },
				{ key: 'QUOTED', value: 'has "quotes"' },
			];
			const result = exportToEnv(secrets);
			// Values with special chars should be quoted
			expect(result).toContain('MULTILINE="line1\\nline2"');
			expect(result).toContain('QUOTED="has \\"quotes\\""');
		});

		it('handles values with equals signs', () => {
			const secrets: Secret[] = [{ key: 'CONN', value: 'host=localhost;port=5432' }];
			const result = exportToEnv(secrets);
			expect(result).toBe('CONN=host=localhost;port=5432');
		});
	});

	describe('exportToJson', () => {
		it('exports secrets to JSON format', () => {
			const result = exportToJson(testSecrets);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({
				API_KEY: 'sk_test_12345',
				DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
				DEBUG: 'true',
			});
		});

		it('handles empty secrets array', () => {
			const result = exportToJson([]);
			expect(JSON.parse(result)).toEqual({});
		});

		it('produces formatted JSON with indentation', () => {
			const result = exportToJson(testSecrets);
			expect(result).toContain('\n'); // Should be prettified
		});
	});

	describe('exportToYaml', () => {
		it('exports secrets to YAML format', () => {
			const result = exportToYaml(testSecrets);
			expect(result).toContain('API_KEY: sk_test_12345');
			// URLs with colons get quoted
			expect(result).toContain('DATABASE_URL: "postgres://user:pass@localhost:5432/db"');
			expect(result).toContain('DEBUG: "true"');
		});

		it('handles empty secrets array', () => {
			const result = exportToYaml([]);
			expect(result).toBe('');
		});

		it('quotes values that look like booleans or numbers', () => {
			const secrets: Secret[] = [
				{ key: 'BOOL', value: 'true' },
				{ key: 'NUM', value: '123' },
				{ key: 'STR', value: 'hello' },
			];
			const result = exportToYaml(secrets);
			expect(result).toContain('BOOL: "true"');
			expect(result).toContain('NUM: "123"');
			expect(result).toContain('STR: hello');
		});

		it('handles values with colons', () => {
			const secrets: Secret[] = [{ key: 'URL', value: 'https://example.com' }];
			const result = exportToYaml(secrets);
			expect(result).toContain('URL: "https://example.com"');
		});
	});

	describe('exportToCsv', () => {
		it('exports secrets to CSV format with headers', () => {
			const result = exportToCsv(testSecrets);
			const lines = result.split('\n');
			expect(lines[0]).toBe('key,value');
			expect(lines[1]).toBe('API_KEY,sk_test_12345');
		});

		it('handles empty secrets array', () => {
			const result = exportToCsv([]);
			expect(result).toBe('key,value');
		});

		it('quotes values with commas', () => {
			const secrets: Secret[] = [{ key: 'LIST', value: 'a,b,c' }];
			const result = exportToCsv(secrets);
			expect(result).toContain('LIST,"a,b,c"');
		});

		it('escapes quotes in values', () => {
			const secrets: Secret[] = [{ key: 'QUOTED', value: 'say "hello"' }];
			const result = exportToCsv(secrets);
			expect(result).toContain('QUOTED,"say ""hello"""');
		});
	});

	describe('parseEnv', () => {
		it('parses .env format', () => {
			const input = 'API_KEY=sk_test_12345\nDATABASE_URL=postgres://localhost';
			const result = parseEnv(input);
			expect(result).toEqual([
				{ key: 'API_KEY', value: 'sk_test_12345' },
				{ key: 'DATABASE_URL', value: 'postgres://localhost' },
			]);
		});

		it('handles empty input', () => {
			expect(parseEnv('')).toEqual([]);
		});

		it('handles comments', () => {
			const input = '# Comment\nAPI_KEY=value\n# Another comment';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'API_KEY', value: 'value' }]);
		});

		it('handles quoted values', () => {
			const input = 'KEY="value with spaces"\nKEY2=\'single quotes\'';
			const result = parseEnv(input);
			expect(result).toEqual([
				{ key: 'KEY', value: 'value with spaces' },
				{ key: 'KEY2', value: 'single quotes' },
			]);
		});

		it('handles escaped newlines in quoted values', () => {
			const input = 'MULTILINE="line1\\nline2"';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'MULTILINE', value: 'line1\nline2' }]);
		});

		it('handles values with equals signs', () => {
			const input = 'CONN=host=localhost;port=5432';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'CONN', value: 'host=localhost;port=5432' }]);
		});

		it('handles empty values', () => {
			const input = 'EMPTY=';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'EMPTY', value: '' }]);
		});

		it('trims whitespace around keys and values', () => {
			const input = '  KEY  =  value  ';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'KEY', value: 'value' }]);
		});

		it('skips empty lines', () => {
			const input = 'KEY1=value1\n\n\nKEY2=value2';
			const result = parseEnv(input);
			expect(result).toHaveLength(2);
		});

		it('handles export prefix', () => {
			const input = 'export API_KEY=value';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'API_KEY', value: 'value' }]);
		});
	});

	describe('parseJson', () => {
		it('parses JSON object format', () => {
			const input = '{"API_KEY": "sk_test_12345", "DEBUG": "true"}';
			const result = parseJson(input);
			expect(result).toEqual([
				{ key: 'API_KEY', value: 'sk_test_12345' },
				{ key: 'DEBUG', value: 'true' },
			]);
		});

		it('handles empty object', () => {
			expect(parseJson('{}')).toEqual([]);
		});

		it('converts non-string values to strings', () => {
			const input = '{"NUM": 123, "BOOL": true, "NULL": null}';
			const result = parseJson(input);
			expect(result).toEqual([
				{ key: 'NUM', value: '123' },
				{ key: 'BOOL', value: 'true' },
				{ key: 'NULL', value: 'null' },
			]);
		});

		it('throws on invalid JSON', () => {
			expect(() => parseJson('not json')).toThrow();
		});

		it('throws on array input', () => {
			expect(() => parseJson('[]')).toThrow('Expected JSON object');
		});
	});

	describe('parseYaml', () => {
		it('parses YAML format', () => {
			const input = 'API_KEY: sk_test_12345\nDEBUG: true';
			const result = parseYaml(input);
			expect(result).toEqual([
				{ key: 'API_KEY', value: 'sk_test_12345' },
				{ key: 'DEBUG', value: 'true' },
			]);
		});

		it('handles empty input', () => {
			expect(parseYaml('')).toEqual([]);
		});

		it('handles quoted strings', () => {
			const input = 'KEY: "quoted value"\nKEY2: \'single quoted\'';
			const result = parseYaml(input);
			expect(result).toEqual([
				{ key: 'KEY', value: 'quoted value' },
				{ key: 'KEY2', value: 'single quoted' },
			]);
		});

		it('handles comments', () => {
			const input = '# Comment\nKEY: value # inline comment';
			const result = parseYaml(input);
			expect(result).toEqual([{ key: 'KEY', value: 'value' }]);
		});

		it('converts numbers and booleans to strings', () => {
			const input = 'NUM: 123\nBOOL: false';
			const result = parseYaml(input);
			expect(result).toEqual([
				{ key: 'NUM', value: '123' },
				{ key: 'BOOL', value: 'false' },
			]);
		});
	});

	describe('parseCsv', () => {
		it('parses CSV with headers', () => {
			const input = 'key,value\nAPI_KEY,sk_test_12345\nDEBUG,true';
			const result = parseCsv(input);
			expect(result).toEqual([
				{ key: 'API_KEY', value: 'sk_test_12345' },
				{ key: 'DEBUG', value: 'true' },
			]);
		});

		it('handles empty CSV (headers only)', () => {
			expect(parseCsv('key,value')).toEqual([]);
		});

		it('handles quoted values with commas', () => {
			const input = 'key,value\nLIST,"a,b,c"';
			const result = parseCsv(input);
			expect(result).toEqual([{ key: 'LIST', value: 'a,b,c' }]);
		});

		it('handles escaped quotes', () => {
			const input = 'key,value\nQUOTED,"say ""hello"""';
			const result = parseCsv(input);
			expect(result).toEqual([{ key: 'QUOTED', value: 'say "hello"' }]);
		});

		it('throws on missing headers', () => {
			expect(() => parseCsv('')).toThrow('Invalid CSV');
		});

		it('handles CRLF line endings', () => {
			const input = 'key,value\r\nAPI_KEY,value\r\n';
			const result = parseCsv(input);
			expect(result).toEqual([{ key: 'API_KEY', value: 'value' }]);
		});
	});

	describe('round-trip consistency', () => {
		it('env format round-trips correctly', () => {
			const exported = exportToEnv(testSecrets);
			const imported = parseEnv(exported);
			expect(imported).toEqual(testSecrets);
		});

		it('json format round-trips correctly', () => {
			const exported = exportToJson(testSecrets);
			const imported = parseJson(exported);
			expect(imported).toEqual(testSecrets);
		});

		it('yaml format round-trips correctly', () => {
			const exported = exportToYaml(testSecrets);
			const imported = parseYaml(exported);
			expect(imported).toEqual(testSecrets);
		});

		it('csv format round-trips correctly', () => {
			const exported = exportToCsv(testSecrets);
			const imported = parseCsv(exported);
			expect(imported).toEqual(testSecrets);
		});
	});
});
