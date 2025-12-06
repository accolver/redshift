<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
</script>

<svelte:head>
	<title>CLI Reference - Redshift Docs</title>
	<meta name="description" content="Complete reference for all Redshift CLI commands." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">CLI Reference</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Complete reference for all Redshift CLI commands.
	</p>

	<section class="prose prose-invert max-w-none">
		<h2>Global Options</h2>
		<p>These options are available for all commands:</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Option</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--help, -h</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Show help for a command</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--version, -v</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Show version number</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--config &lt;path&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Path to config file</td>
					</tr>
				</tbody>
			</table>
		</div>

		<hr />

		<h2 id="login">redshift login</h2>
		<p>Authenticate with your Nostr identity.</p>

		<CodeBlock code={`redshift login [options]

Options:
  --nsec <nsec>      Login with private key directly
  --bunker <uri>     Login via NIP-46 bunker
  --generate         Generate a new Nostr identity`} />

		<h3>Examples</h3>
		<CodeBlock code={`# Interactive login (recommended)
redshift login

# Login with nsec
redshift login --nsec nsec1...

# Login via bunker
redshift login --bunker "bunker://pubkey?relay=wss://...&secret=..."

# Generate new identity
redshift login --generate`} />

		<h3>Environment Variables</h3>
		<ul>
			<li><code>REDSHIFT_NSEC</code> - Private key for authentication</li>
			<li><code>REDSHIFT_BUNKER</code> - Bunker URI for remote signing</li>
		</ul>

		<hr />

		<h2 id="setup">redshift setup</h2>
		<p>Configure a project and environment for the current directory.</p>

		<CodeBlock code={`redshift setup [options]

Options:
  --project <name>       Project name or ID
  --environment <slug>   Environment slug (e.g., dev, staging, prod)`} />

		<h3>Examples</h3>
		<CodeBlock code={`# Interactive setup
redshift setup

# Direct setup
redshift setup --project my-app --environment development`} />

		<p>
			This creates a <code>.redshift.json</code> file in the current directory:
		</p>
		<CodeBlock code={`{
  "project": "my-app",
  "environment": "development"
}`} />

		<hr />

		<h2 id="run">redshift run</h2>
		<p>Inject secrets as environment variables and run a command.</p>

		<CodeBlock code={`redshift run [options] -- <command> [args...]

Options:
  --project <name>       Override project (instead of .redshift.json)
  --environment <slug>   Override environment
  --fallback <file>      Fallback .env file if secrets unavailable`} />

		<h3>Examples</h3>
		<CodeBlock code={`# Run with secrets
redshift run -- npm start
redshift run -- python manage.py runserver
redshift run -- go run main.go

# Override environment
redshift run --environment production -- npm run deploy

# Use fallback for offline development
redshift run --fallback .env.local -- npm start`} />

		<hr />

		<h2 id="secrets">redshift secrets</h2>
		<p>Manage secrets for a project/environment.</p>

		<h3>secrets list</h3>
		<p>List all secrets in the current environment.</p>
		<CodeBlock code={`redshift secrets list [options]

Options:
  --json       Output as JSON
  --keys-only  Only show key names, not values`} />

		<h3>secrets set</h3>
		<p>Set a secret value.</p>
		<CodeBlock code={`redshift secrets set <key> <value>

# Examples
redshift secrets set DATABASE_URL "postgres://localhost/mydb"
redshift secrets set API_KEY "sk-..."

# Read from stdin (for sensitive values)
echo "secret-value" | redshift secrets set API_KEY`} />

		<h3>secrets get</h3>
		<p>Get a single secret value.</p>
		<CodeBlock code={`redshift secrets get <key>

# Example
redshift secrets get DATABASE_URL`} />

		<h3>secrets delete</h3>
		<p>Delete a secret.</p>
		<CodeBlock code={`redshift secrets delete <key>

# Example
redshift secrets delete OLD_API_KEY`} />

		<h3>secrets import</h3>
		<p>Import secrets from a file.</p>
		<CodeBlock code={`redshift secrets import <file>

# Import from .env file
redshift secrets import .env

# Import from JSON
redshift secrets import secrets.json`} />

		<h3>secrets export</h3>
		<p>Export secrets to a file.</p>
		<CodeBlock code={`redshift secrets export [options]

Options:
  --format <type>   Output format: env, json, yaml (default: env)
  --output <file>   Write to file instead of stdout

# Examples
redshift secrets export > .env
redshift secrets export --format json > secrets.json`} />

		<hr />

		<h2 id="serve">redshift serve</h2>
		<p>Start the local web admin UI.</p>

		<CodeBlock code={`redshift serve [options]

Options:
  --port <port>   Port to listen on (default: 3000)
  --host <host>   Host to bind to (default: localhost)
  --open          Open browser automatically`} />

		<h3>Examples</h3>
		<CodeBlock code={`# Start server
redshift serve

# Custom port
redshift serve --port 8080

# Open browser automatically
redshift serve --open`} />

		<hr />

		<h2>Environment Variables</h2>
		<p>Redshift respects these environment variables:</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Variable</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr>
						<td class="px-4 py-3 font-mono">REDSHIFT_NSEC</td>
						<td class="px-4 py-3 text-muted-foreground">Private key for authentication</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">REDSHIFT_BUNKER</td>
						<td class="px-4 py-3 text-muted-foreground">Bunker URI for NIP-46 signing</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">REDSHIFT_CONFIG_DIR</td>
						<td class="px-4 py-3 text-muted-foreground">Override config directory location</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">REDSHIFT_RELAYS</td>
						<td class="px-4 py-3 text-muted-foreground">Comma-separated list of relay URLs</td>
					</tr>
				</tbody>
			</table>
		</div>

		<h2>Configuration Files</h2>
		
		<h3>.redshift.json (Project Config)</h3>
		<p>Located in your project directory, specifies which project/environment to use:</p>
		<CodeBlock code={`{
  "project": "my-app",
  "environment": "development"
}`} />

		<h3>~/.config/redshift/config.json (Global Config)</h3>
		<p>Global settings and cached credentials:</p>
		<CodeBlock code={`{
  "relays": [
    "wss://relay.damus.io",
    "wss://relay.primal.net"
  ],
  "defaultProject": "my-app"
}`} />

		<h2>Exit Codes</h2>
		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Code</th>
						<th class="px-4 py-3 text-left font-medium">Meaning</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr>
						<td class="px-4 py-3 font-mono">0</td>
						<td class="px-4 py-3 text-muted-foreground">Success</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">1</td>
						<td class="px-4 py-3 text-muted-foreground">General error</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">2</td>
						<td class="px-4 py-3 text-muted-foreground">Authentication required</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">3</td>
						<td class="px-4 py-3 text-muted-foreground">Project/environment not configured</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</div>
