<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
</script>

<svelte:head>
	<title>Quick Start - Redshift Docs</title>
	<meta name="description" content="Get started with Redshift in 5 minutes." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">Quick Start</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Create your first project and manage secrets in under 5 minutes.
	</p>

	<section class="prose prose-invert max-w-none">
		<ProseHeading level={2} id="authenticate">1. Authenticate</ProseHeading>
		<p>
			First, log in with your Nostr identity. If you don't have one, Redshift can generate one for you:
		</p>

		<CodeBlock code={`redshift login

# You'll see:
# ? Select authentication method
# > NIP-07 Browser Extension (recommended)
#   Enter nsec manually
#   Use bunker URL
#   Generate new identity`} language="bash" />

		<p>
			For most users, we recommend using a <strong>NIP-07 browser extension</strong> like 
			<a href="https://getalby.com" target="_blank" rel="noopener">Alby</a> or 
			<a href="https://github.com/nicefoster/nos2x" target="_blank" rel="noopener">nos2x</a>. 
			See the <a href="/docs/auth">Authentication docs</a> for all options.
		</p>

		<ProseHeading level={2} id="create-project">2. Create a Project</ProseHeading>
		<p>
			Projects organize your secrets. You might have one project per application:
		</p>

		<CodeBlock code={`# Using the web admin (opens browser)
redshift serve

# Or create directly via CLI
# Projects are created in the web admin for now`} language="bash" />

		<p>
			Visit <a href="/admin">/admin</a> to create projects and environments through the web interface.
		</p>

		<ProseHeading level={2} id="setup-directory">3. Set Up Your Directory</ProseHeading>
		<p>
			Link a directory to a project/environment:
		</p>

		<CodeBlock code={`cd your-project
redshift setup

# You'll be prompted to select:
# ? Select a project: my-app
# ? Select an environment: development
# 
# ✓ Created .redshift.json`} language="bash" />

		<p>
			This creates a <InlineCode>.redshift.json</InlineCode> file in your project:
		</p>

		<CodeBlock code={`{
  "project": "my-app",
  "environment": "development"
}`} language="json" />

		<div class="not-prose my-6 rounded-lg border border-tokyo-orange/50 bg-tokyo-orange/10 p-4">
			<p class="text-sm">
				<strong class="text-tokyo-orange">Tip:</strong> Add <InlineCode>.redshift.json</InlineCode> to your <InlineCode>.gitignore</InlineCode> if you want different environments per developer, or commit it to share the same environment across your team.
			</p>
		</div>

		<ProseHeading level={2} id="add-secrets">4. Add Secrets</ProseHeading>
		<p>
			Add secrets via the web admin or CLI:
		</p>

		<CodeBlock code={`# Via CLI
redshift secrets set DATABASE_URL "postgres://localhost/mydb"
redshift secrets set API_KEY "sk-..."
redshift secrets set STRIPE_SECRET "sk_test_..."

# List all secrets
redshift secrets list

# Output:
# DATABASE_URL  postgres://localhost/mydb
# API_KEY       sk-...
# STRIPE_SECRET sk_test_...`} language="bash" />

		<ProseHeading level={2} id="run-application">5. Run Your Application</ProseHeading>
		<p>
			Use <InlineCode>redshift run</InlineCode> to inject secrets as environment variables:
		</p>

		<CodeBlock code={`# Run any command with secrets injected
redshift run -- npm start
redshift run -- python app.py
redshift run -- go run main.go

# Secrets are available as environment variables
# process.env.DATABASE_URL, os.environ['API_KEY'], etc.`} language="bash" />

		<ProseHeading level={2} id="nodejs-example">Example: Node.js App</ProseHeading>
		<p>Here's a complete example for a Node.js application:</p>

		<CodeBlock code={`# 1. Install dependencies
npm init -y
npm install express

# 2. Create app
cat > index.js << 'EOF'
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({
    message: 'Hello!',
    hasApiKey: !!process.env.API_KEY,
    environment: process.env.NODE_ENV
  });
});

app.listen(3000, () => console.log('Server running on :3000'));
EOF

# 3. Set up Redshift
redshift setup  # Select your project/environment

# 4. Add secrets
redshift secrets set API_KEY "my-secret-key"
redshift secrets set NODE_ENV "development"

# 5. Run with secrets
redshift run -- node index.js`} language="bash" />

		<ProseHeading level={2} id="next-steps">Next Steps</ProseHeading>
		<ul>
			<li><a href="/docs/auth">Learn about authentication options</a></li>
			<li><a href="/docs/cli">Explore all CLI commands</a></li>
			<li><a href="/docs/why-redshift">Understand why Redshift vs. alternatives</a></li>
		</ul>
	</section>
</div>
