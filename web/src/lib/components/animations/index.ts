/**
 * Animation utilities and presets for Redshift UI
 *
 * Uses svelte-motion for smooth, physics-based animations
 */

// Fade in animation preset
export const fadeIn = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: 0.2 },
};

// Fade in with slight upward movement
export const fadeInUp = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -10 },
	transition: { duration: 0.2 },
};

// Fade in with slight downward movement
export const fadeInDown = {
	initial: { opacity: 0, y: -10 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: 10 },
	transition: { duration: 0.2 },
};

// Scale in animation (for cards, modals)
export const scaleIn = {
	initial: { opacity: 0, scale: 0.95 },
	animate: { opacity: 1, scale: 1 },
	exit: { opacity: 0, scale: 0.95 },
	transition: { duration: 0.15 },
};

// Slide in from left
export const slideInLeft = {
	initial: { opacity: 0, x: -20 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: -20 },
	transition: { duration: 0.2 },
};

// Slide in from right
export const slideInRight = {
	initial: { opacity: 0, x: 20 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: 20 },
	transition: { duration: 0.2 },
};

// Stagger children animation helper
export function staggerChildren(delayPerChild = 0.05) {
	return {
		animate: {
			transition: {
				staggerChildren: delayPerChild,
			},
		},
	};
}

// Create staggered item animation
export function staggerItem(index: number, baseDelay = 0, delayPerItem = 0.05) {
	return {
		initial: { opacity: 0, y: 10 },
		animate: {
			opacity: 1,
			y: 0,
			transition: {
				delay: baseDelay + index * delayPerItem,
				duration: 0.2,
			},
		},
		exit: { opacity: 0, y: -10 },
	};
}

// Spring transition for bouncy feel
export const springTransition = {
	type: 'spring',
	stiffness: 300,
	damping: 30,
};

// Smooth transition for subtle animations
export const smoothTransition = {
	type: 'tween',
	ease: 'easeOut',
	duration: 0.2,
};
