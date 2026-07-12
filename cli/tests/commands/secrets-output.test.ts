import { describe, expect, it } from 'bun:test';
import {
	formatSecretValue,
	parseSecretUpload,
	prepareSecretsForOutput,
} from '../../src/commands/secrets';

describe('secret output boundaries', () => {
	it('redacts every value unless plaintext output is explicit', () => {
		const output = prepareSecretsForOutput({ API_KEY: 'super-secret-value', EMPTY: '' }, false);
		expect(output.API_KEY).not.toContain('super-secret-value');
		expect(output.EMPTY).toBe('(empty)');
	});

	it('returns exact plaintext without truncation only in raw mode', () => {
		const value = 'x'.repeat(200);
		expect(formatSecretValue(value, true)).toBe(value);
		expect(prepareSecretsForOutput({ LONG_SECRET: value }, true)).toEqual({
			LONG_SECRET: value,
		});
	});

	it('validates uploads atomically with detailed line and normalized duplicate errors', () => {
		expect(() => parseSecretUpload('GOOD=value\nmalformed\nOTHER="unterminated')).toThrow(
			'line 2: expected KEY=value',
		);
		expect(() => parseSecretUpload('api_key=one\nAPI_KEY=two')).toThrow(
			'duplicate key after normalization: API_KEY',
		);
		expect(() => parseSecretUpload('NODE_OPTIONS=--require=attack.js')).toThrow(
			'NODE_OPTIONS can expose Redshift authentication or alter runtime startup',
		);
	});

	it('normalizes a fully valid upload only after validation', () => {
		expect(parseSecretUpload('api_key="value"\nEMPTY=')).toEqual({
			API_KEY: 'value',
			EMPTY: '',
		});
	});
});
