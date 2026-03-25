import { DEFAULT_RELAYS } from '@redshift/crypto';
import { decodeContent, getEmbeddedFile, hasEmbeddedFiles } from '../lib/embedded-files';
import { tryAuth } from './login';

export interface ServeOptions {
	port?: number;
	host?: string;
	open?: boolean;
}

/**
 * SECURITY: Add security headers to all HTTP responses from the embedded server.
 *
 * - X-Frame-Options: DENY — prevents clickjacking by disallowing iframe embedding
 * - X-Content-Type-Options: nosniff — prevents MIME-type sniffing attacks
 * - X-XSS-Protection: 1; mode=block — enables browser XSS filtering
 * - Referrer-Policy: no-referrer — prevents leaking URLs to external sites
 * - Content-Security-Policy — restricts resource loading to same origin,
 *   allows inline styles (needed for embedded UI), and WebSocket connections
 *   for relay communication
 */
export function addSecurityHeaders(headers: Headers, isApiRoute: boolean): void {
	headers.set('X-Frame-Options', 'DENY');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('X-XSS-Protection', '1; mode=block');
	headers.set('Referrer-Policy', 'no-referrer');
	const relayConnectSrc = [...DEFAULT_RELAYS, 'wss://relay.redshiftapp.com'].join(' ');
	headers.set(
		'Content-Security-Policy',
		`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${relayConnectSrc};`,
	);

	// API routes should never be cached to prevent stale sensitive data
	if (isApiRoute) {
		headers.set('Cache-Control', 'no-store');
	}
}

/**
 * SECURITY: Validate that the request originates from localhost.
 * Blocks requests from external origins to prevent CSRF and data exfiltration.
 * Only allows requests from 127.0.0.1 and localhost origins.
 */
function isAllowedOrigin(req: Request, host: string, port: number): boolean {
	const origin = req.headers.get('origin');
	const path = new URL(req.url).pathname;

	// Exempt safe read-only API endpoints from origin checks (health/info monitoring)
	const SAFE_API_PATHS = new Set(['/api/health', '/api/info']);

	// API routes (except safe endpoints) require valid Origin or X-Redshift-Client header
	if (!origin && path.startsWith('/api/') && !SAFE_API_PATHS.has(path)) {
		// Allow requests with X-Redshift-Client header (for non-browser clients)
		return req.headers.has('x-redshift-client');
	}

	// No origin header means same-origin request (e.g., direct browser navigation)
	if (!origin) return true;

	const allowedOrigins = [
		`http://127.0.0.1:${port}`,
		`http://localhost:${port}`,
		`http://${host}:${port}`,
	];
	return allowedOrigins.includes(origin);
}

/**
 * SECURITY: Redact an npub to prevent full public key exposure on
 * unauthenticated endpoints. Shows first 12 and last 4 characters.
 * Example: "npub1abc12...wxyz"
 */
function redactNpub(npub: string): string {
	if (npub.length <= 16) return npub;
	return `${npub.slice(0, 12)}...${npub.slice(-4)}`;
}

