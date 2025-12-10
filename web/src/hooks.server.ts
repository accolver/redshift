/**
 * SvelteKit Server Hooks
 *
 * Handles CORS headers for API endpoints and other server-side middleware.
 */

import type { Handle } from '@sveltejs/kit';

/**
 * Allowed origins for CORS
 * In production, this should be restricted to your domains
 */
const ALLOWED_ORIGINS = [
	'https://redshiftapp.com',
	'https://www.redshiftapp.com',
	'http://localhost:5173', // Development
	'http://localhost:4173', // Preview
];

/**
 * Check if a request path is an API route
 */
function isApiRoute(pathname: string): boolean {
	return pathname.startsWith('/api/');
}

/**
 * Get CORS headers for a request
 */
function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin');

	// If origin is in allowed list, return it; otherwise return first allowed origin
	const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400', // 24 hours
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Handle CORS preflight requests for API routes
	if (isApiRoute(pathname) && event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: getCorsHeaders(event.request),
		});
	}

	// Process the request
	const response = await resolve(event);

	// Add CORS headers to API responses
	if (isApiRoute(pathname)) {
		const corsHeaders = getCorsHeaders(event.request);
		for (const [key, value] of Object.entries(corsHeaders)) {
			response.headers.set(key, value);
		}
	}

	return response;
};
