<script lang="ts">
import { Motion } from 'svelte-motion';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
import { getAuthState } from '$lib/stores/auth.svelte';
import { getProjectsState } from '$lib/stores/projects.svelte';
import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
import ProjectCard from '$lib/components/ProjectCard.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import { LoaderCircle, Terminal, Copy, Check } from '@lucide/svelte';

const auth = $derived(getAuthState());
const projectsState = $derived(getProjectsState());

let showCreateModal = $state(false);
let copiedCommand = $state<string | null>(null);

async function copyCommand(command: string) {
	await navigator.clipboard.writeText(command);
	copiedCommand = command;
	setTimeout(() => {
		copiedCommand = null;
	}, 2000);
}

// Animation helper for staggered items
function getStaggerDelay(index: number, baseDelay = 0.1) {
	return baseDelay + index * 0.05;
}

// CLI commands reference
const cliCommands = [
	{ command: 'redshift login', description: 'Authenticate with your Nostr identity' },
	{ command: 'redshift setup', description: 'Configure project and environment' },
	{ command: 'redshift run -- npm start', description: 'Run a command with secrets injected' },
	{ command: 'redshift secrets set KEY value', description: 'Set a secret value' },
	{ command: 'redshift secrets get KEY', description: 'Get a secret value' },
	{ command: 'redshift secrets list', description: 'List all secrets in current environment' },
];
</script>

<svelte:head>
	<title>Dashboard - Redshift Admin</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8">
	<!-- Page header with fade in -->
	<Motion
		initial={{ opacity: 0, y: -10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.3 }}
		let:motion
	>
		<div use:motion>
			<h1 class="text-3xl font-bold">Dashboard</h1>
			<p class="text-muted-foreground">Manage your projects and secrets</p>
		</div>
	</Motion>

	<!-- Projects Grid -->
	<Motion
		initial={{ opacity: 0, y: 10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.3, delay: 0.1 }}
		let:motion
	>
		<section use:motion>
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
					<ProjectCard placeholder />
				{:else}
					<!-- Project cards with staggered animation -->
					{#each projectsState.projects as project, i (project.id)}
						<Motion
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3, delay: getStaggerDelay(i) }}
							let:motion
						>
							<div use:motion>
								<ProjectCard {project} />
							</div>
						</Motion>
					{/each}
				{/if}
			</div>
		</section>
	</Motion>

	<!-- CLI Quick Reference -->
	<Motion
		initial={{ opacity: 0, y: 10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.3, delay: 0.2 }}
		let:motion
	>
		<section use:motion>
			<Card>
				<CardHeader class="pb-3">
					<div class="flex items-center gap-2">
						<Terminal class="size-5 text-muted-foreground" />
						<CardTitle class="text-base">CLI Quick Reference</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					<div class="space-y-2">
						{#each cliCommands as cmd, i}
							<Motion
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.2, delay: 0.3 + i * 0.03 }}
								let:motion
							>
								<div
									use:motion
									class="group flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
								>
									<div class="flex items-center gap-3">
										<InlineCode>{cmd.command}</InlineCode>
										<span class="text-sm text-muted-foreground">{cmd.description}</span>
									</div>
									<button
										type="button"
										class="flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
										onclick={() => copyCommand(cmd.command)}
										title="Copy command"
									>
										{#if copiedCommand === cmd.command}
											<Check class="size-4 text-green-500" />
										{:else}
											<Copy class="size-4" />
										{/if}
									</button>
								</div>
							</Motion>
						{/each}
					</div>
					<p class="mt-4 text-xs text-muted-foreground">
						Install: <InlineCode>curl -fsSL https://redshiftapp.com/install | sh</InlineCode>
					</p>
				</CardContent>
			</Card>
		</section>
	</Motion>
</div>

<CreateProjectModal bind:open={showCreateModal} onOpenChange={(v) => (showCreateModal = v)} />
