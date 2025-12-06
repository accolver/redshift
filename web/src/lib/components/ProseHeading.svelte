<script lang="ts">
import { Link } from '@lucide/svelte';

interface Props {
	level: 2 | 3 | 4;
	id: string;
	children: import('svelte').Snippet;
}

let { level, id, children }: Props = $props();

let copied = $state(false);

function handleClick(e: MouseEvent) {
	e.preventDefault();
	if (id) {
		// Update URL hash
		history.pushState(null, '', `#${id}`);
		// Copy to clipboard
		navigator.clipboard.writeText(window.location.href);
		// Show feedback
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
}
</script>

{#if level === 2}
	<h2 {id} class="prose-heading group">
		{@render children()}
		<a
			href="#{id}"
			onclick={handleClick}
			class="prose-heading-link"
			aria-label="Link to this section"
			title={copied ? 'Copied!' : 'Copy link to section'}
		>
			<Link class="size-4" />
		</a>
	</h2>
{:else if level === 3}
	<h3 {id} class="prose-heading group">
		{@render children()}
		<a
			href="#{id}"
			onclick={handleClick}
			class="prose-heading-link"
			aria-label="Link to this section"
			title={copied ? 'Copied!' : 'Copy link to section'}
		>
			<Link class="size-3.5" />
		</a>
	</h3>
{:else}
	<h4 {id} class="prose-heading group">
		{@render children()}
		<a
			href="#{id}"
			onclick={handleClick}
			class="prose-heading-link"
			aria-label="Link to this section"
			title={copied ? 'Copied!' : 'Copy link to section'}
		>
			<Link class="size-3" />
		</a>
	</h4>
{/if}
