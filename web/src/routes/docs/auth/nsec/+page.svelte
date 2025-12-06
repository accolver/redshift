<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import { TriangleAlert, Shield } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Private Key (nsec) Auth - Redshift Docs</title>
	<meta name="description" content="Authenticate with Redshift by entering your Nostr private key (nsec) directly." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	<h1 class="mb-4 text-4xl font-bold">Private Key (nsec)</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Authenticate by entering your Nostr private key directly.
	</p>

	<div class="not-prose mb-8 rounded-lg border border-tokyo-orange/50 bg-tokyo-orange/10 p-4">
		<div class="flex gap-3">
			<TriangleAlert class="size-5 shrink-0 text-tokyo-orange" />
			<div class="text-sm">
				<p class="font-medium text-tokyo-orange">Security Warning</p>
				<p class="text-foreground/80">
					Your private key (nsec) provides full access to your Nostr identity and all your secrets. 
					Only enter it on trusted devices. Consider using a <a href="/docs/auth/extension" class="text-tokyo-blue hover:underline">browser extension</a> for better security.
				</p>
			</div>
		</div>
	</div>

	<section class="prose prose-invert max-w-none">
		<ProseHeading level={2} id="when-to-use-nsec">When to Use nsec</ProseHeading>
		<p>
			Entering your nsec directly is useful when:
		</p>
		<ul>
			<li>You don't have a browser extension installed</li>
			<li>You're on a trusted device with no extension support</li>
			<li>You're testing or developing locally</li>
			<li>You need quick access without extension setup</li>
		</ul>

		<ProseHeading level={2} id="web-admin">Web Admin</ProseHeading>
		<p>To authenticate with nsec in the web admin:</p>
		<ol>
			<li>Go to <a href="/admin">/admin</a></li>
			<li>Click "Connect"</li>
			<li>Select "Private Key (nsec)"</li>
			<li>Enter your nsec (starts with <InlineCode>nsec1...</InlineCode>)</li>
			<li>Click "Connect"</li>
		</ol>

		<ProseHeading level={2} id="cli">CLI</ProseHeading>
		<p>To authenticate via command line:</p>

		<CodeBlock language="bash" code={`# Interactive login
redshift login
# Select "Enter nsec manually"
# Paste your nsec when prompted

# Direct login (use with caution - visible in shell history)
redshift login --nsec nsec1...

# Via environment variable (safer for scripts)
export REDSHIFT_NSEC=nsec1...
redshift secrets list`} />

		<ProseHeading level={2} id="key-formats">Key Formats</ProseHeading>
		<p>Redshift accepts private keys in two formats:</p>

		<ProseHeading level={3} id="bech32-nsec">Bech32 (nsec)</ProseHeading>
		<p>The standard Nostr format, starts with <InlineCode>nsec1</InlineCode>:</p>
		<CodeBlock code="nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5" language="text" />

		<ProseHeading level={3} id="hex">Hex</ProseHeading>
		<p>Raw 64-character hexadecimal:</p>
		<CodeBlock code="67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa" language="text" />

		<ProseHeading level={2} id="how-we-protect-your-key">How We Protect Your Key</ProseHeading>
		<p>
			When you enter your nsec in the web admin, Redshift takes several steps to protect it:
		</p>

		<div class="not-prose my-6 space-y-4">
			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Shield class="size-5 shrink-0 text-tokyo-blue" />
				<div>
					<p class="font-medium leading-5">Encrypted Storage</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Your nsec is encrypted with a non-extractable AES-256-GCM key before storage. The encryption key lives in IndexedDB and cannot be exported.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Shield class="size-5 shrink-0 text-tokyo-purple" />
				<div>
					<p class="font-medium leading-5">Session Storage</p>
					<p class="mt-1 text-sm text-muted-foreground">
						The encrypted nsec is stored in sessionStorage, which is automatically cleared when you close the browser tab.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Shield class="size-5 shrink-0 text-tokyo-cyan" />
				<div>
					<p class="font-medium leading-5">Local Signing</p>
					<p class="mt-1 text-sm text-muted-foreground">
						All signing happens locally in your browser. Your decrypted key is only held in memory during signing operations.
					</p>
				</div>
			</div>
		</div>

		<ProseHeading level={2} id="security-best-practices">Security Best Practices</ProseHeading>
		<ul>
			<li><strong>Use a dedicated key</strong> - Consider generating a key just for Redshift, separate from your main Nostr identity</li>
			<li><strong>Avoid public computers</strong> - Never enter your nsec on shared or untrusted devices</li>
			<li><strong>Use incognito mode</strong> - For extra caution, use a private browsing window</li>
			<li><strong>Don't store in plain text</strong> - Use a password manager for your nsec backup</li>
			<li><strong>Clear when done</strong> - Click "Disconnect" to clear your session</li>
		</ul>

		<ProseHeading level={2} id="generating-a-new-key">Generating a New Key</ProseHeading>
		<p>
			If you need a new Nostr identity for Redshift:
		</p>

		<CodeBlock language="bash" code={`# Using the Redshift CLI
redshift login
# Select "Generate new identity"

# Using nostr-tools (Node.js)
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { nsecEncode, npubEncode } from 'nostr-tools/nip19'

const sk = generateSecretKey()
const pk = getPublicKey(sk)

console.log('nsec:', nsecEncode(sk))
console.log('npub:', npubEncode(pk))`} />

		<div class="not-prose my-6 rounded-lg border border-tokyo-red/50 bg-tokyo-red/10 p-4">
			<p class="text-sm">
				<strong class="text-tokyo-red">Critical:</strong> Immediately back up your new nsec in a secure location. 
				If you lose it, you permanently lose access to all secrets encrypted with this identity. There is no recovery.
			</p>
		</div>

		<ProseHeading level={2} id="cli-environment-variables">CLI Environment Variables</ProseHeading>
		<p>
			For automation and CI/CD, you can provide credentials via environment variables:
		</p>

		<CodeBlock language="bash" code={`# Set nsec via environment variable
export REDSHIFT_NSEC="nsec1..."

# Now all commands use this identity
redshift secrets list
redshift run -- npm start`} />

		<p>
			This is more secure than passing <InlineCode>--nsec</InlineCode> on the command line, which may be visible in shell history or process listings.
		</p>

		<ProseHeading level={2} id="migrating-to-a-browser-extension">Migrating to a Browser Extension</ProseHeading>
		<p>
			If you've been using nsec directly and want to upgrade to a more secure setup:
		</p>

		<ol>
			<li>Install a <a href="/docs/auth/extension">browser extension</a> like Alby</li>
			<li>Import your existing nsec into the extension</li>
			<li>Disconnect from Redshift (click "Disconnect")</li>
			<li>Reconnect using the "Browser Extension" option</li>
		</ol>

		<p>
			Your data remains the same since it's tied to your public key, not the authentication method.
		</p>
	</section>
</div>
