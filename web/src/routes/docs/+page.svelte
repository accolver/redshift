<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { ArrowRight, Key, Shield, Terminal, Globe } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Documentation - Redshift</title>
	<meta name="description" content="Learn how to use Redshift for decentralized, censorship-resistant secret management." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<!-- Hero -->
	<div class="mb-12">
		<h1 class="mb-4 text-4xl font-bold">Redshift Documentation</h1>
		<p class="text-lg text-muted-foreground">
			Learn how to use Redshift for decentralized, censorship-resistant secret management built on Nostr.
		</p>
	</div>

	<!-- Quick links -->
	<div class="mb-12 grid gap-4 sm:grid-cols-2">
		<a
			href="/docs/installation"
			class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-blue/50 hover:bg-card/80"
		>
			<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tokyo-blue/10 text-tokyo-blue">
				<Terminal class="size-5" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 font-semibold group-hover:text-tokyo-blue">Installation</h3>
				<p class="text-sm text-muted-foreground">Get Redshift up and running in under a minute.</p>
			</div>
			<ArrowRight class="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-tokyo-blue" />
		</a>

		<a
			href="/docs/quickstart"
			class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-purple/50 hover:bg-card/80"
		>
			<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tokyo-purple/10 text-tokyo-purple">
				<Key class="size-5" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 font-semibold group-hover:text-tokyo-purple">Quick Start</h3>
				<p class="text-sm text-muted-foreground">Create your first project and manage secrets.</p>
			</div>
			<ArrowRight class="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-tokyo-purple" />
		</a>

		<a
			href="/docs/what-is-nostr"
			class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-cyan/50 hover:bg-card/80"
		>
			<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tokyo-cyan/10 text-tokyo-cyan">
				<Globe class="size-5" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 font-semibold group-hover:text-tokyo-cyan">What is Nostr?</h3>
				<p class="text-sm text-muted-foreground">Understand the protocol that powers Redshift.</p>
			</div>
			<ArrowRight class="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-tokyo-cyan" />
		</a>

		<a
			href="/docs/why-redshift"
			class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-green/50 hover:bg-card/80"
		>
			<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tokyo-green/10 text-tokyo-green">
				<Shield class="size-5" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 font-semibold group-hover:text-tokyo-green">Why Redshift?</h3>
				<p class="text-sm text-muted-foreground">Compare with Doppler, Vault, and other solutions.</p>
			</div>
			<ArrowRight class="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-tokyo-green" />
		</a>
	</div>

	<!-- Overview -->
	<section class="prose prose-invert max-w-none">
		<h2>What is Redshift?</h2>
		<p>
			Redshift is a <strong>decentralized secret manager</strong> that lets you store and manage environment variables, API keys, and other sensitive configuration without trusting a centralized service.
		</p>

		<p>Built on the <a href="/docs/what-is-nostr">Nostr protocol</a>, Redshift offers:</p>

		<ul>
			<li><strong>Client-side encryption</strong> - Your secrets are encrypted before leaving your device</li>
			<li><strong>No vendor lock-in</strong> - Your data is stored on open relays you control</li>
			<li><strong>Censorship resistance</strong> - No single point of failure or control</li>
			<li><strong>Familiar workflow</strong> - Doppler-compatible CLI commands</li>
		</ul>

		<h2>How it works</h2>
		<p>Redshift uses your Nostr identity (a public/private key pair) to:</p>

		<ol>
			<li><strong>Authenticate</strong> - Prove you are who you say you are</li>
			<li><strong>Encrypt</strong> - Secure your secrets so only you can read them</li>
			<li><strong>Sign</strong> - Cryptographically sign your data to prevent tampering</li>
			<li><strong>Sync</strong> - Store encrypted data on multiple Nostr relays for redundancy</li>
		</ol>

		<p>
			When you run <code>redshift run -- npm start</code>, the CLI fetches your encrypted secrets from relays, decrypts them locally, and injects them as environment variables into your process.
		</p>

		<h2>Getting help</h2>
		<p>
			If you run into issues or have questions:
		</p>
		<ul>
			<li>Check the <a href="/docs/cli">CLI Reference</a> for command details</li>
			<li>Read about <a href="/docs/auth">Authentication options</a></li>
			<li>Open an issue on <a href="https://github.com/accolver/redshift" target="_blank" rel="noopener">GitHub</a></li>
		</ul>
	</section>
</div>
