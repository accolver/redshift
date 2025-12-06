<script lang="ts">
import { Shield, Lock, Globe, Key, Eye, Server } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Security Model - Redshift Docs</title>
	<meta name="description" content="Understanding Redshift's security model, encryption, and threat considerations." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">Security Model</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		How Redshift protects your secrets and what threats it defends against.
	</p>

	<section class="prose prose-invert max-w-none">
		<h2>Overview</h2>
		<p>
			Redshift is designed with a "zero trust" architecture. We assume that relay operators, network observers, and even the Redshift servers themselves could be compromised. Your secrets are protected through client-side encryption using keys only you control.
		</p>

		<div class="not-prose my-8 grid gap-4 sm:grid-cols-2">
			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Lock class="size-5 shrink-0 text-tokyo-blue" />
				<div>
					<p class="font-medium">Client-Side Encryption</p>
					<p class="text-sm text-muted-foreground">
						Secrets are encrypted before leaving your device
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Key class="size-5 shrink-0 text-tokyo-purple" />
				<div>
					<p class="font-medium">Your Keys Only</p>
					<p class="text-sm text-muted-foreground">
						Only you hold the keys to decrypt your data
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Shield class="size-5 shrink-0 text-tokyo-cyan" />
				<div>
					<p class="font-medium">Cryptographic Signatures</p>
					<p class="text-sm text-muted-foreground">
						All data is signed to prevent tampering
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Globe class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium">Decentralized Storage</p>
					<p class="text-sm text-muted-foreground">
						No single point of failure or control
					</p>
				</div>
			</div>
		</div>

		<h2>Encryption</h2>
		
		<h3>Data at Rest</h3>
		<p>
			Your secrets are encrypted using your Nostr private key before being stored on relays. The encryption uses:
		</p>
		<ul>
			<li><strong>NIP-44</strong> - Modern Nostr encryption standard</li>
			<li><strong>XChaCha20-Poly1305</strong> - Authenticated encryption</li>
			<li><strong>secp256k1 ECDH</strong> - Key derivation from your Nostr keypair</li>
		</ul>

		<p>
			What relay operators see:
		</p>
		<pre><code>{`{
  "kind": 30078,
  "pubkey": "your_public_key",
  "content": "encrypted_blob_they_cannot_read",
  "tags": [["d", "project-id|environment"]],
  "sig": "your_signature"
}`}</code></pre>

		<h3>Data in Transit</h3>
		<p>
			All communication with relays uses WebSocket Secure (WSS), providing TLS encryption for the transport layer. Combined with application-layer encryption, this means:
		</p>
		<ul>
			<li>Network observers see encrypted TLS traffic</li>
			<li>Relay operators see encrypted Nostr events</li>
			<li>Only you can decrypt the actual secret values</li>
		</ul>

		<h2>Key Management</h2>

		<h3>Browser Extension (NIP-07)</h3>
		<p>
			When using a browser extension like Alby:
		</p>
		<ul>
			<li>Your private key is stored in the extension's encrypted storage</li>
			<li>Redshift never sees your private key</li>
			<li>Each signing request requires extension approval (unless auto-approved)</li>
		</ul>

		<h3>nsec Direct Entry</h3>
		<p>
			When entering your nsec in the web admin:
		</p>
		<ul>
			<li>The nsec is encrypted with a non-extractable AES-256-GCM key</li>
			<li>The encryption key is stored in IndexedDB (browser-protected)</li>
			<li>The encrypted nsec is stored in sessionStorage (cleared on tab close)</li>
			<li>Decryption only happens in memory during signing operations</li>
		</ul>

		<h3>Bunker (NIP-46)</h3>
		<p>
			When using a bunker:
		</p>
		<ul>
			<li>Your private key stays on the bunker server</li>
			<li>Signing requests are encrypted end-to-end</li>
			<li>The relay cannot read signing requests or responses</li>
			<li>Security depends on the bunker's security</li>
		</ul>

		<h2>Threat Model</h2>

		<h3>What Redshift Protects Against</h3>
		<div class="not-prose my-6 space-y-3">
			<div class="flex items-start gap-3 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Compromised Relay Operators</p>
					<p class="text-sm text-muted-foreground">
						Relay operators cannot read your secrets - they only see encrypted blobs.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Network Eavesdropping</p>
					<p class="text-sm text-muted-foreground">
						Double encryption (TLS + Nostr) protects against network observers.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Service Shutdown</p>
					<p class="text-sm text-muted-foreground">
						Data is replicated across multiple relays. If one goes down, others have your data.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Data Tampering</p>
					<p class="text-sm text-muted-foreground">
						Cryptographic signatures ensure data integrity. Tampered events are rejected.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Account Termination</p>
					<p class="text-sm text-muted-foreground">
						No accounts to terminate. Your identity is a cryptographic key you control.
					</p>
				</div>
			</div>
		</div>

		<h3>What Redshift Does NOT Protect Against</h3>
		<div class="not-prose my-6 space-y-3">
			<div class="flex items-start gap-3 rounded-lg border border-tokyo-red/30 bg-tokyo-red/5 p-4">
				<Eye class="size-5 shrink-0 text-tokyo-red" />
				<div>
					<p class="font-medium text-tokyo-red">Compromised Device</p>
					<p class="text-sm text-muted-foreground">
						If your computer is compromised, an attacker could steal your private key or read decrypted secrets from memory.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-red/30 bg-tokyo-red/5 p-4">
				<Eye class="size-5 shrink-0 text-tokyo-red" />
				<div>
					<p class="font-medium text-tokyo-red">Lost Private Key</p>
					<p class="text-sm text-muted-foreground">
						If you lose your nsec with no backup, your secrets are permanently inaccessible. There is no recovery mechanism.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-red/30 bg-tokyo-red/5 p-4">
				<Eye class="size-5 shrink-0 text-tokyo-red" />
				<div>
					<p class="font-medium text-tokyo-red">Stolen Private Key</p>
					<p class="text-sm text-muted-foreground">
						If someone obtains your nsec, they have full access to your identity and all secrets.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-tokyo-red/30 bg-tokyo-red/5 p-4">
				<Eye class="size-5 shrink-0 text-tokyo-red" />
				<div>
					<p class="font-medium text-tokyo-red">Malicious Browser Extension</p>
					<p class="text-sm text-muted-foreground">
						A compromised NIP-07 extension could sign malicious events or leak your key.
					</p>
				</div>
			</div>
		</div>

		<h2>Best Practices</h2>

		<h3>Key Security</h3>
		<ul>
			<li><strong>Back up your nsec</strong> - Store it in a password manager or secure offline location</li>
			<li><strong>Use a unique key</strong> - Consider a dedicated Nostr identity for Redshift</li>
			<li><strong>Prefer extensions</strong> - NIP-07 extensions provide better key isolation</li>
			<li><strong>Use a bunker for CI/CD</strong> - Don't embed your main nsec in CI secrets</li>
		</ul>

		<h3>Device Security</h3>
		<ul>
			<li><strong>Keep devices updated</strong> - Apply security patches promptly</li>
			<li><strong>Use full-disk encryption</strong> - Protects data if device is stolen</li>
			<li><strong>Lock your screen</strong> - Don't leave sessions unattended</li>
			<li><strong>Avoid public computers</strong> - Never enter your nsec on untrusted devices</li>
		</ul>

		<h3>Operational Security</h3>
		<ul>
			<li><strong>Rotate secrets regularly</strong> - Change API keys and passwords periodically</li>
			<li><strong>Use separate environments</strong> - Don't use production secrets in development</li>
			<li><strong>Audit access</strong> - Review who has access to shared identities</li>
			<li><strong>Disconnect when done</strong> - End sessions explicitly</li>
		</ul>

		<h2>Open Source & Auditing</h2>
		<p>
			Redshift is open source. You can review the code, run your own instance, or audit the cryptographic implementations:
		</p>
		<ul>
			<li><a href="https://github.com/accolver/redshift" target="_blank" rel="noopener">GitHub Repository</a></li>
			<li>Encryption uses well-audited libraries (nostr-tools, @noble/hashes)</li>
			<li>No proprietary cryptography - standard Nostr NIPs only</li>
		</ul>

		<h2>Reporting Security Issues</h2>
		<p>
			If you discover a security vulnerability, please report it responsibly:
		</p>
		<ul>
			<li>Email: security@redshiftapp.com</li>
			<li>Do not disclose publicly until we've had a chance to address it</li>
			<li>We'll acknowledge receipt within 48 hours</li>
		</ul>
	</section>
</div>
