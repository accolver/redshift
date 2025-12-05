<script lang="ts">
import { Input } from '$lib/components/ui/input';
import { Dialog, DialogContent } from '$lib/components/ui/dialog';
import { Search, Key, Folder, ArrowRight, LoaderCircle } from '@lucide/svelte';
import { getProjectsState } from '$lib/stores/projects.svelte';
import { getAuthState } from '$lib/stores/auth.svelte';
import { eventStore, REDSHIFT_KIND, parseDTag } from '$lib/stores/nostr.svelte';
import type { Secret, Project } from '$lib/types/nostr';
import { goto } from '$app/navigation';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

let searchQuery = $state('');
let isSearching = $state(false);

const auth = $derived(getAuthState());
const projectsState = $derived(getProjectsState());

// Search results structure
interface SearchResult {
	type: 'secret' | 'project';
	project: Project;
	environment?: { slug: string; name: string };
	secret?: Secret;
	matchedText: string;
}

// Get all secrets from all projects/environments
const allSecrets = $derived(() => {
	if (!auth.isConnected || !auth.pubkey) return [];

	const results: SearchResult[] = [];

	// Add projects as searchable items
	for (const project of projectsState.projects) {
		results.push({
			type: 'project',
			project,
			matchedText: project.name,
		});
	}

	// We'd need to load secrets for each environment
	// For now, search across cached events in the EventStore
	// This is a simplified approach - a full implementation would query secrets

	return results;
});

// Filter results based on search query
const searchResults = $derived(() => {
	if (!searchQuery.trim()) return [];

	const query = searchQuery.toLowerCase();
	const results: SearchResult[] = [];

	// Search projects
	for (const project of projectsState.projects) {
		if (project.name.toLowerCase().includes(query)) {
			results.push({
				type: 'project',
				project,
				matchedText: project.name,
			});
		}

		// Search environment names
		for (const env of project.environments) {
			if (env.name.toLowerCase().includes(query) || env.slug.toLowerCase().includes(query)) {
				results.push({
					type: 'project',
					project,
					environment: env,
					matchedText: `${project.name} / ${env.name}`,
				});
			}
		}
	}

	return results.slice(0, 10); // Limit results
});

function handleSelect(result: SearchResult) {
	if (result.type === 'project') {
		if (result.environment) {
			goto(`/admin/projects/${result.project.id}?env=${result.environment.slug}`);
		} else {
			goto(`/admin/projects/${result.project.id}`);
		}
	}
	searchQuery = '';
	onOpenChange(false);
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		onOpenChange(false);
	}
}
</script>

<Dialog bind:open onOpenChange={(v) => { onOpenChange(v); if (!v) searchQuery = ''; }}>
	<DialogContent class="gap-0 p-0 sm:max-w-lg">
		<!-- Search Input -->
		<div class="flex items-center border-b border-border px-3">
			<Search class="size-4 text-muted-foreground" />
			<input
				type="text"
				placeholder="Search projects and environments..."
				class="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-muted-foreground"
				bind:value={searchQuery}
				onkeydown={handleKeydown}
				autofocus
			/>
			{#if isSearching}
				<LoaderCircle class="size-4 animate-spin text-muted-foreground" />
			{/if}
		</div>

		<!-- Results -->
		<div class="max-h-80 overflow-y-auto">
			{#if searchQuery.trim() && searchResults().length === 0}
				<div class="px-4 py-8 text-center text-sm text-muted-foreground">
					No results found for "{searchQuery}"
				</div>
			{:else if searchResults().length > 0}
				<div class="p-2">
					{#each searchResults() as result}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
							onclick={() => handleSelect(result)}
						>
							<div class="flex size-8 items-center justify-center rounded-md bg-muted">
								{#if result.type === 'project'}
									<Folder class="size-4 text-muted-foreground" />
								{:else}
									<Key class="size-4 text-muted-foreground" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="truncate text-sm font-medium">{result.matchedText}</p>
								{#if result.environment}
									<p class="text-xs text-muted-foreground">Environment</p>
								{:else if result.type === 'project'}
									<p class="text-xs text-muted-foreground">Project</p>
								{/if}
							</div>
							<ArrowRight class="size-4 text-muted-foreground" />
						</button>
					{/each}
				</div>
			{:else if !searchQuery.trim()}
				<div class="p-4">
					<p class="mb-3 text-xs font-medium text-muted-foreground">RECENT PROJECTS</p>
					{#if projectsState.projects.length === 0}
						<p class="text-sm text-muted-foreground">No projects yet</p>
					{:else}
						{#each projectsState.projects.slice(0, 5) as project}
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
								onclick={() => handleSelect({ type: 'project', project, matchedText: project.name })}
							>
								<Folder class="size-4 text-muted-foreground" />
								<span class="text-sm">{project.name}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
			<div class="flex items-center gap-4">
				<span><kbd class="rounded border border-border bg-muted px-1.5 py-0.5">↑↓</kbd> Navigate</span>
				<span><kbd class="rounded border border-border bg-muted px-1.5 py-0.5">↵</kbd> Select</span>
			</div>
			<span><kbd class="rounded border border-border bg-muted px-1.5 py-0.5">Esc</kbd> Close</span>
		</div>
	</DialogContent>
</Dialog>
