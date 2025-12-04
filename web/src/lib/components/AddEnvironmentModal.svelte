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
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { addEnvironment } from '$lib/stores/projects.svelte';
import type { Environment } from '$lib/types/nostr';

interface Props {
	open: boolean;
	projectId: string;
	onOpenChange: (open: boolean) => void;
	onEnvironmentCreated?: (env: Environment) => void;
}

let { open = $bindable(), projectId, onOpenChange, onEnvironmentCreated }: Props = $props();

let envName = $state('');
let envSlug = $state('');
let isCreating = $state(false);
let error = $state<string | null>(null);

// Auto-generate slug from name
function handleNameChange(e: Event) {
	const target = e.target as HTMLInputElement;
	envName = target.value;
	// Auto-generate slug if user hasn't manually edited it
	if (!slugManuallyEdited) {
		envSlug = target.value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}
}

let slugManuallyEdited = $state(false);

function handleSlugChange(e: Event) {
	const target = e.target as HTMLInputElement;
	envSlug = target.value;
	slugManuallyEdited = true;
}

async function handleSubmit(e: Event) {
	e.preventDefault();
	error = null;

	if (!envName.trim()) {
		error = 'Environment name is required';
		return;
	}

	if (!envSlug.trim()) {
		error = 'Environment slug is required';
		return;
	}

	isCreating = true;
	try {
		const env = await addEnvironment(projectId, envSlug, envName);
		envName = '';
		envSlug = '';
		slugManuallyEdited = false;
		onOpenChange(false);
		onEnvironmentCreated?.(env);
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to create environment';
	} finally {
		isCreating = false;
	}
}

function handleOpenChange(value: boolean) {
	if (!value) {
		// Reset state when closing
		envName = '';
		envSlug = '';
		slugManuallyEdited = false;
		error = null;
	}
	onOpenChange(value);
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-md">
		<form onsubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>Add Environment</DialogTitle>
				<DialogDescription>
					Create a new environment to manage secrets separately (e.g., staging, production).
				</DialogDescription>
			</DialogHeader>

			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label for="env-name">Name</Label>
					<Input
						id="env-name"
						value={envName}
						oninput={handleNameChange}
						placeholder="Production"
						disabled={isCreating}
					/>
					<p class="text-xs text-muted-foreground">Display name for the environment</p>
				</div>

				<div class="space-y-2">
					<Label for="env-slug">Slug</Label>
					<Input
						id="env-slug"
						value={envSlug}
						oninput={handleSlugChange}
						placeholder="prod"
						class="font-mono lowercase"
						disabled={isCreating}
					/>
					<p class="text-xs text-muted-foreground">
						Used in CLI commands: <code class="rounded bg-muted px-1">redshift run -e {envSlug || 'slug'}</code>
					</p>
				</div>

				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<DialogFooter>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isCreating}>
					Cancel
				</Button>
				<Button type="submit" disabled={isCreating || !envName.trim() || !envSlug.trim()}>
					{isCreating ? 'Creating...' : 'Add Environment'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
