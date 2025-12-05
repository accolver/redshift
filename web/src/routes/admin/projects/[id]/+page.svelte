<script lang="ts">
import { page } from '$app/state';
import { onMount } from 'svelte';
import { slide } from 'svelte/transition';
import { flip } from 'svelte/animate';
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
	getSecretsContext,
	subscribeToSecrets,
	unsubscribeFromSecrets,
	setSecret,
	deleteSecret,
} from '$lib/stores/secrets.svelte';
import { getAuthState } from '$lib/stores/auth.svelte';
import { publishEvent, REDSHIFT_KIND, getSecretsDTag } from '$lib/stores/nostr.svelte';
import { createSecretsContent } from '$lib/models/secrets';
import {
	ChevronDown,
	Plus,
	Eye,
	EyeOff,
	Ellipsis,
	Search,
	Trash2,
	Clipboard,
	LoaderCircle,
	GitBranch,
	ArrowUpDown,
	Check,
	ArrowUpAZ,
	ArrowDownAZ,
	Clock,
	Circle,
	CircleDot,
	CircleCheck,
	Download,
	Upload,
} from '@lucide/svelte';
import type { Environment } from '$lib/types/nostr';
import AddEnvironmentModal from '$lib/components/AddEnvironmentModal.svelte';
import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
import ExportSecretsModal from '$lib/components/ExportSecretsModal.svelte';
import ImportSecretsModal from '$lib/components/ImportSecretsModal.svelte';
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
let searchQuery = $state('');
let showAddEnvModal = $state(false);
let showCreateProjectModal = $state(false);
let showExportModal = $state(false);
let showImportModal = $state(false);
let isAddingSecret = $state(false);
let newSecretKey = $state('');
let newSecretValue = $state('');
let showAddSecretRow = $state(false);

// Sorting state
type SortOption = 'asc' | 'desc' | 'newest' | 'oldest';
let sortBy = $state<SortOption>('asc');

// Visibility toggle for secrets
let visibleSecrets = $state<Set<string>>(new Set());
let showAllSecrets = $state(false);

// Track edited secrets (originalKey -> { key: string, value: string })
let editedSecrets = $state<Map<string, { key: string; value: string }>>(new Map());

// Track saving state per secret
let savingSecrets = $state<Set<string>>(new Set());

// Track recently saved secrets (for showing success state)
let savedSecrets = $state<Set<string>>(new Set());

// Track copied secret for toast feedback
let copiedKey = $state<string | null>(null);

// Check if a secret has been modified
function isSecretModified(originalKey: string): boolean {
	const edited = editedSecrets.get(originalKey);
	if (!edited) return false;
	const original = secretsState.secrets.find((s) => s.key === originalKey);
	if (!original) return false;
	return edited.key !== original.key || edited.value !== original.value;
}

// Get the current edited value for a secret (or original if not edited)
function getEditedSecret(originalKey: string): { key: string; value: string } {
	const edited = editedSecrets.get(originalKey);
	if (edited) return edited;
	const original = secretsState.secrets.find((s) => s.key === originalKey);
	return original ? { key: original.key, value: original.value } : { key: '', value: '' };
}

// Update edited secret key
function updateSecretKey(originalKey: string, newKey: string) {
	const current = getEditedSecret(originalKey);
	editedSecrets.set(originalKey, { ...current, key: newKey });
	editedSecrets = new Map(editedSecrets);
}

// Update edited secret value
function updateSecretValue(originalKey: string, newValue: string) {
	const current = getEditedSecret(originalKey);
	editedSecrets.set(originalKey, { ...current, value: newValue });
	editedSecrets = new Map(editedSecrets);
}

// Check if there are any unsaved changes (including pending new secret)
const hasUnsavedChanges = $derived(() => {
	// Check if there's a pending new secret
	if (showAddSecretRow && newSecretKey.trim()) return true;
	// Check edited secrets
	for (const [originalKey] of editedSecrets) {
		if (isSecretModified(originalKey)) return true;
	}
	return false;
});

