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
import { createProject } from '$lib/stores/projects.svelte';
import { normalizeSlug, validateSlug } from '$lib/models/project';
import { TriangleAlert } from '@lucide/svelte';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onProjectCreated?: () => void;
}

let { open = $bindable(), onOpenChange, onProjectCreated }: Props = $props();

let displayName = $state('');
let slug = $state('');
let slugTouched = $state(false);
let isCreating = $state(false);
let error = $state<string | null>(null);

// Auto-generate slug from display name (until user manually edits it)
$effect(() => {
	if (!slugTouched && displayName) {
		slug = normalizeSlug(displayName);
	}
});

// Validate slug in real-time
const slugError = $derived(slugTouched || slug ? validateSlug(slug) : null);

function handleSlugInput(e: Event) {
	const input = e.target as HTMLInputElement;
	slugTouched = true;
	// Normalize as user types
	slug = normalizeSlug(input.value);
}

async function handleSubmit(e: Event) {
	e.preventDefault();
	error = null;

	if (!displayName.trim()) {
		error = 'Display name is required';
		return;
	}

	const slugValidation = validateSlug(slug);
	if (slugValidation) {
		error = slugValidation;
		return;
	}

	isCreating = true;
	try {
		await createProject(slug, displayName);
		displayName = '';
		slug = '';
		slugTouched = false;
		onOpenChange(false);
		onProjectCreated?.();
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to create project';
	} finally {
		isCreating = false;
	}
}

function handleOpenChange(value: boolean) {
	if (!value) {
		// Reset state when closing
		displayName = '';
		slug = '';
		slugTouched = false;
		error = null;
	}
	onOpenChange(value);
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-md">
		<form onsubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>Create Project</DialogTitle>
				<DialogDescription>
					Create a new project to organize your secrets by environment.
				</DialogDescription>
			</DialogHeader>

			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label for="display-name">Display Name</Label>
					<Input
						id="display-name"
						bind:value={displayName}
						placeholder="My Awesome Project"
						disabled={isCreating}
					/>
					<p class="text-xs text-muted-foreground">
						Human-readable name shown in the UI. Can be changed later.
					</p>
				</div>

				<div class="space-y-2">
					<Label for="project-slug">Slug</Label>
					<Input
						id="project-slug"
						value={slug}
						oninput={handleSlugInput}
						placeholder="my-awesome-project"
						disabled={isCreating}
						class={slugError ? 'border-destructive' : ''}
					/>
					{#if slugError}
						<p class="text-xs text-destructive">{slugError}</p>
					{:else}
						<p class="text-xs text-muted-foreground">
							Lowercase letters, numbers, and hyphens only.
						</p>
					{/if}
				</div>

				<!-- Warning about immutability -->
				<div class="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
					<TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-500" />
					<p class="text-xs text-amber-600 dark:text-amber-400">
						<strong>The slug cannot be changed</strong> after the project is created. 
						It's used as the identifier when accessing secrets via the CLI.
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
				<Button type="submit" disabled={isCreating || !displayName.trim() || !!slugError}>
					{isCreating ? 'Creating...' : 'Create Project'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
