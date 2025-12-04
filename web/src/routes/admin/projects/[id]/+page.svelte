<script lang="ts">
import { page } from '$app/state';
import { onMount } from 'svelte';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '$lib/components/ui/table';

import { getProjectsState } from '$lib/stores/projects.svelte';
import {
	getSecretsState,
	subscribeToSecrets,
	unsubscribeFromSecrets,
	setSecret,
	deleteSecret,
} from '$lib/stores/secrets.svelte';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, LoaderCircle, Settings } from '@lucide/svelte';
import type { Environment } from '$lib/types/nostr';
import AddEnvironmentModal from '$lib/components/AddEnvironmentModal.svelte';

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

// Add secret form
let newSecretKey = $state('');
let newSecretValue = $state('');
let isAddingSecret = $state(false);
let addSecretError = $state<string | null>(null);

// Visibility toggle for secrets
let visibleSecrets = $state<Set<string>>(new Set());

// Add environment modal
let showAddEnvModal = $state(false);

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

async function handleAddSecret(e: Event) {
	e.preventDefault();
	addSecretError = null;

	if (!newSecretKey.trim()) {
		addSecretError = 'Secret key is required';
		return;
	}

	isAddingSecret = true;
	try {
		await setSecret(newSecretKey, newSecretValue);
		newSecretKey = '';
		newSecretValue = '';
	} catch (err) {
		addSecretError = err instanceof Error ? err.message : 'Failed to add secret';
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

function selectEnvironment(env: Environment) {
	selectedEnvSlug = env.slug;
}

function handleEnvironmentCreated(env: Environment) {
	// Select the newly created environment
	selectedEnvSlug = env.slug;
}
</script>

<svelte:head>
	<title>{project?.name ?? 'Project'} - Redshift Admin</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/admin">
			<ArrowLeft class="size-5" />
		</Button>
		<div class="flex-1">
			<h1 class="text-2xl font-bold">{project?.name ?? 'Loading...'}</h1>
			<p class="text-sm text-muted-foreground">
				{#if selectedEnv}
					Environment: {selectedEnv.name}
				{:else}
					No environment selected
				{/if}
			</p>
		</div>
		<Button variant="outline" size="sm">
			<Settings class="mr-2 size-4" />
			Settings
		</Button>
	</div>

	{#if !project}
		<!-- Loading or not found -->
		<Card>
			<CardContent class="flex items-center justify-center py-12">
				{#if projectsState.isLoading}
					<LoaderCircle class="size-8 animate-spin text-muted-foreground" />
				{:else}
					<p class="text-muted-foreground">Project not found</p>
				{/if}
			</CardContent>
		</Card>
	{:else if project.environments.length === 0}
		<!-- No environments -->
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-12 text-center">
				<p class="mb-4 text-muted-foreground">No environments configured</p>
				<p class="mb-4 text-sm text-muted-foreground">
					Create an environment to start managing secrets.
				</p>
				<Button size="sm" onclick={() => (showAddEnvModal = true)}>Create Environment</Button>
			</CardContent>
		</Card>
	{:else}
		<!-- Environment Tabs -->
		<div class="flex items-center gap-2 border-b border-border">
			{#each project.environments as env (env.id)}
				<button
					type="button"
					class="cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors {selectedEnv?.slug ===
					env.slug
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'}"
					onclick={() => selectEnvironment(env)}
				>
					{env.name}
				</button>
			{/each}
			<Button variant="ghost" size="sm" class="ml-2" onclick={() => (showAddEnvModal = true)}>
				<Plus class="mr-1 size-4" />
				Add Environment
			</Button>
		</div>

		<!-- Add Secret Form -->
		<Card>
			<CardHeader>
				<CardTitle class="text-base">Add Secret</CardTitle>
			</CardHeader>
			<CardContent>
				<form class="flex gap-4" onsubmit={handleAddSecret}>
					<div class="flex-1 space-y-1">
						<Label for="secret-key" class="sr-only">Key</Label>
						<Input
							id="secret-key"
							bind:value={newSecretKey}
							placeholder="SECRET_KEY"
							class="font-mono uppercase"
							disabled={isAddingSecret}
						/>
					</div>
					<div class="flex-1 space-y-1">
						<Label for="secret-value" class="sr-only">Value</Label>
						<Input
							id="secret-value"
							type="password"
							bind:value={newSecretValue}
							placeholder="Value"
							class="font-mono"
							disabled={isAddingSecret}
						/>
					</div>
					<Button type="submit" disabled={isAddingSecret || !newSecretKey.trim()}>
						{#if isAddingSecret}
							<LoaderCircle class="mr-2 size-4 animate-spin" />
						{:else}
							<Plus class="mr-2 size-4" />
						{/if}
						Add
					</Button>
				</form>
				{#if addSecretError}
					<p class="mt-2 text-sm text-destructive">{addSecretError}</p>
				{/if}
			</CardContent>
		</Card>

		<!-- Secrets Table -->
		<Card>
			<CardHeader>
				<CardTitle class="text-base">
					Secrets
					{#if secretsState.secrets.length > 0}
						<span class="ml-2 text-sm font-normal text-muted-foreground">
							({secretsState.secrets.length})
						</span>
					{/if}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if secretsState.isLoading}
					<div class="flex items-center justify-center py-8">
						<LoaderCircle class="size-6 animate-spin text-muted-foreground" />
					</div>
				{:else if secretsState.secrets.length === 0}
					<div class="py-8 text-center text-muted-foreground">
						<p>No secrets yet</p>
						<p class="mt-1 text-sm">Add your first secret using the form above.</p>
					</div>
				{:else}
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="w-[250px]">Key</TableHead>
								<TableHead>Value</TableHead>
								<TableHead class="w-[120px] text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each secretsState.secrets as secret (secret.key)}
								<TableRow>
									<TableCell class="font-mono font-medium">{secret.key}</TableCell>
									<TableCell class="font-mono text-muted-foreground">
										{#if visibleSecrets.has(secret.key)}
											{secret.value}
										{:else}
											{'•'.repeat(Math.min(secret.value.length, 20))}
										{/if}
									</TableCell>
									<TableCell class="text-right">
										<div class="flex justify-end gap-1">
											<Button
												variant="ghost"
												size="icon"
												class="size-8"
												onclick={() => toggleVisibility(secret.key)}
											>
												{#if visibleSecrets.has(secret.key)}
													<EyeOff class="size-4" />
												{:else}
													<Eye class="size-4" />
												{/if}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
												onclick={() => handleDeleteSecret(secret.key)}
												disabled={secretsState.isSaving}
											>
												<Trash2 class="size-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				{/if}
			</CardContent>
		</Card>
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
