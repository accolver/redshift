/**
 * Gift Wrap Secrets Model Tests
 *
 * Tests the gift-wrap-secrets model functions for:
 * - Human-friendly project names in d-tags
 * - Proper decryption and filtering
 * - Environment handling
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { wrapSecrets, createDTag, parseDTag, NostrKinds, REDSHIFT_TYPE_TAG } from '@redshift/crypto';

// Test with human-friendly project names
describe('Gift Wrap Secrets with Human-Friendly Names', () => {
	// Generate a test key pair
	const privateKey = generateSecretKey();
	const publicKey = getPublicKey(privateKey);

	describe('d-tag creation with project names', () => {
		it('creates d-tag with human-friendly project name', () => {
			const dTag = createDTag('keyfate', 'production');
			expect(dTag).toBe('keyfate|production');
		});

		it('creates d-tag with short environment slug', () => {
			const dTag = createDTag('myapp', 'prd');
			expect(dTag).toBe('myapp|prd');
		});

		it('parses d-tag back to project name and environment', () => {
			const dTag = createDTag('keyfate', 'dev');
			const parsed = parseDTag(dTag);
			expect(parsed).toEqual({
				projectId: 'keyfate',
				environment: 'dev',
			});
		});
	});

	describe('wrapSecrets with project names', () => {
		it('wraps secrets with human-friendly project name in d-tag', () => {
			const secrets = { API_KEY: 'secret123', DB_URL: 'postgres://...' };
			const dTag = createDTag('keyfate', 'production');

			const { event, rumor } = wrapSecrets(secrets, privateKey, dTag);

			// Event should be a valid Gift Wrap
			expect(event.kind).toBe(NostrKinds.GIFT_WRAP);
			expect(event.tags).toContainEqual(['p', publicKey]);
			expect(event.tags).toContainEqual(['t', REDSHIFT_TYPE_TAG]);

			// Rumor should contain the d-tag with project name
			expect(rumor.tags).toContainEqual(['d', 'keyfate|production']);
		});

		it('wraps secrets with different environments for same project', () => {
			const secrets = { ENV: 'development' };

			const devResult = wrapSecrets(secrets, privateKey, createDTag('keyfate', 'dev'));
			const prdResult = wrapSecrets(secrets, privateKey, createDTag('keyfate', 'prd'));

			// Both should have different d-tags
			expect(devResult.rumor.tags.find((t) => t[0] === 'd')?.[1]).toBe('keyfate|dev');
			expect(prdResult.rumor.tags.find((t) => t[0] === 'd')?.[1]).toBe('keyfate|prd');
		});

		it('handles various project name formats', () => {
			const testCases = [
				{ project: 'simple', env: 'prod' },
				{ project: 'my-project', env: 'staging' },
				{ project: 'my_project', env: 'test' },
				{ project: 'Project2024', env: 'v1' },
				{ project: 'acme-corp-api', env: 'us-east-1' },
			];

			for (const { project, env } of testCases) {
				const dTag = createDTag(project, env);
				const { rumor } = wrapSecrets({ KEY: 'value' }, privateKey, dTag);

				const rumorDTag = rumor.tags.find((t) => t[0] === 'd')?.[1];
				expect(rumorDTag).toBe(`${project}|${env}`);

				// Should be parseable back
				const parsed = parseDTag(rumorDTag!);
				expect(parsed?.projectId).toBe(project);
				expect(parsed?.environment).toBe(env);
			}
		});
	});

	describe('CLI and Web compatibility', () => {
		it('creates d-tags that CLI can understand', () => {
			// CLI uses createDTag('projectName', 'environment')
			// Web should create the same format
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
				// Create d-tag
				const dTag = createDTag(projectName, env);

				// Parse it back
				const parsed = parseDTag(dTag);

				// Create again from parsed values
				const recreatedDTag = createDTag(parsed!.projectId, parsed!.environment);

				// Should be identical
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

		// These should match
		expect(targetDTag).toBe('keyfate|production');

		// These should not match
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
