/**
 * Utility Function Tests for @redshift/crypto
 */

import { describe, expect, it } from 'bun:test';
import {
	validateNsec,
	validateNpub,
	decodeNsec,
	decodeNpub,
	createDTag,
	parseDTag,
} from '../src/index';

describe('Key Validation', () => {
	// Valid test keys
	const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
	const validNpub = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m';

	describe('validateNsec', () => {
		it('validates correct nsec with checksum verification', () => {
			expect(validateNsec(validNsec)).toBe(true);
		});

		it('rejects empty string', () => {
			expect(validateNsec('')).toBe(false);
		});

		it('rejects truncated nsec', () => {
			expect(validateNsec('nsec1')).toBe(false);
		});

		it('rejects npub as nsec', () => {
			expect(validateNsec(validNpub)).toBe(false);
		});

		it('rejects random string', () => {
			expect(validateNsec('not-an-nsec')).toBe(false);
		});

		it('rejects nsec with invalid checksum', () => {
			// Valid format but bad checksum (last char changed)
			const badChecksum = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe6';
			expect(validateNsec(badChecksum)).toBe(false);
		});
	});

	describe('validateNpub', () => {
		it('validates correct npub with checksum verification', () => {
			expect(validateNpub(validNpub)).toBe(true);
		});

		it('rejects empty string', () => {
			expect(validateNpub('')).toBe(false);
		});

		it('rejects truncated npub', () => {
			expect(validateNpub('npub1')).toBe(false);
		});

		it('rejects nsec as npub', () => {
			expect(validateNpub(validNsec)).toBe(false);
		});

		it('rejects npub with invalid checksum', () => {
			const badChecksum = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63n';
			expect(validateNpub(badChecksum)).toBe(false);
		});
	});
});

describe('Key Decoding', () => {
	const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
	const validNpub = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m';

	describe('decodeNsec', () => {
		it('decodes valid nsec to Uint8Array', () => {
			const privateKey = decodeNsec(validNsec);
			expect(privateKey).toBeInstanceOf(Uint8Array);
			expect(privateKey.length).toBe(32);
		});

		it('throws on invalid nsec', () => {
			expect(() => decodeNsec('invalid')).toThrow();
		});

		it('throws when given npub instead of nsec', () => {
			expect(() => decodeNsec(validNpub)).toThrow('Expected nsec');
		});
	});

	describe('decodeNpub', () => {
		it('decodes valid npub to hex string', () => {
			const publicKey = decodeNpub(validNpub);
			expect(typeof publicKey).toBe('string');
			expect(publicKey.length).toBe(64); // 32 bytes as hex
		});

		it('throws on invalid npub', () => {
			expect(() => decodeNpub('invalid')).toThrow();
		});

		it('throws when given nsec instead of npub', () => {
			expect(() => decodeNpub(validNsec)).toThrow('Expected npub');
		});
	});
});

describe('D-Tag Utilities', () => {
	describe('createDTag', () => {
		it('creates d-tag from project and environment', () => {
			expect(createDTag('proj123', 'production')).toBe('proj123|production');
		});

		it('handles hyphens in names', () => {
			expect(createDTag('my-project', 'dev-env')).toBe('my-project|dev-env');
		});

		it('handles underscores in names', () => {
			expect(createDTag('my_project', 'staging_1')).toBe('my_project|staging_1');
		});

		// Human-friendly project name tests
		it('creates d-tag with human-friendly project name', () => {
			expect(createDTag('keyfate', 'production')).toBe('keyfate|production');
		});

		it('handles mixed case project names (preserves case)', () => {
			expect(createDTag('MyProject', 'Dev')).toBe('MyProject|Dev');
		});

		it('handles project names with numbers', () => {
			expect(createDTag('project2024', 'v1')).toBe('project2024|v1');
		});

		it('handles short environment slugs', () => {
			expect(createDTag('acme-corp', 'prd')).toBe('acme-corp|prd');
			expect(createDTag('acme-corp', 'dev')).toBe('acme-corp|dev');
			expect(createDTag('acme-corp', 'stg')).toBe('acme-corp|stg');
		});

		it('handles long project names', () => {
			const longName = 'my-super-long-project-name-for-testing';
			expect(createDTag(longName, 'prod')).toBe(`${longName}|prod`);
		});
	});

	describe('parseDTag', () => {
		it('parses valid d-tag', () => {
			const result = parseDTag('project123|staging');
			expect(result).toEqual({
				projectId: 'project123',
				environment: 'staging',
			});
		});

		it('returns null for empty string', () => {
			expect(parseDTag('')).toBeNull();
		});

		it('returns null for d-tag without pipe', () => {
			expect(parseDTag('nopipe')).toBeNull();
		});

		it('returns null for d-tag with empty project', () => {
			expect(parseDTag('|empty')).toBeNull();
		});

		it('returns null for d-tag with empty environment', () => {
			expect(parseDTag('empty|')).toBeNull();
		});

		it('returns null for d-tag with multiple pipes', () => {
			expect(parseDTag('too|many|pipes')).toBeNull();
		});

		it('handles hyphens in parsed values', () => {
			const result = parseDTag('my-project|dev-env');
			expect(result).toEqual({
				projectId: 'my-project',
				environment: 'dev-env',
			});
		});

		// Human-friendly project name tests
		it('parses human-friendly project name', () => {
			const result = parseDTag('keyfate|production');
			expect(result).toEqual({
				projectId: 'keyfate',
				environment: 'production',
			});
		});

		it('parses short environment slugs', () => {
			expect(parseDTag('myapp|prd')).toEqual({
				projectId: 'myapp',
				environment: 'prd',
			});
			expect(parseDTag('myapp|dev')).toEqual({
				projectId: 'myapp',
				environment: 'dev',
			});
		});

		it('preserves case in parsed values', () => {
			const result = parseDTag('MyProject|Production');
			expect(result).toEqual({
				projectId: 'MyProject',
				environment: 'Production',
			});
		});

		it('handles project names with numbers', () => {
			const result = parseDTag('project2024|v1-release');
			expect(result).toEqual({
				projectId: 'project2024',
				environment: 'v1-release',
			});
		});
	});

	describe('createDTag and parseDTag roundtrip', () => {
		it('roundtrips simple names', () => {
			const projectName = 'myproject';
			const env = 'production';
			const dTag = createDTag(projectName, env);
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: projectName,
				environment: env,
			});
		});

		it('roundtrips human-friendly names', () => {
			const projectName = 'keyfate';
			const env = 'prd';
			const dTag = createDTag(projectName, env);
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: projectName,
				environment: env,
			});
		});

		it('roundtrips names with special characters', () => {
			const projectName = 'my-awesome-project_v2';
			const env = 'staging-us-east-1';
			const dTag = createDTag(projectName, env);
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: projectName,
				environment: env,
			});
		});

		it('roundtrips mixed case names', () => {
			const projectName = 'AcmeCorp';
			const env = 'QA';
			const dTag = createDTag(projectName, env);
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: projectName,
				environment: env,
			});
		});
	});
});
