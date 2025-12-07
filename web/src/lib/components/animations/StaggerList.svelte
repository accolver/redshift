<script lang="ts">
import { Motion } from 'svelte-motion';

interface Props {
	/** Base delay before first item animates */
	baseDelay?: number;
	/** Delay between each item */
	staggerDelay?: number;
	/** Animation duration for each item */
	duration?: number;
	/** Children content */
	children?: import('svelte').Snippet;
	/** Additional class */
	class?: string;
}

let {
	baseDelay = 0,
	staggerDelay = 0.05,
	duration = 0.3,
	children,
	class: className = '',
}: Props = $props();
</script>

<Motion
	initial="hidden"
	animate="visible"
	variants={{
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				delay: baseDelay,
				staggerChildren: staggerDelay,
				duration,
			},
		},
	}}
	let:motion
>
	<div use:motion class={className}>
		{@render children?.()}
	</div>
</Motion>
