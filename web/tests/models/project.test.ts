import { describe, it, expect } from 'vitest';
import {
	createDefaultEnvironment,
	createEnvironment,
	createProjectContent,
	generateProjectId,
	removeEnvironmentFromProject,
} from '$lib/models/project';
import type { Project } from '$lib/types/nostr';

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

	describe('removeEnvironmentFromProject', () => {
		const createTestProject = (): Project => ({
			id: 'test-project',
			name: 'Test Project',
			createdAt: Date.now(),
			environments: [
				{ id: 'env1', slug: 'dev', name: 'Development', createdAt: Date.now() },
				{ id: 'env2', slug: 'staging', name: 'Staging', createdAt: Date.now() },
				{ id: 'env3', slug: 'prod', name: 'Production', createdAt: Date.now() },
			],
		});

		it('removes environment by slug', () => {
			const project = createTestProject();
			const result = removeEnvironmentFromProject(project, 'staging');

			expect(result.environments).toHaveLength(2);
			expect(result.environments.map((e) => e.slug)).toEqual(['dev', 'prod']);
		});

		it('returns new project object (immutable)', () => {
			const project = createTestProject();
			const result = removeEnvironmentFromProject(project, 'staging');

			expect(result).not.toBe(project);
			expect(result.environments).not.toBe(project.environments);
		});

		it('preserves other project properties', () => {
			const project = createTestProject();
			const result = removeEnvironmentFromProject(project, 'staging');

			expect(result.id).toBe(project.id);
			expect(result.name).toBe(project.name);
			expect(result.createdAt).toBe(project.createdAt);
		});

		it('returns unchanged project if slug not found', () => {
			const project = createTestProject();
			const result = removeEnvironmentFromProject(project, 'nonexistent');

			expect(result.environments).toHaveLength(3);
		});

		it('throws error when trying to remove last environment', () => {
			const project: Project = {
				id: 'test',
				name: 'Test',
				createdAt: Date.now(),
				environments: [{ id: 'env1', slug: 'dev', name: 'Development', createdAt: Date.now() }],
			};

			expect(() => removeEnvironmentFromProject(project, 'dev')).toThrow(
				'Cannot delete the last environment',
			);
		});

		it('handles empty environments array gracefully', () => {
			const project: Project = {
				id: 'test',
				name: 'Test',
				createdAt: Date.now(),
				environments: [],
			};

			expect(() => removeEnvironmentFromProject(project, 'dev')).toThrow(
				'Cannot delete the last environment',
			);
		});
	});
});
