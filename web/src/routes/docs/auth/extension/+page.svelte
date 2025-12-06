<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import { CircleCheck } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Browser Extension Auth - Redshift Docs</title>
	<meta name="description" content="Authenticate with Redshift using a NIP-07 browser extension like Alby or nos2x." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	<h1 class="mb-4 text-4xl font-bold">Browser Extension (NIP-07)</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		The most secure way to authenticate with Redshift for everyday use.
	</p>

	<section class="prose prose-invert max-w-none">
		<ProseHeading level={2} id="what-is-nip-07">What is NIP-07?</ProseHeading>
		<p>
			NIP-07 is a Nostr standard that allows websites to request signatures from a browser extension without ever accessing your private key. The extension holds your key securely and signs requests on your behalf.
		</p>

		<p>This provides several security benefits:</p>
		<ul>
			<li>Your private key never leaves the extension</li>
			<li>You approve each signing request</li>
			<li>Malicious websites cannot steal your key</li>
			<li>Works across multiple Nostr apps</li>
		</ul>

		<ProseHeading level={2} id="recommended-extensions">Recommended Extensions</ProseHeading>
		<div class="not-prose my-6 space-y-4">
			<div class="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
				<div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#FFD84D]/10">
					<span class="text-2xl">🐝</span>
				</div>
				<div class="flex-1">
					<h3 class="mb-1 font-semibold">Alby</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Full-featured Nostr + Lightning wallet. Great for users who want an all-in-one solution.
					</p>
					<a href="https://getalby.com" target="_blank" rel="noopener" class="text-sm text-tokyo-blue hover:underline">
						Install Alby →
					</a>
				</div>
			</div>

			<div class="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
				<div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-tokyo-purple/10">
					<span class="text-2xl">🔐</span>
				</div>
				<div class="flex-1">
					<h3 class="mb-1 font-semibold">nos2x</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Lightweight, Nostr-only extension. Minimal and focused on key management.
					</p>
					<a href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp" target="_blank" rel="noopener" class="text-sm text-tokyo-blue hover:underline">
						Install nos2x →
					</a>
				</div>
			</div>

			<div class="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
				<div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-tokyo-orange/10">
					<span class="text-2xl">🦊</span>
				</div>
				<div class="flex-1">
					<h3 class="mb-1 font-semibold">nos2x-fox (Firefox)</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Firefox port of nos2x for Firefox users.
					</p>
					<a href="https://addons.mozilla.org/en-US/firefox/addon/nos2x-fox/" target="_blank" rel="noopener" class="text-sm text-tokyo-blue hover:underline">
						Install nos2x-fox →
					</a>
				</div>
			</div>
		</div>

		<ProseHeading level={2} id="setup-guide">Setup Guide</ProseHeading>

		<ProseHeading level={3} id="install-an-extension">1. Install an Extension</ProseHeading>
		<p>
			Install one of the extensions above. We recommend Alby for most users.
		</p>

		<ProseHeading level={3} id="create-or-import-keys">2. Create or Import Keys</ProseHeading>
		<p>
			When you first open the extension, you'll be prompted to either:
		</p>
		<ul>
			<li><strong>Generate new keys</strong> - Creates a fresh Nostr identity</li>
			<li><strong>Import existing keys</strong> - Use an nsec you already have</li>
		</ul>

		<div class="not-prose my-6 rounded-lg border border-tokyo-orange/50 bg-tokyo-orange/10 p-4">
			<p class="text-sm">
				<strong class="text-tokyo-orange">Important:</strong> Write down your nsec and store it securely (password manager, paper backup, etc.). This is the only way to recover your identity if you lose access to your browser.
			</p>
		</div>

		<ProseHeading level={3} id="connect-to-redshift">3. Connect to Redshift</ProseHeading>
		<p>
			With the extension installed, connecting to Redshift is automatic:
		</p>

		<p><strong>Web Admin:</strong></p>
		<ol>
			<li>Go to <a href="/admin">/admin</a></li>
			<li>Click "Connect"</li>
			<li>Select "Browser Extension"</li>
			<li>Approve the connection in your extension popup</li>
		</ol>

		<p><strong>CLI:</strong></p>
		<CodeBlock language="bash" code={`redshift login
# Select "NIP-07 Browser Extension"
# A browser window will open for approval`} />

		<ProseHeading level={2} id="how-it-works">How It Works</ProseHeading>
		<p>
			When Redshift needs to sign something (create a project, save secrets, etc.):
		</p>

		<ol>
			<li>Redshift creates an unsigned event</li>
			<li>It calls <InlineCode>window.nostr.signEvent(event)</InlineCode></li>
			<li>Your extension shows a popup asking for approval</li>
			<li>You click "Sign" (or the extension auto-approves if configured)</li>
			<li>The extension signs the event and returns it</li>
			<li>Redshift publishes the signed event to relays</li>
		</ol>

		<p>
			At no point does Redshift see your private key - only the signatures it produces.
		</p>

		<ProseHeading level={2} id="auto-approval">Auto-Approval (Optional)</ProseHeading>
		<p>
			Clicking "Approve" for every action can get tedious. Most extensions let you auto-approve requests from trusted domains:
		</p>

		<p><strong>In Alby:</strong></p>
		<ol>
			<li>Go to Settings → Connected Apps</li>
			<li>Find redshiftapp.com</li>
			<li>Enable "Auto-approve" or set a budget</li>
		</ol>

		<p><strong>In nos2x:</strong></p>
		<ol>
			<li>Click the extension icon</li>
			<li>Go to Permissions</li>
			<li>Set redshiftapp.com to "Allow"</li>
		</ol>

		<ProseHeading level={2} id="security-considerations">Security Considerations</ProseHeading>
		<div class="not-prose my-6 space-y-3">
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Private key never exposed to websites</span>
			</div>
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Per-site permission controls</span>
			</div>
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Easy to revoke access</span>
			</div>
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Works across multiple Nostr apps</span>
			</div>
		</div>

		<ProseHeading level={2} id="troubleshooting">Troubleshooting</ProseHeading>

		<ProseHeading level={3} id="no-nip-07-extension-found">"No NIP-07 extension found"</ProseHeading>
		<ul>
			<li>Make sure the extension is installed and enabled</li>
			<li>Refresh the page after installing</li>
			<li>Check if the extension is unlocked (some require a password)</li>
		</ul>

		<ProseHeading level={3} id="user-rejected-the-request">"User rejected the request"</ProseHeading>
		<ul>
			<li>You clicked "Deny" in the extension popup</li>
			<li>Try again and click "Allow" or "Sign"</li>
		</ul>

		<ProseHeading level={3} id="extension-popup-doesnt-appear">Extension popup doesn't appear</ProseHeading>
		<ul>
			<li>Click the extension icon in your toolbar to open it manually</li>
			<li>The popup might be blocked - check browser popup settings</li>
			<li>Try a different browser or extension</li>
		</ul>
	</section>
</div>
