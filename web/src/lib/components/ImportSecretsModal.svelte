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
import { Label } from '$lib/components/ui/label';
import {
	parseEnv,
	parseJson,
	parseYaml,
	parseCsv,
	type ExportFormat,
} from '$lib/models/secrets-export';
import type { Secret } from '$lib/types/nostr';
import { Upload, TriangleAlert, FileUp, Check } from '@lucide/svelte';

interface Props {
	open: boolean;
	existingSecrets: Secret[];
	onOpenChange: (open: boolean) => void;
	onImport: (secrets: Secret[], mode: 'merge' | 'replace') => void;
}

let { open = $bindable(), existingSecrets, onOpenChange, onImport }: Props = $props();

let selectedFormat = $state<ExportFormat>('env');
let importMode = $state<'merge' | 'replace'>('merge');
let inputContent = $state('');
let parsedSecrets = $state<Secret[]>([]);
let parseError = $state<string | null>(null);
let showReplaceConfirm = $state(false);
let isDragging = $state(false);

const formats: { value: ExportFormat; label: string; description: string }[] = [
	{ value: 'env', label: '.env', description: 'KEY=VALUE format' },
	{ value: 'json', label: 'JSON', description: 'Object with key-value pairs' },
	{ value: 'yaml', label: 'YAML', description: 'YAML key-value format' },
	{ value: 'csv', label: 'CSV', description: 'Comma-separated values' },
];

// Parse content whenever it changes
$effect(() => {
	if (!inputContent.trim()) {
		parsedSecrets = [];
		parseError = null;
		return;
	}

	try {
		switch (selectedFormat) {
			case 'env':
				parsedSecrets = parseEnv(inputContent);
				break;
			case 'json':
				parsedSecrets = parseJson(inputContent);
				break;
			case 'yaml':
				parsedSecrets = parseYaml(inputContent);
				break;
			case 'csv':
				parsedSecrets = parseCsv(inputContent);
				break;
		}
		parseError = null;
	} catch (err) {
		parsedSecrets = [];
		parseError = err instanceof Error ? err.message : 'Failed to parse content';
	}
});

// Calculate what will happen with the import
const importSummary = $derived(() => {
	if (parsedSecrets.length === 0) return null;

	const existingKeys = new Set(existingSecrets.map((s) => s.key));
	const newKeys = parsedSecrets.filter((s) => !existingKeys.has(s.key));
	const updatedKeys = parsedSecrets.filter((s) => existingKeys.has(s.key));

	if (importMode === 'replace') {
		return {
			added: parsedSecrets.length,
			updated: 0,
			removed: existingSecrets.length,
			total: parsedSecrets.length,
		};
	}

	return {
		added: newKeys.length,
		updated: updatedKeys.length,
		removed: 0,
		total: existingSecrets.length + newKeys.length,
	};
});

function handleImport() {
	if (parsedSecrets.length === 0) return;

	if (importMode === 'replace' && existingSecrets.length > 0 && !showReplaceConfirm) {
		showReplaceConfirm = true;
		return;
	}

	onImport(parsedSecrets, importMode);
	handleOpenChange(false);
}

function handleOpenChange(value: boolean) {
	if (!value) {
		selectedFormat = 'env';
		importMode = 'merge';
		inputContent = '';
		parsedSecrets = [];
		parseError = null;
		showReplaceConfirm = false;
		isDragging = false;
	}
	onOpenChange(value);
}

function handleDrop(e: DragEvent) {
	e.preventDefault();
	isDragging = false;

	const file = e.dataTransfer?.files[0];
	if (file) {
		readFile(file);
	}
}

function handleFileSelect(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (file) {
		readFile(file);
	}
}

