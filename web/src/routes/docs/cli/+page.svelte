<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';
</script>

<svelte:head>
	<title>CLI Reference - Redshift Docs</title>
	<meta name="description" content="Reference for the supported Redshift CLI contract." />
</svelte:head>

<DocsPage title="CLI Reference" description="The supported Redshift CLI contract. Unknown commands and flags fail instead of being silently ignored.">
	<ProseHeading level={2} id="global-options">Global options</ProseHeading>
	<ul>
		<li><InlineCode>--help, -h</InlineCode> — show command help</li>
		<li><InlineCode>--version, -v</InlineCode> — show the compiled CLI version</li>
		<li><InlineCode>--config-dir &lt;path&gt;</InlineCode> — override the CLI configuration directory</li>
	</ul>

	<hr />

	<ProseHeading level={2} id="login">redshift login</ProseHeading>
	<p>Authenticate with a local nsec or a NIP-46 remote signer.</p>
	<CodeBlock language="bash" code={`# Hidden interactive nsec entry
redshift login

# Direct options (avoid --nsec in shared shell history)
redshift login --nsec nsec1...
redshift login --bunker 'bunker://...?relay=wss://...'
redshift login --bunker-stdin
redshift login --connect

# Non-persistent CI authentication
REDSHIFT_NSEC=nsec1... redshift me`} />
	<p>
		Use <InlineCode>--overwrite</InlineCode> to replace existing stored credentials. A one-time
		bunker pairing secret is never written back into the saved bunker pointer.
	</p>

	<ProseHeading level={2} id="logout">redshift logout</ProseHeading>
	<p>Remove Redshift credentials from supported secure storage and sanitized CLI configuration.</p>

	<ProseHeading level={2} id="me">redshift me</ProseHeading>
	<p>Show the current public identity and authentication source. <InlineCode>redshift whoami</InlineCode> is an alias.</p>

	<hr />

	<ProseHeading level={2} id="setup">redshift setup</ProseHeading>
	<p>Create or replace <InlineCode>redshift.yaml</InlineCode> for the current directory.</p>
	<CodeBlock language="bash" code={`# Interactive
redshift setup

# Deterministic CI setup
redshift setup --project my-app --config production --no-interactive

# Replace an existing file intentionally
redshift setup --project my-app --config staging --force`} />
	<p>
		Non-interactive mode uses supplied values or documented defaults and never implies overwrite.
		Project and environment slugs are validated before the file is written.
	</p>

	<hr />

	<ProseHeading level={2} id="run">redshift run</ProseHeading>
	<p>
		Fetch the latest authorized bundle, inject it into a hardened child environment, preserve exact
		argument boundaries, and forward <InlineCode>SIGINT</InlineCode>, <InlineCode>SIGTERM</InlineCode>,
		and <InlineCode>SIGHUP</InlineCode>.
	</p>
	<CodeBlock language="bash" code={`# Exact argv mode; no shell reparsing
redshift run -- npm start
redshift run -- ./script --literal 'space value' ''

# Explicit shell mode when shell syntax is required
redshift run --command 'npm run build && npm start'

# Existing environment values win for selected names
redshift run --preserve-env PORT,HOST -- npm start

# Override configured context
redshift run --project my-app --config production -- ./deploy`} />
	<p>
		Redshift authentication variables and runtime-hook variables are removed from the child environment.
		Use either positional argv after <InlineCode>--</InlineCode> or <InlineCode>--command</InlineCode>, never both.
	</p>

	<hr />

	<ProseHeading level={2} id="secrets">redshift secrets</ProseHeading>
	<p>
		Manage one secret at a time. Values are redacted unless <InlineCode>--raw</InlineCode> explicitly
		acknowledges plaintext output.
	</p>
	<CodeBlock language="bash" code={`# Redacted listing and retrieval
redshift secrets
redshift secrets --json
redshift secrets get API_KEY

# Explicit plaintext (keep stdout out of logs/history)
redshift secrets --raw
redshift secrets --json --raw
redshift secrets get API_KEY --raw

# Mutations
redshift secrets set API_KEY 'sk_live_xxx'
redshift secrets set API_KEY=sk_live_xxx
redshift secrets delete API_KEY

# Plaintext .env export requires --raw
redshift secrets download --raw ./secrets.env
redshift secrets download --raw

# Merge a .env file
redshift secrets upload .env`} />
	<p>
		Secret deletion publishes a newer encrypted empty/update bundle. It removes the key from current
		Redshift state but cannot erase historical ciphertext already retained by relays or backups.
	</p>

	<hr />

	<ProseHeading level={2} id="configure">redshift configure</ProseHeading>
	<p>Inspect or atomically modify non-secret CLI configuration.</p>
	<CodeBlock language="bash" code={`redshift configure
redshift configure relays
redshift configure get relays
redshift configure set relays='["wss://relay.damus.io","wss://nos.lol"]'
redshift configure unset relays
redshift configure reset --yes`} />
	<p>
		Relay URLs must use <InlineCode>wss://</InlineCode>, except loopback development relays may use
		<InlineCode>ws://</InlineCode>. Configuration output redacts credential-bearing fields.
	</p>

	<ProseHeading level={2} id="serve">redshift serve</ProseHeading>
	<p>Serve the embedded dashboard locally.</p>
	<CodeBlock language="bash" code={`redshift serve
redshift serve --host 127.0.0.1 --port 3000
redshift serve --open`} />

	<ProseHeading level={2} id="bunker">redshift bunker</ProseHeading>
	<p>
		Run or inspect the local NIP-46 signer prototype. Plaintext key mode requires the explicit
		<InlineCode>--insecure-plaintext-keys</InlineCode> acknowledgement.
	</p>
	<CodeBlock language="bash" code={`redshift bunker start
redshift bunker status`} />

	<ProseHeading level={2} id="upgrade">redshift upgrade</ProseHeading>
	<p>
		Download a Linux/macOS release and replace the current binary only after GitHub build-provenance
		attestation verification succeeds. A current GitHub CLI is required.
	</p>
	<CodeBlock language="bash" code={`redshift upgrade
redshift upgrade --tag v0.10.0
redshift upgrade --force`} />
</DocsPage>
