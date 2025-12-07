<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	children: Snippet;
}

let { children }: Props = $props();
</script>

<div class="docs-container mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	{@render children()}
</div>

<style>
	.docs-container {
		/* Prevent any content from causing horizontal page scroll */
		overflow-x: hidden;
	}

	/* Ensure tables scroll within their container, not the page */
	.docs-container :global(table) {
		display: block;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		max-width: 100%;
	}

	/* Wrap table in scrollable div for better mobile UX */
	.docs-container :global(.not-prose) {
		max-width: 100%;
		overflow-x: auto;
	}

	/* Make code blocks respect container bounds */
	.docs-container :global(pre) {
		max-width: 100%;
		overflow-x: auto;
	}

	/* Prevent long inline code from causing overflow */
	.docs-container :global(code) {
		word-break: break-word;
	}
</style>
