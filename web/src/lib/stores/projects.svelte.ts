import { NostrKinds } from '$lib/crypto';
import {
	ProjectsModel,
	createEnvironment,
	createProjectContent,
	generateProjectId,
	normalizeSlug,
	removeEnvironmentFromProject,
	validateSlug,
} from '$lib/models/project';
import type { Environment, Project, ProjectsState } from '$lib/types/nostr';
import type { Subscription } from 'rxjs';
import { getAuthState, signEvent } from './auth.svelte';
import { REDSHIFT_KIND, eventStore, getProjectDTag, publishEvent } from './nostr.svelte';

/**
 * Projects store using Svelte 5 Runes + Applesauce EventStore
 *
 * This store follows the Applesauce paradigm:
 * - EventStore is the single source of truth for Nostr events
 * - Components subscribe to reactive observables
 * - Publishing creates events that flow through the EventStore
 */

// Projects state using $state rune
let projectsState = $state<ProjectsState>({
	projects: [],
	isLoading: false,
	error: null,
});

// Track active subscription
let subscription: Subscription | null = null;

/**
 * Get current projects state (reactive)
 */
export function getProjectsState(): ProjectsState {
	return projectsState;
}

/**
 * Get a project by ID
 */
export function getProjectById(id: string): Project | undefined {
	return projectsState.projects.find((p) => p.id === id);
}

/**
 * Subscribe to projects for the authenticated user
 * This connects the Applesauce EventStore to Svelte reactive state
 */
export function subscribeToProjects(): void {
	const auth = getAuthState();

	// Clean up existing subscription
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}

	if (!auth.isConnected || !auth.pubkey) {
		projectsState.projects = [];
		return;
	}

	projectsState.isLoading = true;

	// Subscribe to ProjectsModel from EventStore
	subscription = ProjectsModel(eventStore, auth.pubkey).subscribe({
		next: (projects) => {
			projectsState.projects = projects;
			projectsState.isLoading = false;
			projectsState.error = null;
		},
		error: (err) => {
			projectsState.error = err instanceof Error ? err.message : 'Failed to load projects';
			projectsState.isLoading = false;
		},
	});
}

/**
 * Unsubscribe from projects
 */
export function unsubscribeFromProjects(): void {
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}
}

/**
 * Create a new project
 * This creates a Nostr event and publishes it to relays
 *
 * @param slug - Immutable identifier (lowercase, hyphens only)
 * @param displayName - Human-readable display name
 */
export async function createProject(slug: string, displayName: string): Promise<Project> {
	const normalizedSlug = normalizeSlug(slug);
	const trimmedDisplayName = displayName.trim();

	// Validate slug
	const slugError = validateSlug(normalizedSlug);
	if (slugError) {
		throw new Error(slugError);
	}

	if (!trimmedDisplayName) {
		throw new Error('Display name is required');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to create a project');
	}

	// Check for duplicate slug
	const existingProject = projectsState.projects.find((p) => p.slug === normalizedSlug);
	if (existingProject) {
		throw new Error(`A project with slug "${normalizedSlug}" already exists`);
	}

	const projectId = generateProjectId();
	const content = createProjectContent(normalizedSlug, trimmedDisplayName);

	// Create the unsigned event
	const unsignedEvent = {
		kind: REDSHIFT_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['d', getProjectDTag(projectId)]],
		content: JSON.stringify(content),
	};

	// Sign the event using the current auth method (NIP-07 or local nsec)
	const signedEvent = await signEvent(unsignedEvent);

	// Publish to relays (also adds to local EventStore)
	await publishEvent(signedEvent);

	// Return the project object
	const project: Project = {
		id: projectId,
		slug: normalizedSlug,
		displayName: trimmedDisplayName,
		createdAt: content.createdAt!,
		environments: [],
	};

	return project;
}

/**
 * Delete a project
 * This publishes a NIP-09 deletion event and a tombstone (empty replaceable event)
 * to ensure the project is removed from relays and doesn't reappear on sync.
 */
