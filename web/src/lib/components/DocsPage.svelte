<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';
import { docsStore } from '$lib/stores/docs.svelte';

interface Props {
	title: string;
	description: string;
	children: Snippet;
}

let { title, description, children }: Props = $props();

let titleRef: HTMLHeadingElement;

onMount(() => {
	docsStore.currentTitle = title;
	docsStore.titleVisible = true;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				// Only hide the floating title when the main title is visible
				// boundingClientRect.top < 0 means the element has scrolled above viewport
				const scrolledPastTitle = entry.boundingClientRect.top < -100;
				docsStore.titleVisible = !scrolledPastTitle && entry.isIntersecting;
			});
		},
		{ threshold: [0, 1] }
	);

	observer.observe(titleRef);

	return () => {
		observer.disconnect();
		docsStore.titleVisible = true;
		docsStore.currentTitle = '';
	};
});
</script>

<div class="docs-container mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6">
		<h1 bind:this={titleRef} class="text-3xl font-bold sm:text-4xl">{title}</h1>
		<p class="mt-2 text-muted-foreground sm:text-lg">{description}</p>
	</header>

	<section class="prose prose-invert max-w-none">
		{@render children()}
	</section>
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
