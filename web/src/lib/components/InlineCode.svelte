<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	children: Snippet;
	class?: string;
}

let { children, class: className = '' }: Props = $props();
</script>

<code class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-sm text-primary {className}">{@render children()}</code>