export async function deleteProject(id: string): Promise<void> {
	const project = getProjectById(id);

	if (!project) {
		throw new Error('Project not found');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to delete a project');
	}

	const dTag = getProjectDTag(id);

	// Step 1: Publish a tombstone - an empty replaceable event to the same d-tag.
	// This overwrites the existing project event on relays that support NIP-33
	// (parameterized replaceable events), effectively clearing the project data.
	const tombstoneEvent = {
		kind: REDSHIFT_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['d', dTag],
			['deleted', 'true'],
		],
		content: JSON.stringify({ type: 'project', deleted: true }),
	};

	const signedTombstone = await signEvent(tombstoneEvent);
	await publishEvent(signedTombstone);

	// Step 2: Publish a NIP-09 deletion event (kind 5) referencing the project's
	// address tag. This signals to relays that the event should be deleted.
	const deletionEvent = {
		kind: NostrKinds.DELETION,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['a', `${REDSHIFT_KIND}:${auth.pubkey}:${dTag}`],
			['k', String(REDSHIFT_KIND)],
		],
		content: 'Project deleted',
	};

	const signedDeletion = await signEvent(deletionEvent);
	await publishEvent(signedDeletion);

	// Step 3: Remove from local state
	projectsState.projects = projectsState.projects.filter((p) => p.id !== id);
}

/**
 * Update a project
 * Note: Only displayName can be updated. Slug is immutable.
 */
export async function updateProject(
	id: string,
	updates: Partial<Pick<Project, 'displayName'>>,
): Promise<Project> {
	const project = getProjectById(id);

	if (!project) {
		throw new Error('Project not found');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to update a project');
	}

	// Create updated content (slug is immutable)
	const content = {
		type: 'project' as const,
		slug: project.slug,
		displayName: updates.displayName?.trim() ?? project.displayName,
		environments: project.environments,
		createdAt: project.createdAt,
	};

	// Create the unsigned event with same d-tag (replaceable)
	const unsignedEvent = {
		kind: REDSHIFT_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['d', getProjectDTag(id)]],
		content: JSON.stringify(content),
	};

	// Sign and publish using the current auth method
	const signedEvent = await signEvent(unsignedEvent);
	await publishEvent(signedEvent);

	// Return updated project
	return {
		...project,
		displayName: content.displayName,
	};
}

/**
 * Add a new environment to a project
 */
export async function addEnvironment(
	projectId: string,
	slug: string,
	name: string,
): Promise<Environment> {
	const project = getProjectById(projectId);

	if (!project) {
		throw new Error('Project not found');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to add an environment');
	}

	const trimmedSlug = slug
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-');
	const trimmedName = name.trim();

	if (!trimmedSlug) {
		throw new Error('Environment slug is required');
	}

	if (!trimmedName) {
		throw new Error('Environment name is required');
	}

	// Check for duplicate slug
	if (project.environments.some((e) => e.slug === trimmedSlug)) {
		throw new Error(`Environment "${trimmedSlug}" already exists`);
	}

	// Create new environment
	const newEnv = createEnvironment(trimmedSlug, trimmedName);

	// Create updated content with new environment
	const content = {
		type: 'project' as const,
		slug: project.slug,
		displayName: project.displayName,
		environments: [...project.environments, newEnv],
		createdAt: project.createdAt,
	};

	// Create the unsigned event with same d-tag (replaceable)
	const unsignedEvent = {
		kind: REDSHIFT_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['d', getProjectDTag(projectId)]],
		content: JSON.stringify(content),
	};

	// Sign and publish using the current auth method
	const signedEvent = await signEvent(unsignedEvent);
	await publishEvent(signedEvent);

	return newEnv;
}

/**
 * Delete an environment from a project
 */
export async function deleteEnvironment(projectId: string, slug: string): Promise<void> {
	const project = getProjectById(projectId);

	if (!project) {
		throw new Error('Project not found');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to delete an environment');
	}

	// Use the model function to get updated project (validates constraints)
	const updatedProject = removeEnvironmentFromProject(project, slug);

	// Create updated content
	const content = {
		type: 'project' as const,
		slug: updatedProject.slug,
		displayName: updatedProject.displayName,
		environments: updatedProject.environments,
		createdAt: updatedProject.createdAt,
	};

	// Create the unsigned event with same d-tag (replaceable)
	const unsignedEvent = {
		kind: REDSHIFT_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['d', getProjectDTag(projectId)]],
		content: JSON.stringify(content),
	};

	// Sign and publish using the current auth method
	const signedEvent = await signEvent(unsignedEvent);
	await publishEvent(signedEvent);
}

/**
 * Reset the store (useful for testing and logout)
 */
export function resetProjectsStore(): void {
	unsubscribeFromProjects();
	projectsState = {
		projects: [],
		isLoading: false,
		error: null,
	};
}
