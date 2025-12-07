import { describe, it, expect } from 'vitest';
import {
	createDefaultEnvironment,
	createEnvironment,
	createProjectContent,
	generateProjectId,
	removeEnvironmentFromProject,
	normalizeSlug,
	validateSlug,
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

	describe('normalizeSlug', () => {
		it('converts to lowercase', () => {
			expect(normalizeSlug('MyProject')).toBe('myproject');
		});

		it('replaces spaces with hyphens', () => {
			expect(normalizeSlug('my project')).toBe('my-project');
		});

		it('replaces underscores with hyphens', () => {
			expect(normalizeSlug('my_project')).toBe('my-project');
		});

		it('removes special characters', () => {
			expect(normalizeSlug('my@project!')).toBe('my-project');
		});

		it('collapses multiple hyphens', () => {
			expect(normalizeSlug('my--project')).toBe('my-project');
		});

		it('removes leading and trailing hyphens', () => {
			expect(normalizeSlug('-my-project-')).toBe('my-project');
		});
	});

	describe('validateSlug', () => {
		it('returns null for valid slugs', () => {
			expect(validateSlug('my-project')).toBeNull();
			expect(validateSlug('project123')).toBeNull();
			expect(validateSlug('ab')).toBeNull();
		});

		it('returns error for empty slug', () => {
			expect(validateSlug('')).toBe('Slug is required');
		});

		it('returns error for slug too short', () => {
			expect(validateSlug('a')).toBe('Slug must be at least 2 characters');
		});

		it('returns error for slug too long', () => {
			const longSlug = 'a'.repeat(51);
			expect(validateSlug(longSlug)).toBe('Slug must be 50 characters or less');
		});

		it('returns error for consecutive hyphens', () => {
			expect(validateSlug('my--project')).toBe('Slug cannot contain consecutive hyphens');
		});
	});

	describe('createProjectContent', () => {
		it('creates content with type "project"', () => {
			const content = createProjectContent('my-project', 'My Project');
			expect(content.type).toBe('project');
		});

		it('creates content with given slug and displayName', () => {
			const content = createProjectContent('my-project', 'My Project');
			expect(content.slug).toBe('my-project');
			expect(content.displayName).toBe('My Project');
		});

		it('normalizes slug', () => {
			const content = createProjectContent('My Project', 'My Project');
			expect(content.slug).toBe('my-project');
		});

		it('trims whitespace from displayName', () => {
			const content = createProjectContent('my-project', '  My Project  ');
			expect(content.displayName).toBe('My Project');
		});

		it('creates content with default "dev" environment', () => {
			const content = createProjectContent('my-project', 'My Project');

			expect(content.environments).toBeDefined();
			expect(content.environments).toHaveLength(1);
			expect(content.environments![0].slug).toBe('dev');
			expect(content.environments![0].name).toBe('Development');
		});

		it('creates content with createdAt timestamp', () => {
			const before = Date.now();
			const content = createProjectContent('my-project', 'My Project');
			const after = Date.now();

			expect(content.createdAt).toBeGreaterThanOrEqual(before);
			expect(content.createdAt).toBeLessThanOrEqual(after);
		});
	});

	describe('removeEnvironmentFromProject', () => {
		const createTestProject = (): Project => ({
			id: 'test-project',
			slug: 'test-project',
			displayName: 'Test Project',
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
			expect(result.slug).toBe(project.slug);
			expect(result.displayName).toBe(project.displayName);
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
				slug: 'test',
				displayName: 'Test',
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
				slug: 'test',
				displayName: 'Test',
				createdAt: Date.now(),
				environments: [],
			};

			expect(() => removeEnvironmentFromProject(project, 'dev')).toThrow(
				'Cannot delete the last environment',
			);
		});
	});
});
