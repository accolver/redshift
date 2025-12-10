// Root layout configuration for hybrid rendering:
// - Static pages (/, /pricing, /docs/*) are prerendered
// - Admin pages (/admin/*) are SPA (client-side rendered)
// - API routes (/api/*) are server endpoints on Cloudflare Workers
//
// Individual routes override these defaults as needed.
// See +layout.ts in /admin and /docs for route-specific settings.

// Don't prerender by default - let each route opt-in
export const prerender = false;

// Enable SSR by default for API routes to work
// Admin routes disable this in their own +layout.ts
export const ssr = true;
