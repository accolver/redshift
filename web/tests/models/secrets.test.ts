import { describe, it, expect } from 'vitest';
import { createSecretsContent, upsertSecret, removeSecret } from '$lib/models/secrets';
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
});
