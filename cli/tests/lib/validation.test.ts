/**
 * Tests for input validation
 *
 * L1: Syntax-Linter - Code quality validation
 */

import { describe, expect, test } from 'bun:test';
import {
	formatValidationError,
	validateAll,
	validateEnvironment,
	validateProjectId,
	validateRelayUrl,
	validateSecretKey,
	validateSecretValue,
} from '../../src/lib/validation';

describe('validateSecretKey', () => {
	test('accepts valid keys', () => {
		expect(validateSecretKey('DATABASE_URL').valid).toBe(true);
		expect(validateSecretKey('API_KEY').valid).toBe(true);
		expect(validateSecretKey('MY_SECRET_123').valid).toBe(true);
		expect(validateSecretKey('_PRIVATE').valid).toBe(true);
		expect(validateSecretKey('a').valid).toBe(true);
		expect(validateSecretKey('A').valid).toBe(true);
		expect(validateSecretKey('_').valid).toBe(true);
		expect(validateSecretKey('a1').valid).toBe(true);
	});

	test('rejects empty keys', () => {
		const result = validateSecretKey('');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('empty');
	});

	test('rejects keys starting with numbers', () => {
		const result = validateSecretKey('1_DATABASE');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('start with a letter or underscore');
	});

	test('rejects keys with invalid characters', () => {
		expect(validateSecretKey('MY-KEY').valid).toBe(false);
		expect(validateSecretKey('MY.KEY').valid).toBe(false);
		expect(validateSecretKey('MY KEY').valid).toBe(false);
		expect(validateSecretKey('MY@KEY').valid).toBe(false);
		expect(validateSecretKey('MY$KEY').valid).toBe(false);
	});

	test('rejects keys exceeding 256 characters', () => {
		const longKey = 'A'.repeat(257);
		const result = validateSecretKey(longKey);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('256 characters');
	});

	test('accepts keys at 256 character limit', () => {
		const maxKey = 'A'.repeat(256);
		expect(validateSecretKey(maxKey).valid).toBe(true);
	});

	test('rejects reserved system variables', () => {
		expect(validateSecretKey('PATH').valid).toBe(false);
		expect(validateSecretKey('HOME').valid).toBe(false);
		expect(validateSecretKey('USER').valid).toBe(false);
		expect(validateSecretKey('LD_PRELOAD').valid).toBe(false);
		expect(validateSecretKey('DYLD_INSERT_LIBRARIES').valid).toBe(false);

		// Error should mention reserved
		const result = validateSecretKey('PATH');
		expect(result.error).toContain('reserved');
	});
});

describe('validateProjectId', () => {
	test('accepts valid project IDs', () => {
		expect(validateProjectId('my-project').valid).toBe(true);
		expect(validateProjectId('project123').valid).toBe(true);
		expect(validateProjectId('a').valid).toBe(true);
		expect(validateProjectId('abc').valid).toBe(true);
		expect(validateProjectId('a1b2c3').valid).toBe(true);
	});

	test('rejects empty project IDs', () => {
		const result = validateProjectId('');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('empty');
	});

	test('rejects uppercase letters', () => {
		const result = validateProjectId('MyProject');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('lowercase');
	});

	test('rejects starting with hyphen', () => {
		const result = validateProjectId('-project');
		expect(result.valid).toBe(false);
	});

	test('rejects ending with hyphen', () => {
		const result = validateProjectId('project-');
		expect(result.valid).toBe(false);
	});

	test('rejects underscores', () => {
		const result = validateProjectId('my_project');
		expect(result.valid).toBe(false);
	});

	test('rejects IDs exceeding 64 characters', () => {
		const longId = 'a'.repeat(65);
		const result = validateProjectId(longId);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('64 characters');
	});

	test('accepts IDs at 64 character limit', () => {
		const maxId = 'a'.repeat(64);
		expect(validateProjectId(maxId).valid).toBe(true);
	});
});

