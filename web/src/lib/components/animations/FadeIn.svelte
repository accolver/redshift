<script lang="ts">
import { Motion } from 'svelte-motion';

interface Props {
	/** Animation delay in seconds */
	delay?: number;
	/** Animation duration in seconds */
	duration?: number;
	/** Direction to animate from */
	direction?: 'up' | 'down' | 'left' | 'right' | 'none';
	/** Distance to animate (in pixels) */
	distance?: number;
	/** Children content */
	children?: import('svelte').Snippet;
	/** Additional class */
	class?: string;
}

let {
	delay = 0,
	duration = 0.3,
	direction = 'up',
	distance = 10,
	children,
	class: className = '',
}: Props = $props();

const getInitial = () => {
	const base = { opacity: 0 };
	switch (direction) {
		case 'up':
			return { ...base, y: distance };
		case 'down':
			return { ...base, y: -distance };
		case 'left':
			return { ...base, x: distance };
		case 'right':
			return { ...base, x: -distance };
		default:
			return base;
	}
};

const getAnimate = () => {
	const base = { opacity: 1 };
	if (direction === 'up' || direction === 'down') {
		return { ...base, y: 0 };
	}
	if (direction === 'left' || direction === 'right') {
		return { ...base, x: 0 };
	}
	return base;
};
</script>

<Motion
	initial={getInitial()}
	animate={getAnimate()}
	transition={{ duration, delay, ease: 'easeOut' }}
	let:motion
>
	<div use:motion class={className}>
		{@render children?.()}
	</div>
</Motion>
