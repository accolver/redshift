<script lang="ts">
import { Link } from '@lucide/svelte';

interface Props {
	level: 2 | 3 | 4;
	id?: string;
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

// Level-based styles
const levelStyles = {
	2: 'text-2xl font-semibold tracking-tight mt-10 mb-4 first:mt-0 text-foreground border-b border-border pb-2',
	3: 'text-xl font-semibold tracking-tight mt-8 mb-3 first:mt-0 text-foreground',
	4: 'text-lg font-medium tracking-tight mt-6 mb-2 first:mt-0 text-foreground'
} as const;

const iconSizes = {
	2: 'size-4',
	3: 'size-3.5',
	4: 'size-3'
} as const;
</script>

{#if level === 2}
	<h2 {id} class="prose-heading group {levelStyles[2]}">
		{@render children()}
		{#if id}
			<a
				href="#{id}"
				onclick={handleClick}
				class="prose-heading-link"
				aria-label="Link to this section"
				title={copied ? 'Copied!' : 'Copy link to section'}
			>
				<Link class={iconSizes[2]} />
			</a>
		{/if}
	</h2>
{:else if level === 3}
	<h3 {id} class="prose-heading group {levelStyles[3]}">
		{@render children()}
		{#if id}
			<a
				href="#{id}"
				onclick={handleClick}
				class="prose-heading-link"
				aria-label="Link to this section"
				title={copied ? 'Copied!' : 'Copy link to section'}
			>
				<Link class={iconSizes[3]} />
			</a>
		{/if}
	</h3>
{:else}
	<h4 {id} class="prose-heading group {levelStyles[4]}">
		{@render children()}
		{#if id}
			<a
				href="#{id}"
				onclick={handleClick}
				class="prose-heading-link"
				aria-label="Link to this section"
				title={copied ? 'Copied!' : 'Copy link to section'}
			>
				<Link class={iconSizes[4]} />
			</a>
		{/if}
	</h4>
{/if}
