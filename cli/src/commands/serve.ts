/**
 * Serve Command - Start web administration UI
 *
 * L5: Journey-Validator - Web UI serving workflow
 */

import { requireAuth } from './login';

export interface ServeOptions {
	port?: number;
	host?: string;
	open?: boolean;
}

// Placeholder HTML for the admin UI
// In production, this would be imported from the built SvelteKit app
const PLACEHOLDER_HTML = `<!DOCTYPE html>
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
      color: #9ece6a;
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
  </style>
</head>
<body>
  <div class="container">
    <h1>Redshift</h1>
    <p class="subtitle">Decentralized Secret Management</p>
    
    <div class="card">
      <p class="status">Server Running</p>
      <dl class="info">
        <dt>Public Key</dt>
        <dd id="npub">Loading...</dd>
        <dt>Listening On</dt>
        <dd id="address">Loading...</dd>
      </dl>
    </div>
    
    <p class="note">
      The full admin UI will be available once the SvelteKit app is built.
      <br><br>
      For now, use the CLI commands:<br>
      <code>redshift secrets list</code><br>
      <code>redshift secrets set KEY VALUE</code>
    </p>
  </div>
  
  <script>
    // Fetch server info
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
	const port = options.port || 3000;
	const host = options.host || '127.0.0.1';

	// Get auth info for display (optional for serve)
	let npub = 'Not logged in';
	try {
		const auth = await requireAuth();
		npub = auth.npub;
	} catch {
		console.log('Warning: Not logged in. Some features may be unavailable.');
	}

	const address = `http://${host}:${port}`;

	console.log('Starting Redshift Admin Server...');
	console.log('');

	const server = Bun.serve({
		port,
		hostname: host,

		fetch(req) {
			const url = new URL(req.url);

			// API endpoints
			if (url.pathname === '/api/info') {
				return Response.json({
					npub,
					address,
					version: '0.1.0',
				});
			}

			if (url.pathname === '/api/health') {
				return Response.json({ status: 'ok' });
			}

			// Serve the placeholder HTML for all other routes
			return new Response(PLACEHOLDER_HTML, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
				},
			});
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
	const { exec } = require('node:child_process');
	const platform = process.platform;

	let cmd: string;
	if (platform === 'darwin') {
		cmd = `open "${url}"`;
	} else if (platform === 'win32') {
		cmd = `start "${url}"`;
	} else {
		cmd = `xdg-open "${url}"`;
	}

	exec(cmd, (err: Error | null) => {
		if (err) {
			console.log(`Could not open browser automatically. Visit: ${url}`);
		}
	});
}
