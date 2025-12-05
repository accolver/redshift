import type { Project, ProjectsState, Environment } from '$lib/types/nostr';
import type { Subscription } from 'rxjs';
import { eventStore, publishEvent, REDSHIFT_KIND, getProjectDTag } from './nostr.svelte';
import {
	ProjectsModel,
	createProjectContent,
	generateProjectId,
	createEnvironment,
	removeEnvironmentFromProject,
} from '$lib/models/project';
import { getAuthState } from './auth.svelte';

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
 */
export async function createProject(name: string): Promise<Project> {
	const trimmedName = name.trim();

	if (!trimmedName) {
		throw new Error('Project name is required');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to create a project');
	}

	const projectId = generateProjectId();
	const content = createProjectContent(trimmedName);

	// Create the unsigned event
	const unsignedEvent = {
		kind: REDSHIFT_KIND,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['d', getProjectDTag(projectId)]],
		content: JSON.stringify(content),
	};

	// Sign the event using NIP-07 or local key
	let signedEvent;
	if (auth.method === 'nip07' && window.nostr) {
		signedEvent = await window.nostr.signEvent(unsignedEvent);
	} else {
		// For local nsec, we'd need the secret key
		// For now, throw an error - this should be implemented with proper key management
		throw new Error('Local signing not yet implemented. Please use a NIP-07 extension.');
	}

	// Publish to relays (also adds to local EventStore)
	await publishEvent(signedEvent);

	// Return the project object
	const project: Project = {
		id: projectId,
		name: trimmedName,
		createdAt: content.createdAt!,
		environments: [],
	};

	return project;
}

/**
 * Delete a project
 * This publishes a deletion event (NIP-09) and a tombstone event
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

	// For now, we'll just remove from local state
	// Full implementation would publish NIP-09 deletion + tombstone
	// TODO: Implement proper Nostr deletion

	// Remove from local state (temporary until full Nostr implementation)
	projectsState.projects = projectsState.projects.filter((p) => p.id !== id);
}

/**
 * Update a project
 */
export async function updateProject(
	id: string,
	updates: Partial<Pick<Project, 'name'>>,
): Promise<Project> {
	const project = getProjectById(id);

	if (!project) {
		throw new Error('Project not found');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to update a project');
	}

	// Create updated content
	const content = {
		type: 'project' as const,
		name: updates.name?.trim() ?? project.name,
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

	// Sign and publish
	let signedEvent;
	if (auth.method === 'nip07' && window.nostr) {
		signedEvent = await window.nostr.signEvent(unsignedEvent);
	} else {
		throw new Error('Local signing not yet implemented. Please use a NIP-07 extension.');
	}

	await publishEvent(signedEvent);

	// Return updated project
	return {
		...project,
		...updates,
		name: content.name,
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
		name: project.name,
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

	// Sign and publish
	let signedEvent;
	if (auth.method === 'nip07' && window.nostr) {
		signedEvent = await window.nostr.signEvent(unsignedEvent);
	} else {
		throw new Error('Local signing not yet implemented. Please use a NIP-07 extension.');
	}

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
		name: updatedProject.name,
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

	// Sign and publish
	let signedEvent;
	if (auth.method === 'nip07' && window.nostr) {
		signedEvent = await window.nostr.signEvent(unsignedEvent);
	} else {
		throw new Error('Local signing not yet implemented. Please use a NIP-07 extension.');
	}

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