describe('validateEnvironment', () => {
	test('accepts valid environment names', () => {
		expect(validateEnvironment('development').valid).toBe(true);
		expect(validateEnvironment('production').valid).toBe(true);
		expect(validateEnvironment('staging').valid).toBe(true);
		expect(validateEnvironment('dev').valid).toBe(true);
		expect(validateEnvironment('prod').valid).toBe(true);
		expect(validateEnvironment('staging-1').valid).toBe(true);
	});

	test('rejects empty environments', () => {
		const result = validateEnvironment('');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('empty');
	});

	test('rejects uppercase letters', () => {
		const result = validateEnvironment('Production');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('lowercase');
	});

	test('rejects starting with hyphen', () => {
		const result = validateEnvironment('-dev');
		expect(result.valid).toBe(false);
	});

	test('rejects ending with hyphen', () => {
		const result = validateEnvironment('dev-');
		expect(result.valid).toBe(false);
	});

	test('rejects environments exceeding 32 characters', () => {
		const longEnv = 'a'.repeat(33);
		const result = validateEnvironment(longEnv);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('32 characters');
	});

	test('accepts environments at 32 character limit', () => {
		const maxEnv = 'a'.repeat(32);
		expect(validateEnvironment(maxEnv).valid).toBe(true);
	});
});

describe('validateSecretValue', () => {
	test('accepts valid values', () => {
		expect(validateSecretValue('hello').valid).toBe(true);
		expect(validateSecretValue('').valid).toBe(true); // Empty is valid
		expect(validateSecretValue('with spaces').valid).toBe(true);
		expect(validateSecretValue('with\nnewlines').valid).toBe(true);
		expect(validateSecretValue('{"json": true}').valid).toBe(true);
	});

	test('rejects values exceeding 64KB', () => {
		const largeValue = 'x'.repeat(65537);
		const result = validateSecretValue(largeValue);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('64KB');
	});

	test('accepts values at 64KB limit', () => {
		const maxValue = 'x'.repeat(65536);
		expect(validateSecretValue(maxValue).valid).toBe(true);
	});

	test('rejects values with null bytes', () => {
		const result = validateSecretValue('hello\0world');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('null bytes');
	});
});

describe('validateRelayUrl', () => {
	test('accepts valid wss:// URLs', () => {
		expect(validateRelayUrl('wss://relay.damus.io').valid).toBe(true);
		expect(validateRelayUrl('wss://nos.lol').valid).toBe(true);
		expect(validateRelayUrl('wss://relay.example.com:8080').valid).toBe(true);
		expect(validateRelayUrl('wss://relay.example.com/path').valid).toBe(true);
	});

	test('accepts ws:// for localhost', () => {
		expect(validateRelayUrl('ws://localhost').valid).toBe(true);
		expect(validateRelayUrl('ws://localhost:8080').valid).toBe(true);
		expect(validateRelayUrl('ws://127.0.0.1').valid).toBe(true);
		expect(validateRelayUrl('ws://127.0.0.1:9999').valid).toBe(true);
		expect(validateRelayUrl('ws://[::1]').valid).toBe(true);
	});

	test('rejects ws:// for non-localhost', () => {
		const result = validateRelayUrl('ws://relay.example.com');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('localhost');
	});

	test('rejects http:// URLs', () => {
		const result = validateRelayUrl('http://relay.example.com');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('wss:// or ws://');
	});

	test('rejects https:// URLs', () => {
		const result = validateRelayUrl('https://relay.example.com');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('wss:// or ws://');
	});

	test('rejects empty URLs', () => {
		const result = validateRelayUrl('');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('empty');
	});

	test('rejects invalid URLs', () => {
		const result = validateRelayUrl('not-a-url');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Invalid URL');
	});
});

describe('formatValidationError', () => {
	test('formats error message correctly', () => {
		const result = { valid: false, error: 'must be lowercase' };
		const formatted = formatValidationError('project ID', result);
		expect(formatted).toBe('Invalid project ID: must be lowercase');
	});
});

describe('validateAll', () => {
	test('passes when all validations succeed', () => {
		expect(() => {
			validateAll([
				['project ID', 'my-project', validateProjectId],
				['environment', 'development', validateEnvironment],
				['secret key', 'API_KEY', validateSecretKey],
			]);
		}).not.toThrow();
	});

	test('throws on first validation failure', () => {
		expect(() => {
			validateAll([
				['project ID', 'my-project', validateProjectId],
				['environment', 'PRODUCTION', validateEnvironment], // Invalid
				['secret key', 'API_KEY', validateSecretKey],
			]);
		}).toThrow('Invalid environment');
	});

	test('error message includes field name', () => {
		try {
			validateAll([['project ID', 'MY-PROJECT', validateProjectId]]);
		} catch (e) {
			expect((e as Error).message).toContain('project ID');
		}
	});
});
