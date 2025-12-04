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

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onProjectCreated?: () => void;
}

let { open = $bindable(), onOpenChange, onProjectCreated }: Props = $props();

let projectName = $state('');
let isCreating = $state(false);
let error = $state<string | null>(null);

async function handleSubmit(e: Event) {
	e.preventDefault();
	error = null;

	if (!projectName.trim()) {
		error = 'Project name is required';
		return;
	}

	isCreating = true;
	try {
		await createProject(projectName);
		projectName = '';
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
		projectName = '';
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
					<Label for="project-name">Project Name</Label>
					<Input
						id="project-name"
						bind:value={projectName}
						placeholder="my-awesome-project"
						disabled={isCreating}
					/>
				</div>

				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
			</div>

			<DialogFooter>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isCreating}>
					Cancel
				</Button>
				<Button type="submit" disabled={isCreating || !projectName.trim()}>
					{isCreating ? 'Creating...' : 'Create Project'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
