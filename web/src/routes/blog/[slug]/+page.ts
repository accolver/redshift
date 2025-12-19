import { error } from '@sveltejs/kit';
import { getPostBySlug, getAllPosts } from '$lib/blog/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const post = getPostBySlug(params.slug);

	if (!post) {
		error(404, {
			message: 'Post not found',
		});
	}

	return {
		post,
	};
};

/**
 * Prerender all blog posts for static generation
 */
export const prerender = true;

export function entries() {
	return getAllPosts().map((post) => ({
		slug: post.slug,
	}));
}
