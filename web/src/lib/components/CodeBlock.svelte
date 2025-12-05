<script lang="ts">
import { Copy, Check } from '@lucide/svelte';

interface Props {
	code: string;
	copyable?: boolean;
}

let { code, copyable = true }: Props = $props();

let copied = $state(false);

async function copyCode() {
	await navigator.clipboard.writeText(code);
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 2000);
}
</script>

<div class="group relative">
	<pre class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm text-foreground">{code}</pre>
	{#if copyable}
		<button
			type="button"
			class="absolute right-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
			onclick={copyCode}
			title="Copy to clipboard"
		>
			{#if copied}
				<Check class="size-4 text-green-500" />
			{:else}
				<Copy class="size-4" />
			{/if}
		</button>
	{/if}
</div>
