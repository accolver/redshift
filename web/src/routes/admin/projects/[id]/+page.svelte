<script lang="ts">
import { page } from '$app/state';
import { onMount } from 'svelte';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from '$lib/components/ui/dropdown-menu';

import { getProjectsState } from '$lib/stores/projects.svelte';
import {
	getSecretsState,
	subscribeToSecrets,
	unsubscribeFromSecrets,
	setSecret,
	deleteSecret,
} from '$lib/stores/secrets.svelte';
import {
	ChevronDown,
	Plus,
	Eye,
	EyeOff,
	Ellipsis,
	Search,
	GripVertical,
	Trash2,
	Copy,
	Pencil,
	LoaderCircle,
	GitBranch,
} from '@lucide/svelte';
import type { Environment } from '$lib/types/nostr';
import AddEnvironmentModal from '$lib/components/AddEnvironmentModal.svelte';
import { goto } from '$app/navigation';

// Get project ID from route
const projectId = $derived(page.params.id);

// Reactive state
const projectsState = $derived(getProjectsState());
const secretsState = $derived(getSecretsState());

// Find the current project
const project = $derived(projectsState.projects.find((p) => p.id === projectId));

// Selected environment
let selectedEnvSlug = $state<string | null>(null);
const selectedEnv = $derived(
	project?.environments.find((e) => e.slug === selectedEnvSlug) ?? project?.environments[0],
);

// UI State
let activeTab = $state<'secrets' | 'access' | 'logs'>('secrets');
let searchQuery = $state('');
let showAddEnvModal = $state(false);
let isAddingSecret = $state(false);
let newSecretKey = $state('');
let newSecretValue = $state('');
let showAddSecretRow = $state(false);

// Visibility toggle for secrets
let visibleSecrets = $state<Set<string>>(new Set());

// Filtered secrets based on search
const filteredSecrets = $derived(
	secretsState.secrets.filter((s) => s.key.toLowerCase().includes(searchQuery.toLowerCase())),
);

// Subscribe to secrets when environment changes
$effect(() => {
	if (project && selectedEnv) {
		subscribeToSecrets(project.id, selectedEnv.slug);
	}
});

// Set default environment when project loads
$effect(() => {
	if (project && project.environments.length > 0 && !selectedEnvSlug) {
		selectedEnvSlug = project.environments[0].slug;
	}
});

// Cleanup on unmount
onMount(() => {
	return () => {
		unsubscribeFromSecrets();
	};
});

function toggleVisibility(key: string) {
	if (visibleSecrets.has(key)) {
		visibleSecrets.delete(key);
		visibleSecrets = new Set(visibleSecrets);
	} else {
		visibleSecrets.add(key);
		visibleSecrets = new Set(visibleSecrets);
	}
}

async function handleAddSecret() {
	if (!newSecretKey.trim()) return;

	isAddingSecret = true;
	try {
		await setSecret(newSecretKey.toUpperCase(), newSecretValue);
		newSecretKey = '';
		newSecretValue = '';
		showAddSecretRow = false;
	} catch (err) {
		console.error('Failed to add secret:', err);
	} finally {
		isAddingSecret = false;
	}
}

async function handleDeleteSecret(key: string) {
	if (!confirm(`Delete secret "${key}"?`)) return;

	try {
		await deleteSecret(key);
	} catch (err) {
		console.error('Failed to delete secret:', err);
	}
}

function copyToClipboard(value: string) {
	navigator.clipboard.writeText(value);
}

function selectEnvironment(env: Environment) {
	selectedEnvSlug = env.slug;
}

function handleEnvironmentCreated(env: Environment) {
	selectedEnvSlug = env.slug;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && newSecretKey.trim()) {
		handleAddSecret();
	} else if (e.key === 'Escape') {
		showAddSecretRow = false;
		newSecretKey = '';
		newSecretValue = '';
	}
}
</script>

