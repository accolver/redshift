import { describe, it, expect } from 'vitest';
import {
	createDefaultEnvironment,
	createEnvironment,
	createProjectContent,
	generateProjectId,
} from '$lib/models/project';

describe('Project Model', () => {
	describe('generateProjectId', () => {
		it('generates a short ID (first segment of UUID)', () => {
			const id = generateProjectId();
			// Should be 8 characters (first segment of UUID)
			expect(id).toMatch(/^[a-f0-9]{8}$/);
		});

		it('generates unique IDs on each call', () => {
			const id1 = generateProjectId();
			const id2 = generateProjectId();

			expect(id1).not.toBe(id2);
		});
	});

	describe('createDefaultEnvironment', () => {
		it('creates environment with slug "dev"', () => {
			const env = createDefaultEnvironment();
			expect(env.slug).toBe('dev');
		});

		it('creates environment with name "Development"', () => {
			const env = createDefaultEnvironment();
			expect(env.name).toBe('Development');
		});

		it('creates environment with a valid id', () => {
			const env = createDefaultEnvironment();
			expect(env.id).toMatch(/^[a-f0-9]{8}$/);
		});

		it('creates environment with createdAt timestamp', () => {
			const before = Date.now();
			const env = createDefaultEnvironment();
			const after = Date.now();

			expect(env.createdAt).toBeGreaterThanOrEqual(before);
			expect(env.createdAt).toBeLessThanOrEqual(after);
		});
	});

	describe('createEnvironment', () => {
		it('creates environment with given slug and name', () => {
			const env = createEnvironment('staging', 'Staging');

			expect(env.slug).toBe('staging');
			expect(env.name).toBe('Staging');
		});

		it('normalizes slug to lowercase', () => {
			const env = createEnvironment('PRODUCTION', 'Production');
			expect(env.slug).toBe('production');
		});

		it('replaces invalid characters in slug with hyphens', () => {
			const env = createEnvironment('my env!@#', 'My Environment');
			expect(env.slug).toBe('my-env---');
		});

		it('trims whitespace from name', () => {
			const env = createEnvironment('test', '  Test Environment  ');
			expect(env.name).toBe('Test Environment');
		});

		it('creates environment with unique id', () => {
			const env = createEnvironment('prod', 'Production');
			expect(env.id).toBeDefined();
			expect(typeof env.id).toBe('string');
		});

		it('creates environment with createdAt timestamp', () => {
			const before = Date.now();
			const env = createEnvironment('prod', 'Production');
			const after = Date.now();

			expect(env.createdAt).toBeGreaterThanOrEqual(before);
			expect(env.createdAt).toBeLessThanOrEqual(after);
		});
	});

	describe('createProjectContent', () => {
		it('creates content with type "project"', () => {
			const content = createProjectContent('My Project');
			expect(content.type).toBe('project');
		});

		it('creates content with given name', () => {
			const content = createProjectContent('My Project');
			expect(content.name).toBe('My Project');
		});

		it('trims whitespace from name', () => {
			const content = createProjectContent('  My Project  ');
			expect(content.name).toBe('My Project');
		});

		it('creates content with default "dev" environment', () => {
			const content = createProjectContent('My Project');

			expect(content.environments).toBeDefined();
			expect(content.environments).toHaveLength(1);
			expect(content.environments![0].slug).toBe('dev');
			expect(content.environments![0].name).toBe('Development');
		});

		it('creates content with createdAt timestamp', () => {
			const before = Date.now();
			const content = createProjectContent('My Project');
			const after = Date.now();

			expect(content.createdAt).toBeGreaterThanOrEqual(before);
			expect(content.createdAt).toBeLessThanOrEqual(after);
		});
	});
});
