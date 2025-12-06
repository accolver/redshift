<script lang="ts">
import ProseHeading from '$lib/components/ProseHeading.svelte';
import { Globe, Key, Shield } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Authentication - Redshift Docs</title>
	<meta name="description" content="Learn about the different ways to authenticate with Redshift using your Nostr identity." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">Authentication</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Redshift uses your Nostr identity for authentication. Choose the method that best fits your security needs.
	</p>

	<section class="prose prose-invert max-w-none">
		<ProseHeading level={2} id="overview">Overview</ProseHeading>
		<p>
			Unlike traditional secret managers that use email/password or OAuth, Redshift authenticates using cryptographic keys. Your Nostr identity (a public/private key pair) is used to:
		</p>

		<ul>
			<li><strong>Prove your identity</strong> - Only you can sign messages with your private key</li>
			<li><strong>Encrypt your secrets</strong> - Data is encrypted so only you can read it</li>
			<li><strong>Access your data</strong> - Your public key identifies which data belongs to you</li>
		</ul>

		<ProseHeading level={2} id="authentication-methods">Authentication Methods</ProseHeading>
		<p>Redshift supports three authentication methods, each with different security trade-offs:</p>

		<div class="not-prose my-8 space-y-4">
			<a
				href="/docs/auth/extension"
				class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-blue/50"
			>
				<div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-tokyo-blue/10 text-tokyo-blue">
					<Globe class="size-6" />
				</div>
				<div class="flex-1">
					<h3 class="mb-1 font-semibold group-hover:text-tokyo-blue">Browser Extension (NIP-07)</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Use a browser extension like Alby or nos2x to sign requests. Your private key never leaves the extension.
					</p>
					<span class="inline-flex items-center rounded-full bg-tokyo-green/10 px-2 py-0.5 text-xs font-medium text-tokyo-green">
						Recommended
					</span>
				</div>
			</a>

			<a
				href="/docs/auth/nsec"
				class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-orange/50"
			>
				<div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-tokyo-orange/10 text-tokyo-orange">
					<Key class="size-6" />
				</div>
				<div class="flex-1">
					<h3 class="mb-1 font-semibold group-hover:text-tokyo-orange">Private Key (nsec)</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Enter your private key directly. Simple but requires careful handling of your key.
					</p>
					<span class="inline-flex items-center rounded-full bg-tokyo-orange/10 px-2 py-0.5 text-xs font-medium text-tokyo-orange">
						Use with caution
					</span>
				</div>
			</a>

			<a
				href="/docs/auth/bunker"
				class="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-tokyo-purple/50"
			>
				<div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-tokyo-purple/10 text-tokyo-purple">
					<Shield class="size-6" />
				</div>
				<div class="flex-1">
					<h3 class="mb-1 font-semibold group-hover:text-tokyo-purple">Bunker (NIP-46)</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Connect to a remote signing service. Great for CI/CD and advanced security setups.
					</p>
					<span class="inline-flex items-center rounded-full bg-tokyo-purple/10 px-2 py-0.5 text-xs font-medium text-tokyo-purple">
						Advanced
					</span>
				</div>
			</a>
		</div>

		<ProseHeading level={2} id="security-comparison">Security Comparison</ProseHeading>
		<div class="not-prose my-8 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Method</th>
						<th class="px-4 py-3 text-left font-medium">Key Storage</th>
						<th class="px-4 py-3 text-left font-medium">Best For</th>
						<th class="px-4 py-3 text-left font-medium">Risk Level</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr>
						<td class="px-4 py-3 font-medium">Extension</td>
						<td class="px-4 py-3 text-muted-foreground">Browser extension (encrypted)</td>
						<td class="px-4 py-3 text-muted-foreground">Daily use, web admin</td>
						<td class="px-4 py-3"><span class="text-tokyo-green">Low</span></td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-medium">nsec</td>
						<td class="px-4 py-3 text-muted-foreground">Encrypted in session storage</td>
						<td class="px-4 py-3 text-muted-foreground">Quick access, no extension</td>
						<td class="px-4 py-3"><span class="text-tokyo-orange">Medium</span></td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-medium">Bunker</td>
						<td class="px-4 py-3 text-muted-foreground">Remote server</td>
						<td class="px-4 py-3 text-muted-foreground">CI/CD, team sharing</td>
						<td class="px-4 py-3"><span class="text-tokyo-green">Low*</span></td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="text-sm text-muted-foreground">
			*Bunker security depends on how well the remote signer is secured.
		</p>

		<ProseHeading level={2} id="which-should-i-use">Which Should I Use?</ProseHeading>
		<ul>
			<li><strong>For most users:</strong> Use a <a href="/docs/auth/extension">browser extension</a> like Alby</li>
			<li><strong>For CLI-only usage:</strong> Use <a href="/docs/auth/nsec">nsec</a> with careful key management</li>
			<li><strong>For CI/CD pipelines:</strong> Use a <a href="/docs/auth/bunker">bunker</a> connection</li>
			<li><strong>For maximum security:</strong> Use a bunker with hardware signing</li>
		</ul>

		<ProseHeading level={2} id="creating-a-new-identity">Creating a New Identity</ProseHeading>
		<p>
			If you don't have a Nostr identity yet, you can create one in several ways:
		</p>

		<ul>
			<li><strong>Browser extension:</strong> Install <a href="https://getalby.com" target="_blank" rel="noopener">Alby</a> and it will generate keys for you</li>
			<li><strong>CLI:</strong> Run <code>redshift login</code> and select "Generate new identity"</li>
			<li><strong>Web:</strong> Click "Connect" in the Redshift admin and generate keys there</li>
		</ul>

		<div class="not-prose my-6 rounded-lg border border-tokyo-red/50 bg-tokyo-red/10 p-4">
			<p class="text-sm">
				<strong class="text-tokyo-red">Important:</strong> Back up your private key (nsec) immediately after creation. If you lose it, you lose access to all your secrets permanently. There is no recovery option.
			</p>
		</div>
	</section>
</div>
