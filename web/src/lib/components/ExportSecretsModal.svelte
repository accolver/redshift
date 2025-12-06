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
import InlineCode from '$lib/components/InlineCode.svelte';
import {
	exportToEnv,
	exportToJson,
	exportToYaml,
	exportToCsv,
	type ExportFormat,
} from '$lib/models/secrets-export';
import type { Secret } from '$lib/types/nostr';
import { Download, Copy, Check } from '@lucide/svelte';

interface Props {
	open: boolean;
	secrets: Secret[];
	projectName: string;
	environmentName: string;
	onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), secrets, projectName, environmentName, onOpenChange }: Props = $props();

let selectedFormat = $state<ExportFormat>('env');
let copied = $state(false);

const formats: { value: ExportFormat; label: string; extension: string; description: string }[] = [
	{ value: 'env', label: '.env', extension: '.env', description: 'KEY=VALUE format' },
	{ value: 'json', label: 'JSON', extension: '.json', description: 'Object with key-value pairs' },
	{ value: 'yaml', label: 'YAML', extension: '.yaml', description: 'YAML key-value format' },
	{ value: 'csv', label: 'CSV', extension: '.csv', description: 'Comma-separated values' },
];

const exportedContent = $derived(() => {
	switch (selectedFormat) {
		case 'env':
			return exportToEnv(secrets);
		case 'json':
			return exportToJson(secrets);
		case 'yaml':
			return exportToYaml(secrets);
		case 'csv':
			return exportToCsv(secrets);
		default:
			return '';
	}
});

const filename = $derived(() => {
	const base = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${environmentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
	const format = formats.find((f) => f.value === selectedFormat);
	return `${base}${format?.extension ?? '.env'}`;
});

function handleDownload() {
	const content = exportedContent();
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename();
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

async function handleCopy() {
	await navigator.clipboard.writeText(exportedContent());
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 2000);
}

function handleOpenChange(value: boolean) {
	if (!value) {
		selectedFormat = 'env';
		copied = false;
	}
	onOpenChange(value);
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle>Export Secrets</DialogTitle>
		<DialogDescription>
			Export {secrets.length} {secrets.length === 1 ? 'secret' : 'secrets'} from {environmentName} to a file.
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
							<span class="mt-1 text-xs text-muted-foreground">{format.description}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Preview -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Preview</Label>
					<button
						type="button"
						class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
						onclick={handleCopy}
					>
						{#if copied}
							<Check class="size-3" />
							Copied!
						{:else}
							<Copy class="size-3" />
							Copy
						{/if}
					</button>
				</div>
				<pre class="max-h-48 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs">{exportedContent()}</pre>
			</div>

			<!-- Filename -->
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Download class="size-4" />
				<span>Will be saved as: <InlineCode>{filename()}</InlineCode></span>
			</div>
		</div>

		<DialogFooter>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)}>
				Cancel
			</Button>
			<Button type="button" onclick={handleDownload}>
				<Download class="mr-2 size-4" />
				Download
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
