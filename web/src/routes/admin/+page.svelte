<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
import { getAuthState } from '$lib/stores/auth.svelte';
import { getProjectsState } from '$lib/stores/projects.svelte';
import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
import {
	Folder,
	ChevronRight,
	LoaderCircle,
	CircleCheck,
	Circle,
	Terminal,
	Copy,
	Check,
} from '@lucide/svelte';

const auth = $derived(getAuthState());
const projectsState = $derived(getProjectsState());

let showCreateModal = $state(false);
let copiedCommand = $state<string | null>(null);

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

async function copyCommand(command: string) {
	await navigator.clipboard.writeText(command);
	copiedCommand = command;
	setTimeout(() => {
		copiedCommand = null;
	}, 2000);
}

// Getting started checklist
const gettingStartedSteps = $derived(() => [
	{
		id: 'connect',
		title: 'Connect your Nostr identity',
		description: 'Use a NIP-07 browser extension like Alby or nos2x',
		completed: auth.isConnected,
	},
	{
		id: 'project',
		title: 'Create your first project',
		description: 'Projects organize secrets by application',
		completed: projectsState.projects.length > 0,
	},
	{
		id: 'secrets',
		title: 'Add secrets to an environment',
		description: 'Store API keys, database URLs, and more',
		completed: false, // Would need to track this
	},
	{
		id: 'cli',
		title: 'Install the CLI',
		description: 'Run secrets locally with redshift run',
		completed: false, // Would need to track this
	},
]);

// CLI commands reference
const cliCommands = [
	{ command: 'redshift login', description: 'Authenticate with your Nostr identity' },
	{ command: 'redshift run -- npm start', description: 'Run a command with secrets injected' },
	{ command: 'redshift set API_KEY sk-xxx', description: 'Set a secret value' },
	{ command: 'redshift get API_KEY', description: 'Get a secret value' },
	{ command: 'redshift list', description: 'List all secrets in current environment' },
];
</script>

<svelte:head>
	<title>Dashboard - Redshift Admin</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8">
	<div>
		<h1 class="text-3xl font-bold">Dashboard</h1>
		<p class="text-muted-foreground">Manage your projects and secrets</p>
	</div>

	<!-- Getting Started Guide (shown when no projects) -->
	{#if auth.isConnected && !projectsState.isLoading && projectsState.projects.length === 0}
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Getting Started</CardTitle>
					<CardDescription>Complete these steps to start managing your secrets</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						{#each gettingStartedSteps() as step (step.id)}
							<div class="flex items-start gap-3">
								<div class="mt-0.5">
									{#if step.completed}
										<CircleCheck class="size-5 text-green-500" />
									{:else}
										<Circle class="size-5 text-muted-foreground/40" />
									{/if}
								</div>
								<div class="flex-1">
									<p class="font-medium" class:text-muted-foreground={step.completed}>{step.title}</p>
									<p class="text-sm text-muted-foreground">{step.description}</p>
								</div>
								{#if step.id === 'project' && !step.completed}
									<Button size="sm" variant="outline" onclick={() => (showCreateModal = true)}>
										Create Project
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		</section>
	{/if}

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
				<!-- Empty state - connected but no projects (minimal since Getting Started is shown) -->
				<Card class="border-dashed">
					<CardContent class="flex flex-col items-center justify-center py-8 text-center">
						<Folder class="mb-3 size-8 text-muted-foreground/40" />
						<p class="text-sm text-muted-foreground">No projects yet</p>
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

	<!-- CLI Quick Reference -->
	<section>
		<Card>
			<CardHeader class="pb-3">
				<div class="flex items-center gap-2">
					<Terminal class="size-5 text-muted-foreground" />
					<CardTitle class="text-base">CLI Quick Reference</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<div class="space-y-2">
					{#each cliCommands as cmd}
						<div class="group flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
							<div class="flex items-center gap-3">
								<code class="font-mono text-sm">{cmd.command}</code>
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
					{/each}
				</div>
				<p class="mt-4 text-xs text-muted-foreground">
					Install: <code class="rounded bg-muted px-1.5 py-0.5">curl -fsSL https://redshift.dev/install | sh</code>
				</p>
			</CardContent>
		</Card>
	</section>
</div>

<CreateProjectModal bind:open={showCreateModal} onOpenChange={(v) => (showCreateModal = v)} />
