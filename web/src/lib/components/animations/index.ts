/**
 * Animation utilities and presets for Redshift UI
 *
 * Uses svelte-motion for smooth, physics-based animations
 * and Svelte actions for scroll-triggered animations
 */

import type { Action } from 'svelte/action';

/**
 * Svelte action for scroll-triggered animations using IntersectionObserver
 * Elements start hidden and animate in when they enter the viewport
 */
export const inView: Action<
	HTMLElement,
	{ threshold?: number; delay?: number; once?: boolean } | undefined
> = (node, options = {}) => {
	const { threshold = 0.2, delay = 0, once = true } = options;

	// Set initial state
	node.style.opacity = '0';
	node.style.transform = 'translateY(20px)';
	node.style.transition = `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.style.opacity = '1';
					node.style.transform = 'translateY(0)';
					if (once) {
						observer.unobserve(node);
					}
				} else if (!once) {
					node.style.opacity = '0';
					node.style.transform = 'translateY(20px)';
				}
			}
		},
		{ threshold },
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		},
		update(newOptions) {
			// Options are set at initialization, no dynamic updates needed
		},
	};
};

/**
 * Staggered in-view animation for lists
 * Apply to parent, children will animate with stagger delay
 */
export const inViewStagger: Action<
	HTMLElement,
	{ threshold?: number; baseDelay?: number; staggerDelay?: number; once?: boolean } | undefined
> = (node, options = {}) => {
	const { threshold = 0.2, baseDelay = 0, staggerDelay = 80, once = true } = options;

	const children = Array.from(node.children) as HTMLElement[];

	// Set initial state for all children
	for (const child of children) {
		child.style.opacity = '0';
		child.style.transform = 'translateY(20px)';
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					// Animate children with stagger
					children.forEach((child, i) => {
						const delay = baseDelay + i * staggerDelay;
						child.style.transition = `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`;
						// Use requestAnimationFrame to ensure transition is applied
						requestAnimationFrame(() => {
							child.style.opacity = '1';
							child.style.transform = 'translateY(0)';
						});
					});
					if (once) {
						observer.unobserve(node);
					}
				} else if (!once) {
					for (const child of children) {
						child.style.opacity = '0';
						child.style.transform = 'translateY(20px)';
					}
				}
			}
		},
		{ threshold },
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		},
	};
};

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
