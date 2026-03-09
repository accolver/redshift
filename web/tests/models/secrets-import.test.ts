import { parseCsv, parseEnv, parseJson, parseYaml } from '$lib/models/secrets-export';
import type { Secret } from '$lib/types/nostr';
import { describe, expect, it } from 'vitest';

describe('Secrets Import (Parse)', () => {
	// =========================================================================
	// parseEnv
	// =========================================================================
	describe('parseEnv', () => {
		it('parses basic KEY=value pairs', () => {
			const input = 'HOST=localhost\nPORT=3000';
			const result = parseEnv(input);
			expect(result).toEqual([
				{ key: 'HOST', value: 'localhost' },
				{ key: 'PORT', value: '3000' },
			]);
		});

		it('handles double-quoted values with escape sequences', () => {
			const input = 'MSG="hello\\nworld"\nPATH="C:\\\\Users\\\\me"\nQUOTE="say \\"hi\\""';
			const result = parseEnv(input);
			expect(result).toEqual([
				{ key: 'MSG', value: 'hello\nworld' },
				{ key: 'PATH', value: 'C:\\Users\\me' },
				{ key: 'QUOTE', value: 'say "hi"' },
			]);
		});

		it('handles single-quoted values without escaping', () => {
			const input = "RAW='hello\\nworld'";
			const result = parseEnv(input);
			// Single quotes are literal — no escape processing
			expect(result).toEqual([{ key: 'RAW', value: 'hello\\nworld' }]);
		});

		it('ignores comment lines starting with #', () => {
			const input = '# database config\nDB_HOST=localhost\n# end';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'DB_HOST', value: 'localhost' }]);
		});

		it('ignores empty lines', () => {
			const input = 'A=1\n\n\n\nB=2';
			const result = parseEnv(input);
			expect(result).toEqual([
				{ key: 'A', value: '1' },
				{ key: 'B', value: '2' },
			]);
		});

		it('handles export KEY=VALUE format', () => {
			const input = 'export SECRET_KEY=abc123\nexport DB_URL=postgres://localhost';
			const result = parseEnv(input);
			expect(result).toEqual([
				{ key: 'SECRET_KEY', value: 'abc123' },
				{ key: 'DB_URL', value: 'postgres://localhost' },
			]);
		});

		it('only splits on the first = sign', () => {
			const input = 'CONN_STR=host=db;user=admin;pass=s3cret=';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'CONN_STR', value: 'host=db;user=admin;pass=s3cret=' }]);
		});

		it('returns empty array for empty input', () => {
			expect(parseEnv('')).toEqual([]);
			expect(parseEnv('   ')).toEqual([]);
			expect(parseEnv('\n\n')).toEqual([]);
		});

		it('handles keys without values (KEY= gives empty string)', () => {
			const input = 'EMPTY_VAL=';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'EMPTY_VAL', value: '' }]);
		});

		it('trims unquoted values with trailing spaces', () => {
			const input = 'KEY=value   ';
			const result = parseEnv(input);
			expect(result).toEqual([{ key: 'KEY', value: 'value' }]);
		});
	});

	// =========================================================================
	// parseJson
	// =========================================================================
	describe('parseJson', () => {
		it('parses a valid JSON object', () => {
			const input = '{"API_KEY": "sk_live_abc", "REGION": "us-east-1"}';
			const result = parseJson(input);
			expect(result).toEqual([
				{ key: 'API_KEY', value: 'sk_live_abc' },
				{ key: 'REGION', value: 'us-east-1' },
			]);
		});

		it('converts number values to strings', () => {
			const input = '{"PORT": 8080, "TIMEOUT": 30.5}';
			const result = parseJson(input);
			expect(result).toEqual([
				{ key: 'PORT', value: '8080' },
				{ key: 'TIMEOUT', value: '30.5' },
			]);
		});

		it('converts boolean values to strings', () => {
			const input = '{"ENABLED": true, "VERBOSE": false}';
			const result = parseJson(input);
			expect(result).toEqual([
				{ key: 'ENABLED', value: 'true' },
				{ key: 'VERBOSE', value: 'false' },
			]);
		});

		it('converts null values to string "null"', () => {
			const input = '{"OPTIONAL": null}';
			const result = parseJson(input);
			expect(result).toEqual([{ key: 'OPTIONAL', value: 'null' }]);
		});

		it('throws for JSON array input', () => {
			expect(() => parseJson('["a", "b"]')).toThrow('Expected JSON object');
		});

		it('throws for invalid JSON', () => {
			expect(() => parseJson('{not valid json}')).toThrow();
		});

		it('throws for null JSON input', () => {
			expect(() => parseJson('null')).toThrow('Expected JSON object');
		});

		it('handles nested object values by stringifying them', () => {
			const input = '{"CONFIG": {"nested": true}}';
			const result = parseJson(input);
			expect(result).toHaveLength(1);
			expect(result[0].key).toBe('CONFIG');
			// String() on an object produces "[object Object]"
			expect(result[0].value).toBe('[object Object]');
		});
	});

	// =========================================================================
	// parseYaml
	// =========================================================================
	describe('parseYaml', () => {
		it('parses basic key: value pairs', () => {
			const input = 'HOST: localhost\nPORT: 3000';
			const result = parseYaml(input);
			expect(result).toEqual([
				{ key: 'HOST', value: 'localhost' },
				{ key: 'PORT', value: '3000' },
			]);
		});

		it('handles double-quoted values', () => {
			const input = 'GREETING: "hello world"';
			const result = parseYaml(input);
			expect(result).toEqual([{ key: 'GREETING', value: 'hello world' }]);
		});

		it('handles single-quoted values', () => {
			const input = "NAME: 'my app'";
			const result = parseYaml(input);
			expect(result).toEqual([{ key: 'NAME', value: 'my app' }]);
		});

		it('strips inline comments from unquoted values', () => {
			const input = 'LEVEL: info # logging level';
			const result = parseYaml(input);
			expect(result).toEqual([{ key: 'LEVEL', value: 'info' }]);
		});

		it('ignores full comment lines', () => {
			const input = '# This is a comment\nKEY: value\n# Another comment';
			const result = parseYaml(input);
			expect(result).toEqual([{ key: 'KEY', value: 'value' }]);
		});

		it('ignores empty lines', () => {
			const input = 'A: 1\n\n\nB: 2';
			const result = parseYaml(input);
			expect(result).toEqual([
				{ key: 'A', value: '1' },
				{ key: 'B', value: '2' },
			]);
		});

		it('returns empty array for empty input', () => {
			expect(parseYaml('')).toEqual([]);
			expect(parseYaml('   ')).toEqual([]);
			expect(parseYaml('\n\n')).toEqual([]);
		});

		it('only splits on the first colon for values containing colons', () => {
			const input = 'URL: https://example.com:8080/path';
			const result = parseYaml(input);
			// The value contains colons, and there's a # check — but no inline comment here
			expect(result).toEqual([{ key: 'URL', value: 'https://example.com:8080/path' }]);
		});
	});

	// =========================================================================
	// parseCsv
	// =========================================================================
	describe('parseCsv', () => {
		it('parses basic key,value rows with header', () => {
			const input = 'key,value\nAPI_KEY,sk_test_123\nDEBUG,true';
			const result = parseCsv(input);
			expect(result).toEqual([
				{ key: 'API_KEY', value: 'sk_test_123' },
				{ key: 'DEBUG', value: 'true' },
			]);
		});

		it('handles quoted values with commas inside', () => {
			const input = 'key,value\nHOSTS,"host1,host2,host3"';
			const result = parseCsv(input);
			expect(result).toEqual([{ key: 'HOSTS', value: 'host1,host2,host3' }]);
		});

		it('handles doubled quotes inside quoted fields', () => {
			const input = 'key,value\nMSG,"She said ""hello"" to me"';
			const result = parseCsv(input);
			expect(result).toEqual([{ key: 'MSG', value: 'She said "hello" to me' }]);
		});

		it('throws for missing headers', () => {
			expect(() => parseCsv('name,secret\nA,B')).toThrow('Invalid CSV');
		});

		it('throws for empty input', () => {
			expect(() => parseCsv('')).toThrow('Invalid CSV');
		});
	});

	// =========================================================================
	// Merge vs Replace logic
	// =========================================================================
	describe('merge vs replace logic', () => {
		function mergeSecrets(existing: Secret[], imported: Secret[]): Secret[] {
			const merged = new Map(existing.map((s) => [s.key, s.value]));
			for (const s of imported) {
				merged.set(s.key, s.value);
			}
			return Array.from(merged.entries()).map(([key, value]) => ({ key, value }));
		}

		function replaceSecrets(imported: Secret[]): Secret[] {
			return [...imported];
		}

		const existing: Secret[] = [
			{ key: 'A', value: '1' },
			{ key: 'B', value: '2' },
		];

		const imported: Secret[] = [
			{ key: 'B', value: '3' },
			{ key: 'C', value: '4' },
		];

		it('merge keeps existing, updates overlapping, and adds new secrets', () => {
			const result = mergeSecrets(existing, imported);
			expect(result).toEqual([
				{ key: 'A', value: '1' }, // kept from existing
				{ key: 'B', value: '3' }, // updated by import
				{ key: 'C', value: '4' }, // added from import
			]);
		});

		it('replace discards existing and uses only imported secrets', () => {
			const result = replaceSecrets(imported);
			expect(result).toEqual([
				{ key: 'B', value: '3' },
				{ key: 'C', value: '4' },
			]);
			// A is gone — not in import
			expect(result.find((s) => s.key === 'A')).toBeUndefined();
		});
	});
});
