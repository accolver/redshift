<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';

	interface Secret {
		key: string;
		value: string;
	}

	interface Props {
		secrets: Secret[];
		editable?: boolean;
		onDelete?: (key: string) => void;
		onEdit?: (key: string, newValue: string) => void;
	}

	let { secrets, editable = false, onDelete, onEdit }: Props = $props();

	// Track visibility state for each secret
	let visibility = $state<Record<string, boolean>>({});

	// Track which secret is being edited
	let editingKey = $state<string | null>(null);
	let editValue = $state('');

	function toggleVisibility(key: string) {
		visibility[key] = !visibility[key];
	}

	function isVisible(key: string): boolean {
		return visibility[key] ?? false;
	}

	function maskValue(_value: string): string {
		return '••••••••';
	}

	function handleDelete(key: string) {
		onDelete?.(key);
	}

	function startEdit(key: string, currentValue: string) {
		if (editable) {
			editingKey = key;
			editValue = currentValue;
		}
		// Also call onEdit for non-editable mode to signal edit intent
		onEdit?.(key, currentValue);
	}

	function handleEditClick(key: string, value: string) {
		if (editable) {
			startEdit(key, value);
		} else {
			onEdit?.(key, value);
		}
	}

	function saveEdit() {
		if (editingKey && onEdit) {
			onEdit(editingKey, editValue);
		}
		editingKey = null;
		editValue = '';
	}

	function cancelEdit() {
		editingKey = null;
		editValue = '';
	}
</script>

<Table>
	<TableHeader>
		<TableRow>
			<TableHead class="w-[200px]">Key</TableHead>
			<TableHead>Value</TableHead>
			<TableHead class="w-[200px] text-right">Actions</TableHead>
		</TableRow>
	</TableHeader>
	<TableBody>
		{#each secrets as secret (secret.key)}
			<TableRow>
				<TableCell class="font-mono font-medium">{secret.key}</TableCell>
				<TableCell class="font-mono text-muted-foreground">
					{#if editingKey === secret.key}
						<Input
							bind:value={editValue}
							class="max-w-md font-mono"
							onkeydown={(e) => {
								if (e.key === 'Enter') saveEdit();
								if (e.key === 'Escape') cancelEdit();
							}}
						/>
					{:else if isVisible(secret.key)}
						{secret.value}
					{:else}
						{maskValue(secret.value)}
					{/if}
				</TableCell>
				<TableCell class="text-right">
					<div class="flex justify-end gap-2">
						{#if editingKey === secret.key}
							<Button variant="ghost" size="sm" onclick={saveEdit}>Save</Button>
							<Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
						{:else}
							<Button variant="ghost" size="sm" onclick={() => toggleVisibility(secret.key)}>
								{isVisible(secret.key) ? 'Hide' : 'Show'}
							</Button>
							{#if onEdit}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => handleEditClick(secret.key, secret.value)}
								>
									Edit
								</Button>
							{/if}
							{#if onDelete}
								<Button
									variant="ghost"
									size="sm"
									class="text-destructive"
									onclick={() => handleDelete(secret.key)}
								>
									Delete
								</Button>
							{/if}
						{/if}
					</div>
				</TableCell>
			</TableRow>
		{:else}
			<TableRow>
				<TableCell colspan={3} class="py-8 text-center text-muted-foreground">
					No secrets yet. Add your first secret above.
				</TableCell>
			</TableRow>
		{/each}
	</TableBody>
</Table>