// Save all changes - batch update all secrets at once (including new secret row)
async function saveAllChanges() {
	const toSave = Array.from(editedSecrets.entries()).filter(([key]) => isSecretModified(key));
	const hasNewSecret = showAddSecretRow && newSecretKey.trim();

	if (toSave.length === 0 && !hasNewSecret) return;

	// Track the new keys for saved state (in case key was renamed)
	const savedKeyMap = new Map<string, string>(); // originalKey -> newKey

	// Mark all as saving (use the NEW key for tracking since that's what we'll display)
	for (const [originalKey, edited] of toSave) {
		savingSecrets.add(edited.key);
		savedKeyMap.set(originalKey, edited.key);
	}
	savingSecrets = new Set(savingSecrets);

	try {
		// Build the new secrets array with all changes applied
		let updatedSecrets = [...secretsState.secrets];
		const keysToRemove: string[] = [];

		for (const [originalKey, edited] of toSave) {
			const originalIndex = updatedSecrets.findIndex((s) => s.key === originalKey);

			if (originalIndex !== -1) {
				// If key changed, mark old for removal and add new
				if (edited.key !== originalKey) {
					keysToRemove.push(originalKey);
					// Check if new key already exists (update it) or add new
					const existingNewIndex = updatedSecrets.findIndex((s) => s.key === edited.key);
					if (existingNewIndex !== -1) {
						updatedSecrets[existingNewIndex] = { key: edited.key, value: edited.value };
					} else {
						updatedSecrets.push({ key: edited.key, value: edited.value });
					}
				} else {
					// Just update the value
					updatedSecrets[originalIndex] = { key: edited.key, value: edited.value };
				}
			}
		}

		// Remove old keys that were renamed
		updatedSecrets = updatedSecrets.filter((s) => !keysToRemove.includes(s.key));

		// Add new secret if present
		if (hasNewSecret) {
			const trimmedKey = newSecretKey.trim();
			// Check if key already exists
			const existingIndex = updatedSecrets.findIndex((s) => s.key === trimmedKey);
			if (existingIndex !== -1) {
				updatedSecrets[existingIndex] = { key: trimmedKey, value: newSecretValue };
			} else {
				updatedSecrets.push({ key: trimmedKey, value: newSecretValue });
			}
			// Track for saving state
			savingSecrets.add(trimmedKey);
			savedKeyMap.set('__new__', trimmedKey);
		}

		// Now save all secrets at once
		const auth = getAuthState();
		if (!auth.isConnected || !auth.pubkey) {
			throw new Error('Must be connected to save secrets');
		}

		const { projectId, environmentSlug } = getSecretsContext();
		if (!projectId || !environmentSlug) {
			throw new Error('No project/environment selected');
		}

		const content = createSecretsContent(updatedSecrets);

		const unsignedEvent = {
			kind: REDSHIFT_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', getSecretsDTag(projectId, environmentSlug)]],
			content: JSON.stringify(content),
		};

		let signedEvent;
		if (auth.method === 'nip07' && window.nostr) {
			signedEvent = await window.nostr.signEvent(unsignedEvent);
		} else {
			throw new Error('Local signing not yet implemented.');
		}

		await publishEvent(signedEvent);

		// Mark all as saved (use the new keys)
		for (const [originalKey, newKey] of savedKeyMap) {
			savingSecrets.delete(newKey);
			savedSecrets.add(newKey);
			if (originalKey !== '__new__') {
				editedSecrets.delete(originalKey);
			}
		}
		savingSecrets = new Set(savingSecrets);
		savedSecrets = new Set(savedSecrets);
		editedSecrets = new Map(editedSecrets);

		// Clear new secret row if it was saved
		if (hasNewSecret) {
			newSecretKey = '';
			newSecretValue = '';
			showAddSecretRow = false;
		}

		// Clear saved status after 2 seconds
		const keysToClean = Array.from(savedKeyMap.values());
		setTimeout(() => {
			for (const key of keysToClean) {
				savedSecrets.delete(key);
			}
			savedSecrets = new Set(savedSecrets);
		}, 2000);
	} catch (err) {
		console.error('Failed to save secrets:', err);
		// Clear saving state on error
		for (const [, newKey] of savedKeyMap) {
			savingSecrets.delete(newKey);
		}
		savingSecrets = new Set(savingSecrets);
	}
}

// Get the status of a secret: 'default' | 'dirty' | 'saving' | 'saved'
function getSecretStatus(originalKey: string): 'default' | 'dirty' | 'saving' | 'saved' {
	const edited = getEditedSecret(originalKey);
	const currentKey = edited.key || originalKey;

	// Check both original and current key for saving/saved states
	if (savingSecrets.has(originalKey) || savingSecrets.has(currentKey)) return 'saving';
	if (savedSecrets.has(originalKey) || savedSecrets.has(currentKey)) return 'saved';
	if (isSecretModified(originalKey)) return 'dirty';
	return 'default';
}

