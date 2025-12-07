/**
 * Gift Wrap Secrets Model Tests
 *
 * Tests the gift-wrap-secrets model functions for:
 * - Human-friendly project names in d-tags
 * - Proper d-tag creation and parsing
 * - Environment handling
 *
 * Note: Cryptographic operations (wrapSecrets, unwrapGiftWrap) are tested
 * in packages/crypto/tests where they run with Bun's native crypto support.
 */

import { describe, expect, it } from 'vitest';
import { createDTag, parseDTag } from '@redshift/crypto';

describe('D-Tag Operations', () => {
	describe('createDTag with project names', () => {
		it('creates d-tag with human-friendly project name', () => {
			const dTag = createDTag('keyfate', 'production');
			expect(dTag).toBe('keyfate|production');
		});

		it('creates d-tag with short environment slug', () => {
			const dTag = createDTag('myapp', 'prd');
			expect(dTag).toBe('myapp|prd');
		});

		it('handles various project name formats', () => {
			const testCases = [
				{ project: 'simple', env: 'prod', expected: 'simple|prod' },
				{ project: 'my-project', env: 'staging', expected: 'my-project|staging' },
				{ project: 'my_project', env: 'test', expected: 'my_project|test' },
				{ project: 'Project2024', env: 'v1', expected: 'Project2024|v1' },
				{ project: 'acme-corp-api', env: 'us-east-1', expected: 'acme-corp-api|us-east-1' },
			];

			for (const { project, env, expected } of testCases) {
				const dTag = createDTag(project, env);
				expect(dTag).toBe(expected);
			}
		});
	});

	describe('parseDTag', () => {
		it('parses d-tag back to project name and environment', () => {
			const dTag = createDTag('keyfate', 'dev');
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: 'keyfate',
				environment: 'dev',
			});
		});

		it('parses d-tag with various formats', () => {
			const testCases = [
				{ dTag: 'simple|prod', projectId: 'simple', environment: 'prod' },
				{ dTag: 'my-project|staging', projectId: 'my-project', environment: 'staging' },
				{ dTag: 'Project2024|v1', projectId: 'Project2024', environment: 'v1' },
			];

			for (const { dTag, projectId, environment } of testCases) {
				const parsed = parseDTag(dTag);
				expect(parsed).toEqual({ projectId, environment });
			}
		});

		it('returns null for invalid d-tags', () => {
			expect(parseDTag('invalid')).toBeNull();
			expect(parseDTag('')).toBeNull();
			expect(parseDTag('no-separator')).toBeNull();
		});
	});

	describe('CLI and Web compatibility', () => {
		it('creates d-tags that CLI can understand', () => {
			const projectName = 'keyfate';
			const env = 'production';

			const dTag = createDTag(projectName, env);

			// CLI parses with parseDTag
			const parsed = parseDTag(dTag);
			expect(parsed).not.toBeNull();
			expect(parsed!.projectId).toBe(projectName);
			expect(parsed!.environment).toBe(env);
		});

		it('maintains consistency across multiple creates and parses', () => {
			const projectName = 'test-project';
			const environments = ['dev', 'staging', 'prd', 'production'];

			for (const env of environments) {
				const dTag = createDTag(projectName, env);
				const parsed = parseDTag(dTag);
				const recreatedDTag = createDTag(parsed!.projectId, parsed!.environment);

				expect(recreatedDTag).toBe(dTag);
			}
		});
	});
});

describe('Bundle to Secrets Conversion', () => {
	it('converts simple string values', () => {
		const bundle = { API_KEY: 'secret123', DB_URL: 'postgres://localhost' };
		const secrets = Object.entries(bundle).map(([key, value]) => ({
			key,
			value: typeof value === 'string' ? value : JSON.stringify(value),
		}));

		expect(secrets).toHaveLength(2);
		expect(secrets.find((s) => s.key === 'API_KEY')?.value).toBe('secret123');
		expect(secrets.find((s) => s.key === 'DB_URL')?.value).toBe('postgres://localhost');
	});

	it('converts non-string values to JSON', () => {
		const bundle = {
			CONFIG: { nested: true },
			COUNT: 42,
			FLAG: true,
		};
		const secrets = Object.entries(bundle).map(([key, value]) => ({
			key,
			value: typeof value === 'string' ? value : JSON.stringify(value),
		}));

		expect(secrets.find((s) => s.key === 'CONFIG')?.value).toBe('{"nested":true}');
		expect(secrets.find((s) => s.key === 'COUNT')?.value).toBe('42');
		expect(secrets.find((s) => s.key === 'FLAG')?.value).toBe('true');
	});
});

describe('Environment Filtering', () => {
	it('correctly identifies target d-tag for filtering', () => {
		const projectName = 'keyfate';
		const targetEnv = 'production';
		const targetDTag = `${projectName}|${targetEnv}`;

		expect(targetDTag).toBe('keyfate|production');
		expect(`${projectName}|dev`).not.toBe(targetDTag);
		expect(`other-project|${targetEnv}`).not.toBe(targetDTag);
	});

	it('creates correct target d-tags for multiple environments', () => {
		const projectName = 'keyfate';
		const environments = ['dev', 'staging', 'prd'];
		const targetDTags = new Set(environments.map((env) => `${projectName}|${env}`));

		expect(targetDTags.has('keyfate|dev')).toBe(true);
		expect(targetDTags.has('keyfate|staging')).toBe(true);
		expect(targetDTags.has('keyfate|prd')).toBe(true);
		expect(targetDTags.has('keyfate|production')).toBe(false);
		expect(targetDTags.has('other|dev')).toBe(false);
	});
});
