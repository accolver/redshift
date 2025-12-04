<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
import { getAuthState } from '$lib/stores/auth.svelte';
import { getProjectsState } from '$lib/stores/projects.svelte';
import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
import { Folder, ChevronRight, LoaderCircle } from '@lucide/svelte';

const auth = $derived(getAuthState());
const projectsState = $derived(getProjectsState());

let showCreateModal = $state(false);

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}
</script>

<svelte:head>
	<title>Dashboard - Redshift Admin</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8">
	<div>
		<h1 class="text-3xl font-bold">Dashboard</h1>
		<p class="text-muted-foreground">Manage your projects and secrets</p>
	</div>

	<!-- Projects Grid -->
	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Projects</h2>
			<Button size="sm" disabled={!auth.isConnected} onclick={() => (showCreateModal = true)}>
				New Project
			</Button>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#if !auth.isConnected}
				<!-- Empty state - not connected -->
				<Card class="border-dashed">
					<CardContent class="flex flex-col items-center justify-center py-12 text-center">
						<p class="mb-4 text-muted-foreground">Connect to view projects</p>
						<p class="text-sm text-muted-foreground">
							Connect your Nostr identity above to view and manage your secret projects.
						</p>
					</CardContent>
				</Card>
			{:else if projectsState.isLoading}
				<!-- Loading state -->
				<Card class="border-dashed">
					<CardContent class="flex flex-col items-center justify-center py-12 text-center">
						<LoaderCircle class="mb-4 size-8 animate-spin text-muted-foreground" />
						<p class="text-sm text-muted-foreground">Loading projects from relays...</p>
					</CardContent>
				</Card>
			{:else if projectsState.projects.length === 0}
				<!-- Empty state - connected but no projects -->
				<Card class="border-dashed">
					<CardContent class="flex flex-col items-center justify-center py-12 text-center">
						<p class="mb-4 text-muted-foreground">No projects yet</p>
						<p class="mb-4 text-sm text-muted-foreground">
							Create your first project to start managing secrets.
						</p>
						<Button variant="outline" size="sm" onclick={() => (showCreateModal = true)}>
							Create Project
						</Button>
					</CardContent>
				</Card>
			{:else}
				<!-- Project cards -->
				{#each projectsState.projects as project (project.id)}
					<a href="/admin/projects/{project.id}" class="block">
						<Card class="group cursor-pointer transition-colors hover:border-primary/50">
							<CardHeader class="pb-3">
								<div class="flex items-start justify-between">
									<div class="flex items-center gap-3">
										<div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
											<Folder class="size-5" />
										</div>
										<div>
											<CardTitle class="text-base">{project.name}</CardTitle>
											<CardDescription class="text-xs">
												Created {formatDate(project.createdAt)}
											</CardDescription>
										</div>
									</div>
									<ChevronRight class="size-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								</div>
							</CardHeader>
							<CardContent>
								<div class="flex items-center gap-4 text-sm text-muted-foreground">
									<span>{project.environments.length} environment{project.environments.length !== 1 ? 's' : ''}</span>
								</div>
							</CardContent>
						</Card>
					</a>
				{/each}
			{/if}
		</div>
	</section>
</div>

<CreateProjectModal bind:open={showCreateModal} onOpenChange={(v) => (showCreateModal = v)} />
