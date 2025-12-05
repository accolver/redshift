<script lang="ts">
import { Dialog, DialogContent } from '$lib/components/ui/dialog';
import { Search, Key, Folder, ArrowRight, LoaderCircle } from '@lucide/svelte';
import { getProjectsState } from '$lib/stores/projects.svelte';
import { getAuthState } from '$lib/stores/auth.svelte';
import { eventStore, REDSHIFT_KIND, getSecretsDTag } from '$lib/stores/nostr.svelte';
import { parseSecretsContent } from '$lib/models/secrets';
import type { Secret, Project, Environment } from '$lib/types/nostr';
import { goto } from '$app/navigation';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

let searchQuery = $state('');
let isSearching = $state(false);

// Cache of secrets per project/environment
let secretsCache = $state<Map<string, Secret[]>>(new Map());

const auth = $derived(getAuthState());
const projectsState = $derived(getProjectsState());

// Search results structure
interface SearchResult {
	type: 'secret' | 'project' | 'environment';
	project: Project;
	environment?: Environment;
	secret?: Secret;
	matchedText: string;
	subtitle?: string;
}

// Load secrets for all environments when search opens
$effect(() => {
	if (open && auth.isConnected && auth.pubkey) {
		loadAllSecrets();
	}
});

async function loadAllSecrets() {
	if (!auth.pubkey) return;

	isSearching = true;
	const newCache = new Map<string, Secret[]>();

	for (const project of projectsState.projects) {
		for (const env of project.environments) {
			const dTag = getSecretsDTag(project.id, env.slug);
			const cacheKey = `${project.id}/${env.slug}`;

			// Get event from EventStore
			const event = eventStore.getReplaceable(REDSHIFT_KIND, auth.pubkey, dTag);

			if (event?.content) {
				try {
					const content = JSON.parse(event.content);
					const secrets = parseSecretsContent(content);
					newCache.set(cacheKey, secrets);
				} catch {
					// Ignore parse errors
				}
			}
		}
	}

	secretsCache = newCache;
	isSearching = false;
}

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
				subtitle: 'Project',
			});
		}

		// Search environment names
		for (const env of project.environments) {
			if (env.name.toLowerCase().includes(query) || env.slug.toLowerCase().includes(query)) {
				results.push({
					type: 'environment',
					project,
					environment: env,
					matchedText: env.name,
					subtitle: project.name,
				});
			}

			// Search secret keys in this environment
			const cacheKey = `${project.id}/${env.slug}`;
			const secrets = secretsCache.get(cacheKey) ?? [];

			for (const secret of secrets) {
				if (secret.key.toLowerCase().includes(query)) {
					results.push({
						type: 'secret',
						project,
						environment: env,
						secret,
						matchedText: secret.key,
						subtitle: `${project.name} / ${env.name}`,
					});
				}
			}
		}
	}

	// Sort: exact matches first, then by type (secrets, projects, environments)
	results.sort((a, b) => {
		const aExact = a.matchedText.toLowerCase() === query;
		const bExact = b.matchedText.toLowerCase() === query;
		if (aExact && !bExact) return -1;
		if (!aExact && bExact) return 1;

		// Prioritize secrets over projects/environments
		const typeOrder = { secret: 0, project: 1, environment: 2 };
		return typeOrder[a.type] - typeOrder[b.type];
	});

	return results.slice(0, 12); // Limit results
});

function handleSelect(result: SearchResult) {
	if (result.type === 'secret' && result.environment) {
		// Navigate to project with environment and highlight the secret
		goto(
			`/admin/projects/${result.project.id}?env=${result.environment.slug}&highlight=${encodeURIComponent(result.secret!.key)}`,
		);
	} else if (result.type === 'environment' && result.environment) {
		goto(`/admin/projects/${result.project.id}?env=${result.environment.slug}`);
	} else {
		goto(`/admin/projects/${result.project.id}`);
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
				placeholder="Search projects, environments, or secrets..."
				class="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-muted-foreground"
				bind:value={searchQuery}
				onkeydown={handleKeydown}
			/>
			{#if isSearching}
				<LoaderCircle class="size-4 animate-spin text-muted-foreground" />
			{/if}
		</div>

		<!-- Results -->
		<div class="max-h-80 overflow-y-auto">
			{#if searchQuery.trim() && searchResults().length === 0}
				<div class="px-4 py-8 text-center text-sm text-muted-foreground">
					{#if isSearching}
						Searching...
					{:else}
						No results found for "{searchQuery}"
					{/if}
				</div>
			{:else if searchResults().length > 0}
				<div class="p-2">
					{#each searchResults() as result}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
							onclick={() => handleSelect(result)}
						>
							<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
								{#if result.type === 'secret'}
									<Key class="size-4 text-tokyo-orange" />
								{:else if result.type === 'environment'}
									<Folder class="size-4 text-tokyo-cyan" />
								{:else}
									<Folder class="size-4 text-muted-foreground" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="truncate text-sm font-medium {result.type === 'secret' ? 'font-mono' : ''}">{result.matchedText}</p>
								<p class="truncate text-xs text-muted-foreground">{result.subtitle}</p>
							</div>
							<ArrowRight class="size-4 shrink-0 text-muted-foreground" />
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
								onclick={() => handleSelect({ type: 'project', project, matchedText: project.name, subtitle: 'Project' })}
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
