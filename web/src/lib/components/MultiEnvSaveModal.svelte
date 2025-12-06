<script lang="ts">
import { Button } from '$lib/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '$lib/components/ui/dialog';
import InlineCode from '$lib/components/InlineCode.svelte';
import { GitBranch, Check, LoaderCircle } from '@lucide/svelte';
import type { Environment, Secret } from '$lib/types/nostr';

interface Props {
	open: boolean;
	/** Single secret key (for backward compatibility with inline save) */
	secretKey?: string;
	/** Single secret value (for backward compatibility with inline save) */
	secretValue?: string;
	/** Multiple secrets to save (for global save) */
	secrets?: Secret[];
	currentEnvSlug: string;
	environments: Environment[];
	onOpenChange: (open: boolean) => void;
	onSave: (envSlugs: string[]) => Promise<void>;
}

let {
	open = $bindable(),
	secretKey = '',
	secretValue = '',
	secrets = [],
	currentEnvSlug,
	environments,
	onOpenChange,
	onSave,
}: Props = $props();

// Determine if we're in multi-secret mode
const isMultiSecret = $derived(secrets.length > 0);

// Track which environments are selected (current env is always selected)
let selectedEnvs = $state<Set<string>>(new Set());
let isSaving = $state(false);
let error = $state<string | null>(null);

// Reset selected envs when modal opens or currentEnvSlug changes
$effect(() => {
	if (open) {
		selectedEnvs = new Set([currentEnvSlug]);
		error = null;
	}
});

function toggleEnv(slug: string) {
	if (slug === currentEnvSlug) return; // Can't deselect current env

	const newSet = new Set(selectedEnvs);
	if (newSet.has(slug)) {
		newSet.delete(slug);
	} else {
		newSet.add(slug);
	}
	selectedEnvs = newSet;
}

function selectAll() {
	selectedEnvs = new Set(environments.map((e) => e.slug));
}

function selectNone() {
	selectedEnvs = new Set([currentEnvSlug]);
}

async function handleSave() {
	isSaving = true;
	error = null;

	try {
		await onSave(Array.from(selectedEnvs));
		onOpenChange(false);
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to save';
	} finally {
		isSaving = false;
	}
}

function handleOpenChange(value: boolean) {
	if (!value) {
		error = null;
	}
	onOpenChange(value);
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Save to Multiple Environments</DialogTitle>
			<DialogDescription>
				{#if isMultiSecret}
					Apply {secrets.length} secret{secrets.length !== 1 ? 's' : ''} to other environments?
				{:else}
					Apply <InlineCode>{secretKey}</InlineCode> to other environments?
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- Value preview -->
			{#if isMultiSecret}
				<div class="rounded-lg border border-border bg-muted/50 p-3">
					<p class="mb-1 text-xs font-medium text-muted-foreground">Secrets to save</p>
					<div class="max-h-24 space-y-1 overflow-y-auto">
						{#each secrets as secret (secret.key)}
							<p class="truncate font-mono text-sm">
								<span class="font-medium">{secret.key}</span>
								<span class="text-muted-foreground"> = </span>
								<span class="text-muted-foreground">{secret.value.slice(0, 30)}{secret.value.length > 30 ? '...' : ''}</span>
							</p>
						{/each}
					</div>
				</div>
			{:else}
				<div class="rounded-lg border border-border bg-muted/50 p-3">
					<p class="mb-1 text-xs font-medium text-muted-foreground">Value</p>
					<p class="truncate font-mono text-sm">
						{secretValue ? secretValue.slice(0, 50) + (secretValue.length > 50 ? '...' : '') : '(empty)'}
					</p>
				</div>
			{/if}

			<!-- Environment selection -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<p class="text-sm font-medium">Environments</p>
					<div class="flex gap-2">
						<button
							type="button"
							class="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
							onclick={selectAll}
						>
							Select all
						</button>
						<span class="text-muted-foreground">|</span>
						<button
							type="button"
							class="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
							onclick={selectNone}
						>
							Current only
						</button>
					</div>
				</div>
				
				<div class="space-y-1">
					{#each environments as env (env.slug)}
						{@const isSelected = selectedEnvs.has(env.slug)}
						{@const isCurrent = env.slug === currentEnvSlug}
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors {isSelected ? 'border-primary bg-primary/5' : 'border-border'} {isCurrent ? '' : 'cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/30'}"
							onclick={() => toggleEnv(env.slug)}
							disabled={isCurrent}
						>
							<div class="flex size-5 items-center justify-center rounded border {isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'}">
								{#if isSelected}
									<Check class="size-3" />
								{/if}
							</div>
							<GitBranch class="size-4 text-muted-foreground" />
							<span class="flex-1 text-sm font-medium">{env.name}</span>
							<span class="text-xs text-muted-foreground">{env.slug}</span>
							{#if isCurrent}
								<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">current</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isSaving}>
				Cancel
			</Button>
			<Button onclick={handleSave} disabled={isSaving}>
				{#if isSaving}
					<LoaderCircle class="mr-2 size-4 animate-spin" />
					Saving...
				{:else}
					Save to {selectedEnvs.size} environment{selectedEnvs.size !== 1 ? 's' : ''}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
