import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { REDSHIFT_KIND } from '$lib/stores/nostr.svelte';
import type { Project, Environment } from '$lib/types/nostr';

/**
 * Project metadata stored in Kind 30078 event content
 */
interface ProjectEventContent {
	type: 'project';
	/** Immutable slug identifier (lowercase, hyphens only) */
	slug: string;
	/** Human-readable display name */
	displayName: string;
	environments?: Environment[];
	createdAt?: number;
}

/**
 * Parse a Nostr event into a Project object
 */
function parseProjectEvent(event: NostrEvent): Project | null {
	try {
		const content = JSON.parse(event.content) as ProjectEventContent;

		// Only parse project-type events
		if (content.type !== 'project') {
			return null;
		}

		// Get the d-tag (project ID)
		const dTag = event.tags.find((t) => t[0] === 'd')?.[1];
		if (!dTag) return null;

		// Require slug and displayName
		if (!content.slug || !content.displayName) {
			return null;
		}

		return {
			id: dTag,
			slug: content.slug,
			displayName: content.displayName,
			createdAt: content.createdAt ?? event.created_at * 1000,
			environments: content.environments ?? [],
		};
	} catch {
		return null;
	}
}

/**
 * ProjectsModel - Returns all projects for a given pubkey
 *
 * This model subscribes to the EventStore timeline and filters for
 * Kind 30078 events that represent projects (type: 'project' in content)
 */
export function ProjectsModel(eventStore: EventStore, pubkey: string): Observable<Project[]> {
	return eventStore
		.timeline({
			kinds: [REDSHIFT_KIND],
			authors: [pubkey],
		})
		.pipe(
			map((events) => {
				const projects: Project[] = [];

				for (const event of events) {
					const project = parseProjectEvent(event);
					if (project) {
						projects.push(project);
					}
				}

				// Sort by creation date (newest first)
				return projects.sort((a, b) => b.createdAt - a.createdAt);
			}),
		);
}

/**
 * SingleProjectModel - Returns a single project by ID
 */
export function SingleProjectModel(
	eventStore: EventStore,
	pubkey: string,
	projectId: string,
): Observable<Project | undefined> {
	return eventStore
		.replaceable(REDSHIFT_KIND, pubkey, projectId)
		.pipe(map((event) => (event ? (parseProjectEvent(event) ?? undefined) : undefined)));
}

/**
 * Create a default "dev" environment
 */
export function createDefaultEnvironment(): Environment {
	return {
		id: crypto.randomUUID().split('-')[0],
		slug: 'dev',
		name: 'Development',
		createdAt: Date.now(),
	};
}

/**
 * Validate and normalize a project slug
 * - Lowercase only
 * - Hyphens allowed (no underscores, spaces, etc.)
 * - No leading/trailing hyphens
 * - No consecutive hyphens
 */
export function normalizeSlug(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Validate a project slug
 * Returns error message if invalid, null if valid
 */
export function validateSlug(slug: string): string | null {
	if (!slug) {
		return 'Slug is required';
	}
	if (slug.length < 2) {
		return 'Slug must be at least 2 characters';
	}
	if (slug.length > 50) {
		return 'Slug must be 50 characters or less';
	}
	if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
		return 'Slug must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens';
	}
	if (/--/.test(slug)) {
		return 'Slug cannot contain consecutive hyphens';
	}
	return null;
}

/**
 * Create a project event content object with default "dev" environment
 */
export function createProjectContent(slug: string, displayName: string): ProjectEventContent {
	return {
		type: 'project',
		slug: normalizeSlug(slug),
		displayName: displayName.trim(),
		environments: [createDefaultEnvironment()],
		createdAt: Date.now(),
	};
}

/**
 * Generate a unique project ID
 */
export function generateProjectId(): string {
	return crypto.randomUUID().split('-')[0]; // Use first segment for shorter IDs
}

/**
 * Create a new environment
 */
export function createEnvironment(slug: string, name: string): Environment {
	return {
		id: crypto.randomUUID().split('-')[0],
		slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
		name: name.trim(),
		createdAt: Date.now(),
	};
}

/**
 * Remove an environment from a project by slug
 * Returns a new project object (immutable)
 * Throws error if trying to remove the last environment
 */
export function removeEnvironmentFromProject(project: Project, slug: string): Project {
	// Prevent removing the last environment
	if (project.environments.length <= 1) {
		throw new Error(
			'Cannot delete the last environment. A project must have at least one environment.',
		);
	}

	return {
		...project,
		environments: project.environments.filter((env) => env.slug !== slug),
	};
}
