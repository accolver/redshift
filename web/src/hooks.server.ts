import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	if (event.url.pathname === '/') {
		response.headers.set(
			'Content-Security-Policy',
			[
				"default-src 'self'",
				"base-uri 'self'",
				"object-src 'none'",
				"script-src 'self'",
				"style-src 'self'",
				"font-src 'self'",
				"connect-src 'self'",
				"img-src 'self' data: https:",
				"form-action 'self'",
				"frame-ancestors 'none'",
				"require-trusted-types-for 'script'",
				"trusted-types 'none'",
				'upgrade-insecure-requests',
			].join('; '),
		);
	} else if (event.url.pathname.startsWith('/admin')) {
		response.headers.set(
			'Content-Security-Policy',
			[
				"default-src 'self'",
				"base-uri 'self'",
				"object-src 'none'",
				"script-src 'self' 'unsafe-inline'",
				"style-src 'self' 'unsafe-inline'",
				"font-src 'self'",
				"connect-src 'self' wss: https://relay.redshiftapp.com",
				"img-src 'self' data: https:",
				"form-action 'self'",
				"frame-ancestors 'none'",
				'upgrade-insecure-requests',
			].join('; '),
		);
	}

	response.headers.set('X-Robots-Tag', 'index, follow');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	return response;
};
