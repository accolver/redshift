/**
 * Redshift Nostr event kind (NIP-78 application-specific data)
 */
export const REDSHIFT_KIND = 30078;

/**
 * Generate the d-tag for a secrets event
 * Format: <project_id>|<environment_slug>
 */
export function getSecretsDTag(projectId: string, environmentSlug: string): string {
	return `${projectId}|${environmentSlug}`;
}

/**
 * Generate the d-tag for a project event
 * Format: <project_id>
 */
export function getProjectDTag(projectId: string): string {
	return projectId;
}

/**
 * Parse a d-tag to extract project and environment info
 */
export function parseDTag(dTag: string): { projectId: string; environmentSlug?: string } {
	const parts = dTag.split('|');
	return {
		projectId: parts[0],
		environmentSlug: parts[1],
	};
}