// Filtered and sorted secrets
const filteredSecrets = $derived(() => {
	let secrets = secretsState.secrets.filter((s) =>
		s.key.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	// Sort secrets
	switch (sortBy) {
		case 'asc':
			secrets = [...secrets].sort((a, b) => a.key.localeCompare(b.key));
			break;
		case 'desc':
			secrets = [...secrets].sort((a, b) => b.key.localeCompare(a.key));
			break;
		case 'newest':
			// For now, reverse order (newest first) - would need timestamp in real impl
			secrets = [...secrets].reverse();
			break;
		case 'oldest':
			// Keep original order (oldest first)
			break;
	}

	return secrets;
});

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

// Warn before leaving with unsaved changes
function handleBeforeUnload(e: BeforeUnloadEvent) {
	if (hasUnsavedChanges()) {
		e.preventDefault();
		// Modern browsers ignore custom messages, but we need to return something
		return 'You have unsaved changes. Are you sure you want to leave?';
	}
}

// Cleanup on unmount
onMount(() => {
	// Add beforeunload listener
	window.addEventListener('beforeunload', handleBeforeUnload);

	return () => {
		window.removeEventListener('beforeunload', handleBeforeUnload);
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

function toggleAllVisibility() {
	if (showAllSecrets) {
		visibleSecrets = new Set();
		showAllSecrets = false;
	} else {
		visibleSecrets = new Set(secretsState.secrets.map((s) => s.key));
		showAllSecrets = true;
	}
}

// Transform key input to uppercase and underscores only
function transformSecretKey(value: string): string {
	return value
		.toUpperCase()
		.replace(/[^A-Z0-9_]/g, (char) => {
			if (char === ' ' || char === '-') return '_';
			return '';
		})
		.replace(/_+/g, '_'); // Replace multiple underscores with single
}

function handleKeyInput(e: Event) {
	const input = e.target as HTMLInputElement;
	const cursorPos = input.selectionStart ?? 0;
	const oldLength = input.value.length;
	newSecretKey = transformSecretKey(input.value);
	// Adjust cursor position after transformation
	const newLength = newSecretKey.length;
	const diff = newLength - oldLength;
	requestAnimationFrame(() => {
		input.setSelectionRange(cursorPos + diff, cursorPos + diff);
	});
}

async function handleAddSecret() {
	if (!newSecretKey.trim()) return;

	isAddingSecret = true;
	try {
		await setSecret(newSecretKey, newSecretValue);
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

function copyToClipboard(key: string, value: string) {
	navigator.clipboard.writeText(value);
	copiedKey = key;
	setTimeout(() => {
		copiedKey = null;
	}, 2000);
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

async function handleImportSecrets(
	importedSecrets: import('$lib/types/nostr').Secret[],
	mode: 'merge' | 'replace',
) {
	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		console.error('Must be connected to import secrets');
		return;
	}

	const { projectId, environmentSlug } = getSecretsContext();
	if (!projectId || !environmentSlug) {
		console.error('No project/environment selected');
		return;
	}

	let finalSecrets: import('$lib/types/nostr').Secret[];

	if (mode === 'replace') {
		// Replace all existing secrets with imported ones
		finalSecrets = importedSecrets;
	} else {
		// Merge: add new, update existing
		const existingMap = new Map(secretsState.secrets.map((s) => [s.key, s]));
		for (const imported of importedSecrets) {
			existingMap.set(imported.key, imported);
		}
		finalSecrets = Array.from(existingMap.values());
	}

	try {
		const content = createSecretsContent(finalSecrets);

		const unsignedEvent = {
			kind: REDSHIFT_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', getSecretsDTag(projectId, environmentSlug)]],
			content: JSON.stringify(content),
		};

		let signedEvent;
		if (auth.method === 'nip07' && window.nostr) {
			signedEvent = await window.nostr.signEvent(unsignedEvent);
		} else {
			throw new Error('Local signing not yet implemented.');
		}

		await publishEvent(signedEvent);
	} catch (err) {
		console.error('Failed to import secrets:', err);
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
			<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
				<div class="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
					<!-- Project Dropdown -->
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button {...props} class="flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-base font-semibold hover:bg-muted sm:gap-2 sm:px-2 sm:text-lg">
									<span class="truncate">{project.name}</span>
									<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="w-56">
							{#each projectsState.projects as p (p.id)}
								<DropdownMenuItem onclick={() => goto(`/admin/projects/${p.id}`)}>
									{p.name}
								</DropdownMenuItem>
							{/each}
							<DropdownMenuSeparator />
							<DropdownMenuItem onclick={() => (showCreateProjectModal = true)}>
								<Plus class="mr-2 size-4" />
								New Project
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<span class="shrink-0 text-muted-foreground">/</span>

					<!-- Environment Dropdown -->
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button {...props} class="flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-base font-semibold hover:bg-muted sm:gap-2 sm:px-2 sm:text-lg">
									<GitBranch class="size-4 shrink-0" />
									<span class="truncate">{selectedEnv?.name ?? 'Select Environment'}</span>
									<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
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

				<div class="flex shrink-0 items-center gap-2">
					<Button 
						variant={hasUnsavedChanges() ? "default" : "outline"} 
						size="sm"
						disabled={!hasUnsavedChanges()}
						onclick={saveAllChanges}
					>
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
							<DropdownMenuItem onclick={() => (showExportModal = true)}>
								<Download class="mr-2 size-4" />
								Export
							</DropdownMenuItem>
							<DropdownMenuItem onclick={() => (showImportModal = true)}>
								<Upload class="mr-2 size-4" />
								Import
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem class="text-destructive">Delete Project</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1">
			<div class="mx-auto max-w-6xl px-4 py-4 sm:px-6">
					<!-- Toolbar -->
					<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium">
								Active ({filteredSecrets().length})
							</span>
							
							<!-- Sort Dropdown -->
							<DropdownMenu>
								<DropdownMenuTrigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
											class:text-primary={sortBy !== 'asc'}
										>
											<ArrowUpDown class="size-4" />
										</button>
									{/snippet}
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" class="w-48">
									<div class="px-2 py-1.5 text-xs font-semibold text-muted-foreground">SORT BY</div>
									<DropdownMenuItem onclick={() => (sortBy = 'asc')}>
										<ArrowUpAZ class="mr-2 size-4" />
										Ascending (A-Z)
										{#if sortBy === 'asc'}
											<Check class="ml-auto size-4" />
										{/if}
									</DropdownMenuItem>
									<DropdownMenuItem onclick={() => (sortBy = 'desc')}>
										<ArrowDownAZ class="mr-2 size-4" />
										Descending (Z-A)
										{#if sortBy === 'desc'}
											<Check class="ml-auto size-4" />
										{/if}
									</DropdownMenuItem>
									<DropdownMenuItem onclick={() => (sortBy = 'newest')}>
										<Clock class="mr-2 size-4" />
										Newest to oldest
										{#if sortBy === 'newest'}
											<Check class="ml-auto size-4" />
										{/if}
									</DropdownMenuItem>
									<DropdownMenuItem onclick={() => (sortBy = 'oldest')}>
										<Clock class="mr-2 size-4" />
										Oldest to newest
										{#if sortBy === 'oldest'}
											<Check class="ml-auto size-4" />
										{/if}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							
							<!-- Show/Hide All Button -->
							<button
								type="button"
								class="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
								class:text-primary={showAllSecrets}
								class:text-muted-foreground={!showAllSecrets}
								onclick={toggleAllVisibility}
								title={showAllSecrets ? 'Hide all values' : 'Show all values'}
							>
								{#if showAllSecrets}
									<EyeOff class="size-4" />
								{:else}
									<Eye class="size-4" />
								{/if}
							</button>
						</div>
						<div class="flex flex-1 items-center gap-2 sm:flex-initial sm:justify-end">
							<div class="relative flex-1 sm:flex-initial">
								<Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search..."
									class="w-full pl-9 sm:w-64"
									bind:value={searchQuery}
								/>
							</div>
							<Button size="sm" onclick={() => (showAddSecretRow = true)} class="hidden sm:flex">
								<Plus class="mr-1 size-4" />
								Add Secret
							</Button>
						</div>
					</div>

					<!-- Secrets List -->
					<div class="space-y-2">
						{#if secretsState.isLoading}
							<div class="flex items-center justify-center py-12">
								<LoaderCircle class="size-6 animate-spin text-muted-foreground" />
							</div>
						{:else if filteredSecrets().length === 0 && !showAddSecretRow}
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
								<div class="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0" transition:slide={{ duration: 200 }}>
									<!-- Status placeholder (hidden on mobile) -->
									<div class="hidden size-8 items-center justify-center sm:flex">
										<Circle class="size-4 text-muted-foreground/30" />
									</div>
									
									<!-- Key Pill -->
									<div class="flex h-10 items-center rounded-lg border border-border bg-card px-3 sm:w-72">
										<input
											type="text"
											placeholder="SECRET_NAME"
											class="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
											bind:value={newSecretKey}
											oninput={handleKeyInput}
											onkeydown={handleKeydown}
											autofocus
										/>
									</div>
									
									<!-- Value Pill -->
									<div class="flex h-10 flex-1 items-center rounded-lg border border-border bg-card px-3">
										<input
											type="text"
											placeholder="Value"
											class="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
											bind:value={newSecretValue}
											onkeydown={handleKeydown}
										/>
									</div>
									
									<!-- Actions -->
									<div class="flex items-center justify-end gap-1">
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
							{#each filteredSecrets() as secret (secret.key)}
								{@const edited = getEditedSecret(secret.key)}
								{@const status = getSecretStatus(secret.key)}
								<div 
									class="group flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
									class:border-primary={status === 'dirty'}
									transition:slide={{ duration: 200 }}
									animate:flip={{ duration: 200 }}
								>
									<!-- Mobile Header: Key + Status -->
									<div class="flex items-center justify-between sm:hidden">
										<div 
											class="flex h-9 flex-1 items-center rounded-lg border bg-card px-3 transition-colors"
											class:border-border={status !== 'dirty'}
											class:border-primary={status === 'dirty'}
										>
											<input
												type="text"
												class="w-full bg-transparent font-mono text-sm font-medium outline-none"
												value={edited.key}
												oninput={(e) => {
													const input = e.target as HTMLInputElement;
													const transformed = transformSecretKey(input.value);
													updateSecretKey(secret.key, transformed);
													input.value = transformed;
												}}
											/>
										</div>
										<div class="ml-2 flex items-center gap-1">
											{#if status === 'saving'}
												<LoaderCircle class="size-4 animate-spin text-muted-foreground" />
											{:else if status === 'saved'}
												<CircleCheck class="size-4 text-green-500" />
											{:else if status === 'dirty'}
												<CircleDot class="size-4 text-primary" />
											{:else}
												<Check class="size-4 text-muted-foreground/30" />
											{/if}
										</div>
									</div>

									<!-- Mobile Value Row -->
									<div class="flex items-center gap-2 sm:hidden">
										<div 
											class="flex h-9 flex-1 items-center rounded-lg border bg-card px-3 transition-colors"
											class:border-border={status !== 'dirty'}
											class:border-primary={status === 'dirty'}
										>
											{#if visibleSecrets.has(secret.key)}
												<input
													type="text"
													class="w-full bg-transparent font-mono text-sm text-muted-foreground outline-none"
													value={edited.value}
													oninput={(e) => updateSecretValue(secret.key, (e.target as HTMLInputElement).value)}
												/>
											{:else}
												<button
													type="button"
													class="flex-1 text-left font-mono text-sm text-muted-foreground"
													onclick={() => toggleVisibility(secret.key)}
												>
													{'•'.repeat(16)}
												</button>
											{/if}
										</div>
										<!-- Mobile actions always visible -->
										<button
											type="button"
											class="flex size-8 cursor-pointer items-center justify-center rounded transition-colors {copiedKey === secret.key ? 'text-green-500' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
											onclick={() => copyToClipboard(secret.key, edited.value)}
											title={copiedKey === secret.key ? 'Copied!' : 'Copy value'}
										>
											{#if copiedKey === secret.key}
												<Check class="size-4" />
											{:else}
												<Clipboard class="size-4" />
											{/if}
										</button>
										<button
											type="button"
											class="flex size-8 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
											onclick={() => toggleVisibility(secret.key)}
											title={visibleSecrets.has(secret.key) ? 'Hide value' : 'Show value'}
										>
											{#if visibleSecrets.has(secret.key)}
												<EyeOff class="size-4" />
											{:else}
												<Eye class="size-4" />
											{/if}
										</button>
										<DropdownMenu>
											<DropdownMenuTrigger>
												{#snippet child({ props })}
													<button
														{...props}
														class="flex size-8 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
													>
														<Ellipsis class="size-4" />
													</button>
												{/snippet}
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
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

									<!-- Desktop Layout (hidden on mobile) -->
									<div class="hidden sm:flex sm:flex-1 sm:items-center sm:gap-2">
										<!-- Status Icon -->
										<div class="flex size-8 items-center justify-center">
											{#if status === 'saving'}
												<LoaderCircle class="size-4 animate-spin text-muted-foreground" />
											{:else if status === 'saved'}
												<CircleCheck class="size-4 text-green-500" />
											{:else if status === 'dirty'}
												<CircleDot class="size-4 text-primary" />
											{:else}
												<Check class="size-4 text-muted-foreground/30" />
											{/if}
										</div>

										<!-- Key Pill (Editable) -->
										<div 
											class="flex h-10 w-72 items-center rounded-lg border bg-card px-3 transition-colors"
											class:border-border={status !== 'dirty'}
											class:border-primary={status === 'dirty'}
										>
											<input
												type="text"
												class="w-full truncate bg-transparent font-mono text-sm font-medium outline-none"
												value={edited.key}
												oninput={(e) => {
													const input = e.target as HTMLInputElement;
													const transformed = transformSecretKey(input.value);
													updateSecretKey(secret.key, transformed);
													input.value = transformed;
												}}
											/>
										</div>

										<!-- Value Pill (Editable) -->
										<div 
											class="flex h-10 flex-1 items-center justify-between rounded-lg border bg-card px-3 transition-colors"
											class:border-border={status !== 'dirty'}
											class:border-primary={status === 'dirty'}
										>
											{#if visibleSecrets.has(secret.key)}
												<input
													type="text"
													class="flex-1 bg-transparent font-mono text-sm text-muted-foreground outline-none"
													value={edited.value}
													oninput={(e) => updateSecretValue(secret.key, (e.target as HTMLInputElement).value)}
												/>
											{:else}
												<button
													type="button"
													class="group/value relative flex-1 cursor-pointer text-left"
													onclick={() => toggleVisibility(secret.key)}
												>
													<span class="font-mono text-sm text-muted-foreground transition-opacity group-hover/value:opacity-0">
														{'•'.repeat(24)}
													</span>
													<span class="absolute inset-0 flex items-center text-sm text-muted-foreground opacity-0 transition-opacity group-hover/value:opacity-100">
														Click to reveal
													</span>
												</button>
											{/if}
											
											<!-- Right-aligned actions inside value pill -->
											<div class="ml-2 flex items-center gap-1">
												<button
													type="button"
													class="flex size-7 cursor-pointer items-center justify-center rounded transition-all {copiedKey === secret.key ? 'text-green-500 opacity-100' : 'text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100'}"
													onclick={() => copyToClipboard(secret.key, edited.value)}
													title={copiedKey === secret.key ? 'Copied!' : 'Copy value'}
												>
													{#if copiedKey === secret.key}
														<Check class="size-4" />
													{:else}
														<Clipboard class="size-4" />
													{/if}
												</button>
												
												<button
													type="button"
													class="flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
													onclick={() => toggleVisibility(secret.key)}
													title={visibleSecrets.has(secret.key) ? 'Hide value' : 'Show value'}
												>
													{#if visibleSecrets.has(secret.key)}
														<EyeOff class="size-4" />
													{:else}
														<Eye class="size-4" />
													{/if}
												</button>
												
												<DropdownMenu>
													<DropdownMenuTrigger>
														{#snippet child({ props })}
															<button
																{...props}
																class="flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
															>
																<Ellipsis class="size-4" />
															</button>
														{/snippet}
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
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
									</div>
								</div>
							{/each}
						{/if}
					</div>
			</div>
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
					<DropdownMenuItem onclick={() => (showImportModal = true)}>
						<Upload class="mr-2 size-4" />
						Import
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

<CreateProjectModal
	bind:open={showCreateProjectModal}
	onOpenChange={(v) => (showCreateProjectModal = v)}
	onProjectCreated={() => {
		// Navigate to the new project after creation
		const newProject = projectsState.projects[projectsState.projects.length - 1];
		if (newProject) {
			goto(`/admin/projects/${newProject.id}`);
		}
	}}
/>

{#if project && selectedEnv}
	<ExportSecretsModal
		bind:open={showExportModal}
		secrets={secretsState.secrets}
		projectName={project.name}
		environmentName={selectedEnv.name}
		onOpenChange={(v) => (showExportModal = v)}
	/>

	<ImportSecretsModal
		bind:open={showImportModal}
		existingSecrets={secretsState.secrets}
		onOpenChange={(v) => (showImportModal = v)}
		onImport={handleImportSecrets}
	/>
{/if}

<!-- Copy Toast Notification -->
{#if copiedKey}
	<div 
		class="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transform"
		transition:slide={{ duration: 150 }}
	>
		<div class="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-lg">
			<Check class="size-4 text-green-500" />
			<span class="text-sm">Copied to clipboard</span>
		</div>
	</div>
{/if}
