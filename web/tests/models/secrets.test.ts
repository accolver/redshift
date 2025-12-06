import { describe, it, expect } from 'vitest';
import {
	createSecretsContent,
	upsertSecret,
	removeSecret,
	parseSecretsContent,
	calculateMissingSecrets,
} from '$lib/models/secrets';
import type { Secret } from '$lib/types/nostr';

describe('Secrets Model', () => {
	describe('createSecretsContent', () => {
		it('creates content with type "secrets"', () => {
			const content = createSecretsContent([]);
			expect(content.type).toBe('secrets');
		});

		it('includes provided secrets array', () => {
			const secrets: Secret[] = [
				{ key: 'API_KEY', value: 'secret123' },
				{ key: 'DB_URL', value: 'postgres://localhost' },
			];
			const content = createSecretsContent(secrets);

			expect(content.secrets).toHaveLength(2);
			expect(content.secrets[0].key).toBe('API_KEY');
			expect(content.secrets[1].key).toBe('DB_URL');
		});

		it('creates content with updatedAt timestamp', () => {
			const before = Date.now();
			const content = createSecretsContent([]);
			const after = Date.now();

			expect(content.updatedAt).toBeGreaterThanOrEqual(before);
			expect(content.updatedAt).toBeLessThanOrEqual(after);
		});

		it('handles empty secrets array', () => {
			const content = createSecretsContent([]);
			expect(content.secrets).toEqual([]);
		});
	});

	describe('upsertSecret', () => {
		it('adds new secret to empty array', () => {
			const result = upsertSecret([], 'API_KEY', 'secret123');

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({ key: 'API_KEY', value: 'secret123' });
		});

		it('adds new secret to existing array', () => {
			const existing: Secret[] = [{ key: 'DB_URL', value: 'postgres://localhost' }];
			const result = upsertSecret(existing, 'API_KEY', 'secret123');

			expect(result).toHaveLength(2);
			expect(result[0].key).toBe('DB_URL');
			expect(result[1].key).toBe('API_KEY');
		});

		it('updates existing secret with same key', () => {
			const existing: Secret[] = [
				{ key: 'API_KEY', value: 'old-value' },
				{ key: 'DB_URL', value: 'postgres://localhost' },
			];
			const result = upsertSecret(existing, 'API_KEY', 'new-value');

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ key: 'API_KEY', value: 'new-value' });
			expect(result[1].key).toBe('DB_URL');
		});

		it('does not modify original array', () => {
			const existing: Secret[] = [{ key: 'API_KEY', value: 'old-value' }];
			const result = upsertSecret(existing, 'API_KEY', 'new-value');

			expect(existing[0].value).toBe('old-value');
			expect(result[0].value).toBe('new-value');
		});

		it('preserves order when updating', () => {
			const existing: Secret[] = [
				{ key: 'FIRST', value: '1' },
				{ key: 'SECOND', value: '2' },
				{ key: 'THIRD', value: '3' },
			];
			const result = upsertSecret(existing, 'SECOND', 'updated');

			expect(result[0].key).toBe('FIRST');
			expect(result[1].key).toBe('SECOND');
			expect(result[1].value).toBe('updated');
			expect(result[2].key).toBe('THIRD');
		});
	});

	describe('removeSecret', () => {
		it('removes secret by key', () => {
			const existing: Secret[] = [
				{ key: 'API_KEY', value: 'secret123' },
				{ key: 'DB_URL', value: 'postgres://localhost' },
			];
			const result = removeSecret(existing, 'API_KEY');

			expect(result).toHaveLength(1);
			expect(result[0].key).toBe('DB_URL');
		});

		it('returns empty array when removing last secret', () => {
			const existing: Secret[] = [{ key: 'API_KEY', value: 'secret123' }];
			const result = removeSecret(existing, 'API_KEY');

			expect(result).toHaveLength(0);
		});

		it('returns unchanged array when key not found', () => {
			const existing: Secret[] = [{ key: 'API_KEY', value: 'secret123' }];
			const result = removeSecret(existing, 'NON_EXISTENT');

			expect(result).toHaveLength(1);
			expect(result[0].key).toBe('API_KEY');
		});

		it('does not modify original array', () => {
			const existing: Secret[] = [
				{ key: 'API_KEY', value: 'secret123' },
				{ key: 'DB_URL', value: 'postgres://localhost' },
			];
			const result = removeSecret(existing, 'API_KEY');

			expect(existing).toHaveLength(2);
			expect(result).toHaveLength(1);
		});

		it('handles empty array', () => {
			const result = removeSecret([], 'API_KEY');
			expect(result).toHaveLength(0);
		});
	});

	describe('parseSecretsContent', () => {
		it('parses valid secrets content', () => {
			const content = {
				type: 'secrets',
				secrets: [
					{ key: 'API_KEY', value: 'secret123' },
					{ key: 'DB_URL', value: 'postgres://localhost' },
				],
			};
			const result = parseSecretsContent(content);

			expect(result).toHaveLength(2);
			expect(result[0].key).toBe('API_KEY');
			expect(result[1].key).toBe('DB_URL');
		});

		it('returns empty array for wrong type', () => {
			const content = {
				type: 'project',
				name: 'my-project',
			};
			const result = parseSecretsContent(content);

			expect(result).toEqual([]);
		});

		it('returns empty array for null content', () => {
			const result = parseSecretsContent(null);
			expect(result).toEqual([]);
		});

		it('returns empty array for undefined content', () => {
			const result = parseSecretsContent(undefined);
			expect(result).toEqual([]);
		});

		it('returns empty array for non-object content', () => {
			expect(parseSecretsContent('string')).toEqual([]);
			expect(parseSecretsContent(123)).toEqual([]);
			expect(parseSecretsContent(true)).toEqual([]);
		});

		it('returns empty array when secrets array is missing', () => {
			const content = { type: 'secrets' };
			const result = parseSecretsContent(content);

			expect(result).toEqual([]);
		});

		it('handles empty secrets array', () => {
			const content = {
				type: 'secrets',
				secrets: [],
			};
			const result = parseSecretsContent(content);

			expect(result).toEqual([]);
		});
	});

	describe('calculateMissingSecrets', () => {
		it('returns empty array when all environments have same secrets', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', [{ key: 'API_KEY', value: 'dev-key' }]],
				['staging', [{ key: 'API_KEY', value: 'staging-key' }]],
				['prod', [{ key: 'API_KEY', value: 'prod-key' }]],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');
			expect(result).toHaveLength(0);
		});

		it('finds secrets missing from current environment', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', [{ key: 'API_KEY', value: 'dev-key' }]],
				[
					'staging',
					[
						{ key: 'API_KEY', value: 'staging-key' },
						{ key: 'DB_URL', value: 'staging-db' },
					],
				],
				[
					'prod',
					[
						{ key: 'API_KEY', value: 'prod-key' },
						{ key: 'DB_URL', value: 'prod-db' },
						{ key: 'REDIS_URL', value: 'prod-redis' },
					],
				],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');

			expect(result).toHaveLength(2);
			expect(result.map((m) => m.key)).toContain('DB_URL');
			expect(result.map((m) => m.key)).toContain('REDIS_URL');
		});

		it('tracks which environments have the missing secret', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', []],
				['staging', [{ key: 'API_KEY', value: 'staging-key' }]],
				['prod', [{ key: 'API_KEY', value: 'prod-key' }]],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');

			expect(result).toHaveLength(1);
			expect(result[0].key).toBe('API_KEY');
			expect(result[0].existsIn).toContain('staging');
			expect(result[0].existsIn).toContain('prod');
			expect(result[0].existsIn).toHaveLength(2);
		});

		it('returns empty array when current env has all secrets', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				[
					'dev',
					[
						{ key: 'API_KEY', value: 'dev-key' },
						{ key: 'DB_URL', value: 'dev-db' },
					],
				],
				['staging', [{ key: 'API_KEY', value: 'staging-key' }]],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');
			expect(result).toHaveLength(0);
		});

		it('returns empty array when current env is only environment', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', [{ key: 'API_KEY', value: 'dev-key' }]],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');
			expect(result).toHaveLength(0);
		});

		it('handles empty current environment', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', []],
				[
					'staging',
					[
						{ key: 'API_KEY', value: 'staging-key' },
						{ key: 'DB_URL', value: 'staging-db' },
					],
				],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');

			expect(result).toHaveLength(2);
			expect(result.map((m) => m.key)).toContain('API_KEY');
			expect(result.map((m) => m.key)).toContain('DB_URL');
		});

		it('handles missing current environment in map', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['staging', [{ key: 'API_KEY', value: 'staging-key' }]],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');

			expect(result).toHaveLength(1);
			expect(result[0].key).toBe('API_KEY');
			expect(result[0].existsIn).toEqual(['staging']);
		});

		it('sorts results alphabetically by key', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', []],
				[
					'staging',
					[
						{ key: 'ZEBRA', value: 'z' },
						{ key: 'ALPHA', value: 'a' },
						{ key: 'MIDDLE', value: 'm' },
					],
				],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');

			expect(result).toHaveLength(3);
			expect(result[0].key).toBe('ALPHA');
			expect(result[1].key).toBe('MIDDLE');
			expect(result[2].key).toBe('ZEBRA');
		});

		it('does not include secrets already in current environment', () => {
			const allEnvSecrets = new Map<string, Secret[]>([
				['dev', [{ key: 'SHARED', value: 'dev-shared' }]],
				[
					'staging',
					[
						{ key: 'SHARED', value: 'staging-shared' },
						{ key: 'STAGING_ONLY', value: 'staging' },
					],
				],
				[
					'prod',
					[
						{ key: 'SHARED', value: 'prod-shared' },
						{ key: 'PROD_ONLY', value: 'prod' },
					],
				],
			]);

			const result = calculateMissingSecrets(allEnvSecrets, 'dev');

			expect(result).toHaveLength(2);
			expect(result.map((m) => m.key)).not.toContain('SHARED');
			expect(result.map((m) => m.key)).toContain('STAGING_ONLY');
			expect(result.map((m) => m.key)).toContain('PROD_ONLY');
		});

		it('handles empty map', () => {
			const allEnvSecrets = new Map<string, Secret[]>();
			const result = calculateMissingSecrets(allEnvSecrets, 'dev');
			expect(result).toHaveLength(0);
		});
	});
});