function readFile(file: File) {
	// Auto-detect format from extension
	const ext = file.name.split('.').pop()?.toLowerCase();
	if (ext === 'json') selectedFormat = 'json';
	else if (ext === 'yaml' || ext === 'yml') selectedFormat = 'yaml';
	else if (ext === 'csv') selectedFormat = 'csv';
	else selectedFormat = 'env';

	const reader = new FileReader();
	reader.onload = (e) => {
		inputContent = e.target?.result as string;
	};
	reader.readAsText(file);
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle>Import Secrets</DialogTitle>
			<DialogDescription>
				Import secrets from a file or paste content directly.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- Format Selection -->
			<div class="space-y-2">
				<Label>Format</Label>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each formats as format}
						<button
							type="button"
							class="flex cursor-pointer flex-col items-center rounded-lg border p-3 transition-colors hover:bg-muted {selectedFormat === format.value ? 'border-primary bg-primary/5' : 'border-border'}"
							onclick={() => (selectedFormat = format.value)}
						>
							<span class="font-mono text-sm font-medium">{format.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Drop Zone / Text Area -->
			<div class="space-y-2">
				<Label>Content</Label>
				<div
					class="relative"
					role="region"
					ondragover={(e) => {
						e.preventDefault();
						isDragging = true;
					}}
					ondragleave={() => (isDragging = false)}
					ondrop={handleDrop}
				>
					{#if !inputContent}
						<label
							class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors {isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}"
						>
							<FileUp class="mb-2 size-8 text-muted-foreground" />
							<span class="text-sm text-muted-foreground">
								Drop a file here or <span class="text-primary underline">browse</span>
							</span>
							<input
								type="file"
								class="sr-only"
								accept=".env,.json,.yaml,.yml,.csv,.txt"
								onchange={handleFileSelect}
							/>
						</label>
					{:else}
						<textarea
							class="min-h-32 w-full resize-y rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs outline-none focus:border-primary"
							placeholder="Paste your secrets here..."
							bind:value={inputContent}
						></textarea>
						<button
							type="button"
							class="absolute right-2 top-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80"
							onclick={() => (inputContent = '')}
						>
							Clear
						</button>
					{/if}
				</div>
				{#if parseError}
					<p class="flex items-center gap-1 text-sm text-destructive">
						<TriangleAlert class="size-4" />
						{parseError}
					</p>
				{/if}
			</div>

			<!-- Import Mode -->
			{#if parsedSecrets.length > 0}
				<div class="space-y-2">
					<Label>Import Mode</Label>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							class="flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-colors hover:bg-muted {importMode === 'merge' ? 'border-primary bg-primary/5' : 'border-border'}"
							onclick={() => {
								importMode = 'merge';
								showReplaceConfirm = false;
							}}
						>
							<span class="font-medium">Merge</span>
							<span class="text-xs text-muted-foreground">Add new, update existing</span>
						</button>
						<button
							type="button"
							class="flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-colors hover:bg-muted {importMode === 'replace' ? 'border-destructive bg-destructive/5' : 'border-border'}"
							onclick={() => (importMode = 'replace')}
						>
							<span class="font-medium">Replace All</span>
							<span class="text-xs text-muted-foreground">Delete existing, import new</span>
						</button>
					</div>
				</div>

				<!-- Summary -->
				{#if importSummary()}
					<div class="rounded-lg border border-border bg-muted/30 p-3">
						<div class="flex items-center gap-2 text-sm">
							<Check class="size-4 text-green-500" />
							<span>
								{parsedSecrets.length} {parsedSecrets.length === 1 ? 'secret' : 'secrets'} found
							</span>
						</div>
						<div class="mt-2 text-xs text-muted-foreground">
							{#if importMode === 'merge'}
								{#if importSummary()?.added}
									<span class="text-green-500">+{importSummary()?.added} new</span>
								{/if}
								{#if importSummary()?.updated}
									<span class="ml-2 text-yellow-500">{importSummary()?.updated} updated</span>
								{/if}
							{:else}
								<span class="text-destructive">
									All {existingSecrets.length} existing secrets will be replaced
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Replace Confirmation -->
				{#if showReplaceConfirm}
					<div class="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-3">
						<TriangleAlert class="mt-0.5 size-5 shrink-0 text-destructive" />
						<div>
							<p class="font-medium text-destructive">Are you sure?</p>
							<p class="text-sm text-muted-foreground">
								This will permanently delete all {existingSecrets.length} existing secrets and replace them with {parsedSecrets.length} imported secrets.
							</p>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<DialogFooter>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)}>
				Cancel
			</Button>
			<Button
				type="button"
				variant={showReplaceConfirm ? 'destructive' : 'default'}
				disabled={parsedSecrets.length === 0 || !!parseError}
				onclick={handleImport}
			>
				<Upload class="mr-2 size-4" />
				{#if showReplaceConfirm}
					Confirm Replace
				{:else}
					Import {parsedSecrets.length} {parsedSecrets.length === 1 ? 'Secret' : 'Secrets'}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