// Fallback HTML when embedded files aren't available (dev mode)
const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redshift Admin</title>
  <style>
    :root {
      --background: #24283b;
      --foreground: #c0caf5;
      --primary: #7aa2f7;
      --card: #1a1b26;
      --border: #3b4261;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container {
      max-width: 600px;
      text-align: center;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #7aa2f7, #bb9af7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle {
      color: #565f89;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 1.5rem;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #f7768e;
      font-size: 0.875rem;
    }
    .status::before {
      content: '';
      width: 8px;
      height: 8px;
      background: currentColor;
      border-radius: 50%;
    }
    .info {
      text-align: left;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
      color: #7aa2f7;
    }
    .info dt {
      color: #565f89;
      margin-top: 1rem;
    }
    .info dd {
      margin-left: 0;
    }
    .note {
      font-size: 0.875rem;
      color: #565f89;
      margin-top: 2rem;
    }
    code {
      background: var(--card);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Redshift</h1>
    <p class="subtitle">Decentralized Secret Management</p>
    
    <div class="card">
      <p class="status">Admin UI Not Embedded</p>
      <dl class="info">
        <dt>Public Key</dt>
        <dd id="npub">Loading...</dd>
        <dt>Listening On</dt>
        <dd id="address">Loading...</dd>
      </dl>
    </div>
    
    <p class="note">
      The admin UI is not embedded in this binary.<br><br>
      To build with the embedded UI:<br>
      <code>bun run build:web</code><br>
      <code>bun run build:embeds</code><br>
      <code>bun run build:cli</code><br><br>
      For now, use the CLI commands:<br>
      <code>redshift secrets list</code><br>
      <code>redshift secrets set KEY VALUE</code>
    </p>
  </div>
  
  <script>
    fetch('/api/info')
      .then(r => r.json())
      .then(data => {
        document.getElementById('npub').textContent = data.npub;
        document.getElementById('address').textContent = data.address;
      })
      .catch(() => {
        document.getElementById('npub').textContent = 'Not authenticated';
      });
  </script>
</body>
</html>`;

/**
 * Execute the serve command.
 * Starts a local web server for the admin UI.
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
	// Lazy import to avoid module-level JSON import which can fail in some Bun versions
	const { VERSION } = await import('../version');
	const port = options.port || 3000;
	const host = options.host || '127.0.0.1';

	// Get auth info for display (optional for serve)
	let npub = 'Not logged in';
	const auth = await tryAuth();
	if (auth) {
		npub = auth.npub;
	} else {
		console.log('Warning: Not logged in. Some features may be unavailable.');
	}

	const address = `http://${host}:${port}`;
	const hasEmbeds = hasEmbeddedFiles();

	console.log('Starting Redshift Admin Server...');
	if (hasEmbeds) {
		console.log('Serving embedded admin UI.');
	} else {
		console.log('Warning: Admin UI not embedded. Run build:embeds first.');
	}
	console.log('');

	const server = Bun.serve({
		port,
		hostname: host,

		fetch(req) {
			const url = new URL(req.url);
			const path = url.pathname;

			// SECURITY: Reject requests from disallowed origins (CORS restriction)
			if (!isAllowedOrigin(req, host, port)) {
				const blockedHeaders = new Headers();
				addSecurityHeaders(blockedHeaders, true);
				return new Response('Forbidden', { status: 403, headers: blockedHeaders });
			}

			// API endpoints
			if (path === '/api/info') {
				const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
				addSecurityHeaders(responseHeaders, true);
				return new Response(
					JSON.stringify({
						// SECURITY: Redact npub to prevent full public key exposure
						// on this unauthenticated endpoint
						npub: redactNpub(npub),
						address,
						version: VERSION,
						embedded: hasEmbeds,
					}),
					{ headers: responseHeaders },
				);
			}

			if (path === '/api/health') {
				const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
				addSecurityHeaders(responseHeaders, true);
				return new Response(JSON.stringify({ status: 'ok' }), { headers: responseHeaders });
			}

			// If we have embedded files, serve them
			if (hasEmbeds) {
				// Try to find the file
				let file = getEmbeddedFile(path);

				// For SPA routing: if not found and not an asset, serve index.html
				if (!file && !path.includes('.')) {
					file = getEmbeddedFile('/');
				}

				if (file) {
					const content = decodeContent(file);
					const responseHeaders = new Headers({
						'Content-Type': file.contentType,
						'Cache-Control': path.includes('/_app/immutable/')
							? 'public, max-age=31536000, immutable'
							: 'public, max-age=0, must-revalidate',
					});
					addSecurityHeaders(responseHeaders, false);
					return new Response(content, { headers: responseHeaders });
				}

				// 404 for missing files
				const notFoundHeaders = new Headers();
				addSecurityHeaders(notFoundHeaders, false);
				return new Response('Not Found', { status: 404, headers: notFoundHeaders });
			}

			// Fallback: serve placeholder HTML
			const fallbackHeaders = new Headers({
				'Content-Type': 'text/html; charset=utf-8',
			});
			addSecurityHeaders(fallbackHeaders, false);
			return new Response(FALLBACK_HTML, { headers: fallbackHeaders });
		},
	});

	console.log(`  Local:   ${address}`);
	console.log(`  Network: http://${getNetworkAddress()}:${port}`);
	console.log('');
	console.log('Press Ctrl+C to stop the server.');

	// Open browser if requested
	if (options.open) {
		openBrowser(address);
	}

	// Keep the process running
	process.on('SIGINT', () => {
		console.log('\nShutting down...');
		server.stop();
		process.exit(0);
	});
}

/**
 * Get the network IP address for display.
 */
function getNetworkAddress(): string {
	try {
		const { networkInterfaces } = require('node:os');
		const nets = networkInterfaces();

		for (const name of Object.keys(nets)) {
			for (const net of nets[name] || []) {
				if (net.family === 'IPv4' && !net.internal) {
					return net.address;
				}
			}
		}
	} catch {
		// Ignore errors
	}
	return '0.0.0.0';
}

/**
 * Open the default browser to a URL.
 */
function openBrowser(url: string): void {
	const { spawn } = require('node:child_process');
	const platform = process.platform;

	let cmd: string;
	let args: string[];
	if (platform === 'darwin') {
		cmd = 'open';
		args = [url];
	} else if (platform === 'win32') {
		cmd = 'cmd';
		args = ['/c', 'start', url];
	} else {
		cmd = 'xdg-open';
		args = [url];
	}

	const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
	child.unref();
	child.on('error', () => {
		console.log(`Could not open browser automatically. Visit: ${url}`);
	});
}
