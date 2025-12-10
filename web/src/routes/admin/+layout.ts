// Admin routes are SPA (client-side rendered only)
// - Not prerendered (dynamic content based on auth state)
// - SSR disabled (requires browser APIs like IndexedDB for secure storage)
// - The SPA fallback in adapter-cloudflare handles client-side routing
export const prerender = false;
export const ssr = false;
