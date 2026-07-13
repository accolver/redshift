<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';
</script>

<svelte:head>
	<title>Quick Start - Redshift Docs</title>
	<meta name="description" content="Get started with Redshift in 5 minutes." />
</svelte:head>

<DocsPage title="Quick Start" description="Create a project and manage secrets.">
	<ProseHeading level={2} id="install">1. Install the CLI</ProseHeading>
	<CodeBlock code="curl -fsSL https://redshiftapp.com/install | sh" language="bash" />
	<p>The verified installer supports Linux and macOS on x64 and arm64.</p>

	<ProseHeading level={2} id="authenticate">2. Authenticate</ProseHeading>
	<CodeBlock code={`redshift login
# Choose local nsec or NIP-46 authentication.
# Use redshift login --connect for client-initiated NostrConnect pairing.`} language="bash" />
	<p>
		NIP-07 is the preferred browser-dashboard method. It is not a CLI login option. Never share
		your nsec; anyone with it can access your secrets.
	</p>

	<ProseHeading level={2} id="setup-directory">3. Set Up Your Directory</ProseHeading>
	<CodeBlock code={`cd your-project
redshift setup
# Select or create a project and environment.
# Creates redshift.yaml`} language="bash" />
	<p>This creates <InlineCode>redshift.yaml</InlineCode> with identifiers, not secret values:</p>
	<CodeBlock code={`project: my-app
environment: development
relays:
  - wss://relay.damus.io`} language="yaml" />
	<p>
		<InlineCode>redshift.yaml</InlineCode> contains project, environment, and relay identifiers—not
		secret values. Decide whether to commit it according to the repository's environment policy.
	</p>

	<ProseHeading level={2} id="add-secrets">4. Add Secrets</ProseHeading>
	<CodeBlock code={`redshift secrets set DATABASE_URL "postgres://localhost/mydb"
redshift secrets set API_KEY "sk-..."
redshift secrets

# Values are redacted by default:
# DATABASE_URL  ********
# API_KEY       ********

# Reveal one value only with explicit acknowledgement:
redshift secrets get API_KEY --raw`} language="bash" />
	<p>
		Plaintext is displayed only when explicitly requested with <InlineCode>--raw</InlineCode>; keep
		raw output out of logs and captured terminals.
	</p>

	<ProseHeading level={2} id="run-application">5. Run Your Application</ProseHeading>
	<CodeBlock code={`redshift run -- npm start
redshift run -- python app.py
redshift run -- go run main.go`} language="bash" />
	<p>Secrets are injected into the child process environment and are not printed by Redshift.</p>

	<ProseHeading level={2} id="next-steps">Next Steps</ProseHeading>
	<ul>
		<li><a href="/docs/auth">Learn about authentication options</a></li>
		<li><a href="/docs/cli">Explore CLI commands</a></li>
		<li><a href="/docs/why-redshift">Understand Redshift's security model</a></li>
	</ul>
</DocsPage>