<svelte:head>
	<title>{project?.name ?? 'Project'} - Redshift Admin</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-3.5rem)] flex-col">
	{#if !project}
		<!-- Loading or not found -->
		<div class="flex flex-1 items-center justify-center">
			{#if projectsState.isLoading}
				<LoaderCircle class="size-8 animate-spin text-muted-foreground" />
			{:else}
				<p class="text-muted-foreground">Project not found</p>
			{/if}
		</div>
	{:else}
		<!-- Breadcrumb Header -->
		<div class="border-b border-border bg-card/50">
			<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
				<div class="flex items-center gap-2">
					<!-- Project Dropdown -->
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button {...props} class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-lg font-semibold hover:bg-muted">
									{project.name}
									<ChevronDown class="size-4 text-muted-foreground" />
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="w-56">
							{#each projectsState.projects as p (p.id)}
								<DropdownMenuItem onclick={() => goto(`/admin/projects/${p.id}`)}>
									{p.name}
								</DropdownMenuItem>
							{/each}
						</DropdownMenuContent>
					</DropdownMenu>

					<span class="text-muted-foreground">/</span>

					<!-- Environment Dropdown -->
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button {...props} class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-lg font-semibold hover:bg-muted">
									<GitBranch class="size-4" />
									{selectedEnv?.name ?? 'Select Environment'}
									<ChevronDown class="size-4 text-muted-foreground" />
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="w-56">
							{#each project.environments as env (env.id)}
								<DropdownMenuItem onclick={() => selectEnvironment(env)}>
									<GitBranch class="mr-2 size-4" />
									{env.name}
									<span class="ml-auto text-xs text-muted-foreground">{env.slug}</span>
								</DropdownMenuItem>
							{/each}
							<DropdownMenuSeparator />
							<DropdownMenuItem onclick={() => (showAddEnvModal = true)}>
								<Plus class="mr-2 size-4" />
								Add Environment
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm">
						Save
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button {...props} class="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted">
									<Ellipsis class="size-4" />
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>Settings</DropdownMenuItem>
							<DropdownMenuItem>Export</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem class="text-destructive">Delete Project</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="border-b border-border">
			<div class="mx-auto flex max-w-6xl items-center gap-6 px-6">
				<button
					type="button"
					class="border-b-2 py-3 text-sm font-medium transition-colors {activeTab === 'secrets'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'secrets')}
				>
					Secrets
				</button>
				<button
					type="button"
					class="border-b-2 py-3 text-sm font-medium transition-colors {activeTab === 'access'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'access')}
				>
					Access
				</button>
				<button
					type="button"
					class="border-b-2 py-3 text-sm font-medium transition-colors {activeTab === 'logs'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'logs')}
				>
					Logs
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1">
			{#if activeTab === 'secrets'}
				<div class="mx-auto max-w-6xl px-6 py-4">
					<!-- Toolbar -->
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-4">
							<span class="text-sm font-medium">
								Active ({filteredSecrets.length})
							</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="relative">
								<Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search for a secret..."
									class="w-64 pl-9"
									bind:value={searchQuery}
								/>
							</div>
							<Button size="sm" onclick={() => (showAddSecretRow = true)}>
								<Plus class="mr-1 size-4" />
								Add Secret
							</Button>
						</div>
					</div>

					<!-- Secrets List -->
					<div class="rounded-lg border border-border bg-card">
						{#if secretsState.isLoading}
							<div class="flex items-center justify-center py-12">
								<LoaderCircle class="size-6 animate-spin text-muted-foreground" />
							</div>
						{:else if filteredSecrets.length === 0 && !showAddSecretRow}
							<div class="py-12 text-center text-muted-foreground">
								{#if searchQuery}
									<p>No secrets match "{searchQuery}"</p>
								{:else}
									<p>No secrets yet</p>
									<p class="mt-1 text-sm">Click "Add Secret" to create your first secret.</p>
								{/if}
							</div>
						{:else}
							<!-- Add Secret Row -->
							{#if showAddSecretRow}
								<div class="flex items-center border-b border-border bg-muted/30 px-4 py-2">
									<div class="flex w-8 items-center justify-center">
										<GripVertical class="size-4 text-muted-foreground" />
									</div>
									<div class="flex flex-1 items-center gap-2">
										<Input
											type="text"
											placeholder="SECRET_NAME"
											class="h-8 w-64 font-mono text-sm uppercase"
											bind:value={newSecretKey}
											onkeydown={handleKeydown}
											autofocus
										/>
										<span class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">String</span>
									</div>
									<div class="flex flex-1 items-center gap-2">
										<Input
											type="text"
											placeholder="Value"
											class="h-8 flex-1 font-mono text-sm"
											bind:value={newSecretValue}
											onkeydown={handleKeydown}
										/>
									</div>
									<div class="flex items-center gap-1">
										<Button
											variant="ghost"
											size="sm"
											onclick={handleAddSecret}
											disabled={isAddingSecret || !newSecretKey.trim()}
										>
											{#if isAddingSecret}
												<LoaderCircle class="size-4 animate-spin" />
											{:else}
												Save
											{/if}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => {
												showAddSecretRow = false;
												newSecretKey = '';
												newSecretValue = '';
											}}
										>
											Cancel
										</Button>
									</div>
								</div>
							{/if}

							<!-- Secret Rows -->
							{#each filteredSecrets as secret (secret.key)}
								<div class="group flex items-center border-b border-border px-4 py-2 last:border-b-0 hover:bg-muted/30">
									<!-- Drag Handle -->
									<div class="flex w-8 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
										<GripVertical class="size-4 cursor-grab text-muted-foreground" />
									</div>

									<!-- Key + Type -->
									<div class="flex w-80 items-center gap-2">
										<span class="font-mono text-sm font-medium">{secret.key}</span>
										<span class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">String</span>
									</div>

									<!-- Value -->
									<div class="flex flex-1 items-center gap-2">
										<span class="font-mono text-sm text-muted-foreground">
											{#if visibleSecrets.has(secret.key)}
												{secret.value}
											{:else}
												{'•'.repeat(Math.min(secret.value.length || 6, 12))}
											{/if}
										</span>
									</div>

									<!-- Actions -->
									<div class="flex items-center gap-1">
										<Button
											variant="ghost"
											size="icon"
											class="size-8 opacity-0 transition-opacity group-hover:opacity-100"
											onclick={() => toggleVisibility(secret.key)}
										>
											{#if visibleSecrets.has(secret.key)}
												<EyeOff class="size-4" />
											{:else}
												<Eye class="size-4" />
											{/if}
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger>
												{#snippet child({ props })}
													<button
														{...props}
														class="flex size-8 cursor-pointer items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
													>
														<Ellipsis class="size-4" />
													</button>
												{/snippet}
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onclick={() => copyToClipboard(secret.value)}>
													<Copy class="mr-2 size-4" />
													Copy Value
												</DropdownMenuItem>
												<DropdownMenuItem>
													<Pencil class="mr-2 size-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													class="text-destructive"
													onclick={() => handleDeleteSecret(secret.key)}
												>
													<Trash2 class="mr-2 size-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else if activeTab === 'access'}
				<div class="mx-auto max-w-6xl px-6 py-8">
					<div class="text-center text-muted-foreground">
						<p>Access management coming soon</p>
						<p class="mt-1 text-sm">Configure who can view and edit secrets in this environment.</p>
					</div>
				</div>
			{:else if activeTab === 'logs'}
				<div class="mx-auto max-w-6xl px-6 py-8">
					<div class="text-center text-muted-foreground">
						<p>Activity logs coming soon</p>
						<p class="mt-1 text-sm">View a history of changes to secrets in this environment.</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Floating Add Button -->
		<div class="fixed bottom-6 right-6">
			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
						>
							<Plus class="size-4" />
							Add Secret
							<ChevronDown class="size-4" />
						</button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => (showAddSecretRow = true)}>
						<Plus class="mr-2 size-4" />
						Add Secret
					</DropdownMenuItem>
					<DropdownMenuItem>
						Import from .env
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	{/if}
</div>

{#if project}
	<AddEnvironmentModal
		bind:open={showAddEnvModal}
		projectId={project.id}
		onOpenChange={(v) => (showAddEnvModal = v)}
		onEnvironmentCreated={handleEnvironmentCreated}
	/>
{/if}
