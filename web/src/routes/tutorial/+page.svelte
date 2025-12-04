<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
</script>

<svelte:head>
	<title>Tutorial - Redshift</title>
	<meta name="description" content="Step-by-step tutorial for getting started with Redshift" />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-12">
	<h1 class="mb-4 text-4xl font-bold">Getting Started Tutorial</h1>
	<p class="mb-12 text-xl text-muted-foreground">
		Learn how to set up Redshift and manage your first secrets in 5 minutes.
	</p>

	<div class="space-y-8">
		<!-- Step 1 -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
						>1</span
					>
					Install the CLI
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">
					First, install the Redshift CLI. You can use the install script or your package manager:
				</p>
				<pre
					class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm"># Using install script
curl -fsSL https://redshift.dev/install | sh

# Or with bun
bun add -g redshift</pre>
			</CardContent>
		</Card>

		<!-- Step 2 -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
						>2</span
					>
					Generate a Nostr Key (if needed)
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">
					Redshift uses Nostr keys for authentication. If you don't have one, you can generate it:
				</p>
				<pre
					class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm"># Generate a new key (save your nsec securely!)
nak key generate

# Or use a browser extension like Alby or nos2x</pre>
				<p class="text-sm text-destructive">
					Important: Never share your nsec (private key). Anyone with your nsec can access your
					secrets.
				</p>
			</CardContent>
		</Card>

		<!-- Step 3 -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
						>3</span
					>
					Login
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">
					Authenticate with your Nostr key. You have three options:
				</p>
				<pre
					class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm"># Interactive login (recommended)
redshift login

# Direct nsec (for scripting)
redshift login --nsec nsec1...

# Bunker URL (for remote signing)
redshift login --bunker "bunker://pubkey?relay=wss://relay.example&secret=..."</pre>
			</CardContent>
		</Card>

		<!-- Step 4 -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
						>4</span
					>
					Set Up Your Project
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">
					Navigate to your project directory and run setup to configure project and environment:
				</p>
				<pre
					class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">cd ~/my-project
redshift setup

# This creates a redshift.yaml file</pre>
			</CardContent>
		</Card>

		<!-- Step 5 -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
						>5</span
					>
					Add Your First Secret
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">Add secrets using the CLI:</p>
				<pre
					class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm"># Set a secret
redshift secrets set DATABASE_URL "postgres://user:pass@localhost/db"

# View all secrets
redshift secrets list

# Get a specific secret
redshift secrets get DATABASE_URL</pre>
			</CardContent>
		</Card>

		<!-- Step 6 -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
						>6</span
					>
					Run Your App with Secrets
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">
					Use <code class="rounded bg-muted px-1">redshift run</code> to inject secrets into your app:
				</p>
				<pre
					class="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm"># Run with secrets injected
redshift run -- npm start
redshift run -- python app.py
redshift run -- bun run dev</pre>
				<p class="text-muted-foreground">
					Your secrets are now available as environment variables in the child process!
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Next Steps -->
	<div class="mt-12 rounded-lg bg-card p-8 text-center">
		<h2 class="mb-4 text-2xl font-bold">Ready to manage secrets visually?</h2>
		<p class="mb-6 text-muted-foreground">Launch the admin dashboard for a graphical interface.</p>
		<div class="flex justify-center gap-4">
			<Button href="/admin" size="lg">Open Admin Dashboard</Button>
			<Button href="/docs" variant="outline" size="lg">View Full Docs</Button>
		</div>
	</div>
</div>
