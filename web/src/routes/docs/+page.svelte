<script lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
import CodeBlock from '$lib/components/CodeBlock.svelte';
</script>

<svelte:head>
	<title>Documentation - Redshift</title>
	<meta name="description" content="Redshift documentation and API reference" />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-12">
	<h1 class="mb-8 text-4xl font-bold">Documentation</h1>

	<section class="space-y-8">
		<Card>
			<CardHeader>
				<CardTitle>Installation</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">Install the Redshift CLI using the install script:</p>
				<CodeBlock code="curl -fsSL https://redshiftapp.com/install | sh" />

				<p class="text-muted-foreground">Or install with npm/bun:</p>
				<CodeBlock code="bun add -g redshift" />
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>CLI Commands</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="space-y-2">
					<h3 class="font-semibold">redshift login</h3>
					<p class="text-muted-foreground">
						Authenticate with your Nostr private key (nsec) or via NIP-46 bunker.
					</p>
					<CodeBlock code={`redshift login
redshift login --nsec nsec1...
redshift login --bunker "bunker://..."`} />
				</div>

				<div class="space-y-2">
					<h3 class="font-semibold">redshift setup</h3>
					<p class="text-muted-foreground">
						Configure a project and environment for the current directory.
					</p>
					<CodeBlock code="redshift setup" />
				</div>

				<div class="space-y-2">
					<h3 class="font-semibold">redshift run</h3>
					<p class="text-muted-foreground">
						Inject secrets into environment variables and run a command.
					</p>
					<CodeBlock code={`redshift run -- npm start
redshift run -- python app.py`} />
				</div>

				<div class="space-y-2">
					<h3 class="font-semibold">redshift secrets</h3>
					<p class="text-muted-foreground">Manage secrets for the current project/environment.</p>
					<CodeBlock code={`redshift secrets list
redshift secrets set API_KEY sk-...
redshift secrets get API_KEY
redshift secrets delete API_KEY`} />
				</div>

				<div class="space-y-2">
					<h3 class="font-semibold">redshift serve</h3>
					<p class="text-muted-foreground">Start the local web admin UI.</p>
					<CodeBlock code="redshift serve" />
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Environment Variables</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">Redshift supports these environment variables for CI/CD:</p>
				<ul class="list-inside list-disc space-y-2 text-muted-foreground">
					<li>
						<code class="rounded bg-muted px-1 text-foreground">REDSHIFT_NSEC</code> - Private key for authentication
					</li>
					<li>
						<code class="rounded bg-muted px-1 text-foreground">REDSHIFT_BUNKER</code> - Bunker URL for remote signing
					</li>
					<li>
						<code class="rounded bg-muted px-1 text-foreground">REDSHIFT_CONFIG_DIR</code> - Override config directory
					</li>
				</ul>
			</CardContent>
		</Card>
	</section>
</div>
