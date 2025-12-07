<script lang="ts">
/**
 * Project page - redirects to first environment
 * 
 * Route: /admin/projects/[slug]
 * Redirects to: /admin/projects/[slug]/[first-env-slug]
 */
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import { LoaderCircle } from '@lucide/svelte';
import { getProjectsState } from '$lib/stores/projects.svelte';
import { isAuthRestorationAttempted } from '$lib/stores/auth.svelte';

const projectSlug = $derived(page.params.slug);
const projectsState = $derived(getProjectsState());
const project = $derived(projectsState.projects.find((p) => p.slug === projectSlug));

// Redirect to first environment when project loads
$effect(() => {
	if (project && project.environments.length > 0) {
		const firstEnv = project.environments[0];
		goto(`/admin/projects/${projectSlug}/${firstEnv.slug}`, { replaceState: true });
	}
});
</script>

<svelte:head>
	<title>{project?.displayName ?? 'Project'} - Redshift Admin</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center">
	{#if !isAuthRestorationAttempted() || projectsState.isLoading}
		<LoaderCircle class="size-8 animate-spin text-muted-foreground" />
	{:else if !project}
		<p class="text-muted-foreground">Project not found</p>
	{:else if project.environments.length === 0}
		<p class="text-muted-foreground">No environments found for this project</p>
	{:else}
		<!-- Redirecting... -->
		<LoaderCircle class="size-8 animate-spin text-muted-foreground" />
	{/if}
</div>
