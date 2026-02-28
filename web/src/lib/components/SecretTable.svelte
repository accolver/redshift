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

const { secrets, editable = false, onDelete, onEdit }: Props = $props();

// Pagination
const PAGE_SIZE = 50;
let currentPage = $state(0);

const totalPages = $derived(Math.max(1, Math.ceil(secrets.length / PAGE_SIZE)));
const paginatedSecrets = $derived(
	secrets.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
);
const showingStart = $derived(secrets.length === 0 ? 0 : currentPage * PAGE_SIZE + 1);
const showingEnd = $derived(Math.min((currentPage + 1) * PAGE_SIZE, secrets.length));

// Reset to first page when secrets list changes significantly
$effect(() => {
	if (currentPage >= totalPages) {
		currentPage = Math.max(0, totalPages - 1);
	}
});

function goToPreviousPage() {
	if (currentPage > 0) currentPage--;
}

function goToNextPage() {
	if (currentPage < totalPages - 1) currentPage++;
}

// Track visibility state for each secret
const visibility = $state<Record<string, boolean>>({});

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
		{#each paginatedSecrets as secret (secret.key)}
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

{#if secrets.length > PAGE_SIZE}
	<div class="flex items-center justify-between border-t border-border px-4 py-3">
		<span class="text-sm text-muted-foreground">
			Showing {showingStart}-{showingEnd} of {secrets.length} secrets
		</span>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={currentPage === 0}
				onclick={goToPreviousPage}
			>
				Previous
			</Button>
			<span class="text-sm text-muted-foreground">
				Page {currentPage + 1} of {totalPages}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={currentPage >= totalPages - 1}
				onclick={goToNextPage}
			>
				Next
			</Button>
		</div>
	</div>
{/if}
