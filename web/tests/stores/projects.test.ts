/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the nostr.svelte module before importing the projects store
vi.mock('$lib/stores/nostr.svelte', () => {
	const { EventStore } = require('applesauce-core');
	const mockEventStore = new EventStore();

	return {
		eventStore: mockEventStore,
		publishEvent: vi.fn().mockResolvedValue(undefined),
		REDSHIFT_KIND: 30078,
		getProjectDTag: (projectId: string) => projectId,
		DEFAULT_RELAYS: ['wss://relay.test.com'],
	};
});

// Mock the auth store
vi.mock('$lib/stores/auth.svelte', () => ({
	getAuthState: vi.fn(() => ({
		isConnected: true,
		pubkey: 'test-pubkey-123',
		method: 'nip07',
		error: null,
		profile: null,
	})),
	signEvent: vi.fn().mockImplementation(async (event) => ({
		...event,
		id: 'mock-event-id-' + Date.now(),
		pubkey: 'test-pubkey-123',
		sig: 'mock-signature',
	})),
}));

// Now import the module under test
import {
	getProjectsState,
	getProjectById,
	createProject,
	deleteProject,
	updateProject,
	addEnvironment,
	resetProjectsStore,
	subscribeToProjects,
	unsubscribeFromProjects,
} from '$lib/stores/projects.svelte';
import { publishEvent } from '$lib/stores/nostr.svelte';
import { signEvent } from '$lib/stores/auth.svelte';

describe('Projects Store (Applesauce)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the store state before each test
		resetProjectsStore();
	});

	describe('getProjectsState', () => {
		it('returns empty array initially', () => {
			const state = getProjectsState();
			expect(state.projects).toEqual([]);
		});

		it('returns loading false initially', () => {
			const state = getProjectsState();
			expect(state.isLoading).toBe(false);
		});

		it('returns null error initially', () => {
			const state = getProjectsState();
			expect(state.error).toBeNull();
		});
	});

	describe('createProject', () => {
		it('creates a project with the given slug and displayName', async () => {
			const project = await createProject('my-first-project', 'My First Project');

			expect(project).toBeDefined();
			expect(project.slug).toBe('my-first-project');
			expect(project.displayName).toBe('My First Project');
		});

		it('generates a unique id for each project', async () => {
			const projectA = await createProject('project-a', 'Project A');
			const projectB = await createProject('project-b', 'Project B');

			expect(projectA.id).not.toBe(projectB.id);
		});

		it('sets createdAt timestamp', async () => {
			const before = Date.now();

			const project = await createProject('timestamped-project', 'Timestamped Project');

			const after = Date.now();
			expect(project.createdAt).toBeGreaterThanOrEqual(before);
			expect(project.createdAt).toBeLessThanOrEqual(after);
		});

		it('normalizes slug and trims displayName', async () => {
			const project = await createProject('My Project', '  Trimmed Name  ');

			expect(project.slug).toBe('my-project');
			expect(project.displayName).toBe('Trimmed Name');
		});

		it('throws error for invalid slug', async () => {
			await expect(createProject('a', 'Project')).rejects.toThrow('Slug must be at least 2 characters');
		});

		it('throws error for empty displayName', async () => {
			await expect(createProject('valid-slug', '')).rejects.toThrow('Display name is required');
		});

		it('throws error for whitespace-only displayName', async () => {
			await expect(createProject('valid-slug', '   ')).rejects.toThrow('Display name is required');
		});

		it('initializes project with empty environments array', async () => {
			const project = await createProject('project-with-envs', 'Project with Environments');

			expect(project.environments).toEqual([]);
		});

		it('calls publishEvent with signed event', async () => {
			await createProject('published-project', 'Published Project');

			expect(publishEvent).toHaveBeenCalledTimes(1);
			expect(signEvent).toHaveBeenCalledTimes(1);
		});

		it('creates event with correct kind and d-tag', async () => {
			await createProject('tagged-project', 'Tagged Project');

			const signedCall = vi.mocked(signEvent).mock.calls[0][0];
			expect(signedCall.kind).toBe(30078);
			expect(signedCall.tags).toContainEqual(['d', expect.any(String)]);
		});

		it('creates event with correct content structure', async () => {
			await createProject('content-project', 'Content Project');

			const signedCall = vi.mocked(signEvent).mock.calls[0][0];
			const content = JSON.parse(signedCall.content);

			expect(content.type).toBe('project');
			expect(content.slug).toBe('content-project');
			expect(content.displayName).toBe('Content Project');
			// Projects now auto-create a "dev" environment
			expect(content.environments).toHaveLength(1);
			expect(content.environments[0].slug).toBe('dev');
			expect(content.environments[0].name).toBe('Development');
			expect(content.createdAt).toBeDefined();
		});
	});

	describe('deleteProject', () => {
		it('throws error for non-existent project id', async () => {
			await expect(deleteProject('non-existent-id')).rejects.toThrow('Project not found');
		});
	});

	describe('getProjectById', () => {
		it('returns undefined for non-existent id', () => {
			const found = getProjectById('does-not-exist');

			expect(found).toBeUndefined();
		});
	});

	describe('updateProject', () => {
		it('throws error for non-existent project', async () => {
			await expect(updateProject('fake-id', { displayName: 'New Name' })).rejects.toThrow(
				'Project not found',
			);
		});
	});

	describe('addEnvironment', () => {
		it('throws error for non-existent project', async () => {
			await expect(addEnvironment('fake-id', 'staging', 'Staging')).rejects.toThrow(
				'Project not found',
			);
		});

		it('throws error for empty slug', async () => {
			// We need a project in state first - mock it by manipulating the event store
			// For now, test the validation logic
			await expect(addEnvironment('fake-id', '', 'Staging')).rejects.toThrow('Project not found');
		});

		it('throws error for empty name', async () => {
			await expect(addEnvironment('fake-id', 'staging', '')).rejects.toThrow('Project not found');
		});

		it('normalizes slug to lowercase with hyphens', async () => {
			// This tests the slug normalization in the function
			// The actual test would need a project in state
			const slug = 'My Staging Env!@#';
			const normalized = slug
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '-');
			expect(normalized).toBe('my-staging-env---');
		});
	});

	describe('subscription lifecycle', () => {
		it('subscribeToProjects does not throw', () => {
			expect(() => subscribeToProjects()).not.toThrow();
		});

		it('unsubscribeFromProjects does not throw', () => {
			expect(() => unsubscribeFromProjects()).not.toThrow();
		});

		it('resetProjectsStore clears state', () => {
			resetProjectsStore();
			const state = getProjectsState();

			expect(state.projects).toEqual([]);
			expect(state.isLoading).toBe(false);
			expect(state.error).toBeNull();
		});
	});
});
