<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	title: string;
	description: string;
	children: Snippet;
}

let { title, description, children }: Props = $props();
</script>

<div class="docs-container mx-auto w-full max-w-4xl">
	<!-- Sticky header - top-14 accounts for mobile nav header on small screens, top-0 on lg -->
	<header class="sticky top-14 z-30 bg-background/95 px-4 pb-4 pt-6 backdrop-blur-sm sm:px-6 sm:pt-8 lg:top-0">
		<h1 class="text-3xl font-bold sm:text-4xl">{title}</h1>
		<p class="mt-2 text-muted-foreground sm:text-lg">{description}</p>
	</header>

	<!-- Content -->
	<div class="px-4 pb-8 pt-4 sm:px-6">
		<section class="prose prose-invert max-w-none">
			{@render children()}
		</section>
	</div>
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
