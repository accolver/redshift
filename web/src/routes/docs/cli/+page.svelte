<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';

</script>

<svelte:head>
	<title>CLI Reference - Redshift Docs</title>
	<meta name="description" content="Complete reference for all Redshift CLI commands." />
</svelte:head>

<DocsPage title="CLI Reference" description="Complete reference for all Redshift CLI commands.">
		<ProseHeading level={2} id="global-options">Global Options</ProseHeading>
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
						<td class="px-4 py-3 font-sans text-muted-foreground">Show help for command</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--version, -v</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Show version number</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--json</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Output in JSON format</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--silent</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Disable info messages</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--debug</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Show debug output</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--config-dir &lt;path&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Override config directory (default: <InlineCode>~/.redshift</InlineCode>)</td>
					</tr>
				</tbody>
			</table>
		</div>

		<hr />

		<ProseHeading level={2} id="login">redshift login</ProseHeading>
		<p>Authenticate with your Nostr identity.</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--nsec &lt;nsec&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Nostr private key (nsec1...)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--bunker &lt;uri&gt;, -b</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">NIP-46 bunker URL</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--connect, -c</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Generate NostrConnect URI for bunker pairing</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--overwrite</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Overwrite existing token if one exists</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="login-subcommands">Subcommands</ProseHeading>
		<p>
			<InlineCode>login revoke</InlineCode> — Revoke auth token (alias for logout). Accepts <InlineCode>--yes</InlineCode> / <InlineCode>-y</InlineCode>.
		</p>

		<ProseHeading level={3} id="login-auth-methods">Authentication Methods</ProseHeading>
		<ol>
			<li><strong>Interactive</strong> — Run <InlineCode>redshift login</InlineCode> and you will be prompted for your nsec (hidden input).</li>
			<li><strong>Direct nsec</strong> — Pass the key directly with the <InlineCode>--nsec</InlineCode> flag.</li>
			<li><strong>NIP-46 Bunker</strong> — Use <InlineCode>--bunker "bunker://..."</InlineCode> (always quote the URL).</li>
			<li><strong>NostrConnect</strong> — Use <InlineCode>--connect</InlineCode> to generate a URI for bunker pairing.</li>
			<li><strong>Environment variables</strong> — Set <InlineCode>REDSHIFT_NSEC</InlineCode> or <InlineCode>REDSHIFT_BUNKER</InlineCode> to bypass interactive login.</li>
		</ol>

		<ProseHeading level={3} id="login-examples">Examples</ProseHeading>
		<CodeBlock language="bash" code={`# Interactive login (recommended)
redshift login

# Login with nsec
redshift login --nsec nsec1...

# Login via NIP-46 bunker
redshift login --bunker "bunker://pubkey?relay=wss://...&secret=..."

# Generate NostrConnect URI
redshift login --connect`} />

		<hr />

		<ProseHeading level={2} id="logout">redshift logout</ProseHeading>
		<p>Clear stored credentials (nsec from keychain and config file).</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--yes, -y</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Proceed without confirmation</td>
					</tr>
				</tbody>
			</table>
		</div>

		<hr />

		<ProseHeading level={2} id="me">redshift me</ProseHeading>
		<p>
			Display info about the currently authenticated identity. Shows auth method, public key (npub), and auth source. Also available as <InlineCode>redshift whoami</InlineCode>. Supports <InlineCode>--json</InlineCode>.
		</p>

		<hr />

		<ProseHeading level={2} id="setup">redshift setup</ProseHeading>
		<p>Configure project and environment for the current directory. Creates a <InlineCode>redshift.yaml</InlineCode> file.</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--project, -p</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Project name</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--config, -c</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Config/environment slug (e.g. dev, staging, prod)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--no-interactive</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Do not prompt; error if project/config not specified</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="setup-examples">Examples</ProseHeading>
		<CodeBlock language="bash" code={`# Interactive setup
redshift setup

# Direct setup
redshift setup -p my-app -c development

# CI/CD (no prompts)
redshift setup --no-interactive -p my-app -c production`} />

		<p>This creates a <InlineCode>redshift.yaml</InlineCode> file in the current directory:</p>
		<CodeBlock language="yaml" code={`project: my-app
config: development
relays:
  - wss://relay.damus.io
  - wss://relay.primal.net`} />

		<hr />

		<ProseHeading level={2} id="run">redshift run</ProseHeading>
		<p>Run a command with secrets injected as environment variables.</p>

		<CodeBlock language="bash" code={`redshift run [options] -- <command> [args...]`} />

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--command</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Command to execute (alternative to <InlineCode>--</InlineCode> syntax)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--project, -p</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Override project</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--config, -c</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Override config/environment</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--mount &lt;path&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Write secrets to an ephemeral file (accessible at <InlineCode>REDSHIFT_CLI_SECRETS_PATH</InlineCode>)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--mount-format &lt;fmt&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">File format for mount: <InlineCode>env</InlineCode> or <InlineCode>json</InlineCode> (default: <InlineCode>json</InlineCode>)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--fallback &lt;file&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Path to fallback file for offline mode</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--fallback-only</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Read all secrets from fallback file only</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--fallback-readonly</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Disable modifying the fallback file</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--no-fallback</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Disable reading/writing fallback file</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--forward-signals</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Forward signals to child process (default: true)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--preserve-env &lt;keys&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Comma-separated list of secrets where existing env value takes precedence</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="run-subcommands">Subcommands</ProseHeading>
		<p>
			<InlineCode>run clean</InlineCode> — Delete old fallback files.
		</p>

		<ProseHeading level={3} id="run-examples">Examples</ProseHeading>
		<CodeBlock language="bash" code={`# Run with secrets injected
redshift run -- npm start
redshift run -- python manage.py runserver

# Override environment
redshift run -c production -- npm run deploy

# Mount secrets to file
redshift run --mount secrets.json -- cat secrets.json
redshift run --mount .env --mount-format env -- ./start.sh

# Fallback for offline mode
redshift run --fallback ./fallback.json -- npm start
redshift run --fallback-only -- npm start

# Preserve existing env values
redshift run --preserve-env PORT,HOST -- npm start`} />

		<hr />

		<ProseHeading level={2} id="secrets">redshift secrets</ProseHeading>
		<p>Manage secrets. When run without a subcommand, defaults to listing secrets.</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--project, -p</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Override project</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--config, -c</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Override config/environment</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--only-names</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Only print secret names, omit values</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--raw</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Print raw secret values without redaction</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="secrets-get">secrets get</ProseHeading>
		<p>Get one or more secret values.</p>
		<CodeBlock language="bash" code={`redshift secrets get <KEY> [options]`} />
		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--plain</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Print values without formatting</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--copy</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Copy value(s) to clipboard</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--no-exit-on-missing-secret</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Do not exit if secret not found</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="secrets-set">secrets set</ProseHeading>
		<p>
			Set one or more secrets. Accepts <InlineCode>KEY VALUE</InlineCode> pairs or <InlineCode>KEY=VALUE</InlineCode> syntax.
		</p>
		<CodeBlock language="bash" code={`redshift secrets set <KEY> <VALUE>
redshift secrets set KEY=VALUE`} />
		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--no-interactive</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Do not allow interactive secret value entry</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="secrets-delete">secrets delete</ProseHeading>
		<p>Delete one or more secrets.</p>
		<CodeBlock language="bash" code={`redshift secrets delete <KEY> [options]`} />
		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--yes, -y</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Proceed without confirmation</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="secrets-download">secrets download</ProseHeading>
		<p>Download secrets in various formats.</p>
		<CodeBlock language="bash" code={`redshift secrets download [filepath] [options]`} />
		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--format &lt;type&gt;</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Output format: <InlineCode>json</InlineCode>, <InlineCode>env</InlineCode>, <InlineCode>yaml</InlineCode>, <InlineCode>docker</InlineCode>, <InlineCode>env-no-quotes</InlineCode> (default: <InlineCode>json</InlineCode>)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--no-file</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Print to stdout instead of file</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--passphrase</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Passphrase for encrypting the secrets file</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="secrets-upload">secrets upload</ProseHeading>
		<p>
			Upload a secrets file (default: <InlineCode>.env</InlineCode>). Parses .env format and merges with existing secrets on the relay.
		</p>
		<CodeBlock language="bash" code={`redshift secrets upload [filepath]`} />

		<ProseHeading level={3} id="secrets-examples">Examples</ProseHeading>
		<CodeBlock language="bash" code={`# List secrets
redshift secrets
redshift secrets --raw
redshift secrets --json
redshift secrets --only-names

# Get
redshift secrets get API_KEY
redshift secrets get API_KEY --plain
redshift secrets get API_KEY --copy

# Set
redshift secrets set API_KEY sk_live_xxx
redshift secrets set DB_URL 'postgres://...' REDIS_URL 'redis://...'

# Delete
redshift secrets delete OLD_KEY
redshift secrets delete KEY1 KEY2 -y

# Download
redshift secrets download ./secrets.json
redshift secrets download --format=env --no-file
redshift secrets download --format=env ./secrets.env

# Upload
redshift secrets upload .env
redshift secrets upload secrets.json`} />

		<hr />

		<ProseHeading level={2} id="configure">redshift configure</ProseHeading>
		<p>View and modify CLI configuration.</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--all</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Print all saved options</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={3} id="configure-subcommands">Subcommands</ProseHeading>
		<ul>
			<li><InlineCode>configure get [options...]</InlineCode> — Get specific config values.</li>
			<li><InlineCode>configure set key=value [...]</InlineCode> — Set config values. Allowed keys: <InlineCode>relays</InlineCode>, <InlineCode>defaultProject</InlineCode>, <InlineCode>defaultEnvironment</InlineCode>.</li>
			<li><InlineCode>configure unset key [...]</InlineCode> — Remove config values.</li>
			<li><InlineCode>configure reset --yes</InlineCode> — Reset configuration to initial state.</li>
		</ul>
		<p>
			Sensitive keys like <InlineCode>nsec</InlineCode> are blocked from being set via configure.
		</p>

		<hr />

		<ProseHeading level={2} id="serve">redshift serve</ProseHeading>
		<p>Start the web administration UI.</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--port, -p</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Port to listen on (default: <InlineCode>3000</InlineCode>)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--host, -H</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Host to bind to (default: <InlineCode>127.0.0.1</InlineCode>)</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--open, -o</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Open browser automatically</td>
					</tr>
				</tbody>
			</table>
		</div>

		<hr />

		<ProseHeading level={2} id="upgrade">redshift upgrade</ProseHeading>
		<p>
			Self-update the CLI binary from GitHub releases. Also available as <InlineCode>redshift update</InlineCode>.
		</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Flag</th>
						<th class="px-4 py-3 text-left font-medium">Description</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">--force, -f</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Force install even if already on latest version</td>
					</tr>
					<tr>
						<td class="px-4 py-3">--tag, -t</td>
						<td class="px-4 py-3 font-sans text-muted-foreground">Install a specific version (e.g. <InlineCode>v0.3.0</InlineCode>)</td>
					</tr>
				</tbody>
			</table>
		</div>

		<hr />

		<ProseHeading level={2} id="environment-variables">Environment Variables</ProseHeading>
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
						<td class="px-4 py-3 text-muted-foreground">Private key for CI/CD (bypasses interactive login)</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">REDSHIFT_BUNKER</td>
						<td class="px-4 py-3 text-muted-foreground">NIP-46 bunker URL for CI/CD</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono">REDSHIFT_CONFIG_DIR</td>
						<td class="px-4 py-3 text-muted-foreground">Override config directory (default: <InlineCode>~/.redshift</InlineCode>)</td>
					</tr>
				</tbody>
			</table>
		</div>

		<hr />

		<ProseHeading level={2} id="configuration-files">Configuration Files</ProseHeading>

		<ProseHeading level={3} id="global-config">~/.redshift/config.json</ProseHeading>
		<p>Global auth config containing nsec, bunker, auth method, relays, and defaults.</p>

		<ProseHeading level={3} id="project-config">redshift.yaml</ProseHeading>
		<p>Per-project config specifying the project name, config/environment, and relay URLs. Created by <InlineCode>redshift setup</InlineCode>.</p>

		<hr />

		<ProseHeading level={2} id="exit-codes">Exit Codes</ProseHeading>
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
</DocsPage>
