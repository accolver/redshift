<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import { Shield, Server, Smartphone } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Bunker (NIP-46) Auth - Redshift Docs</title>
	<meta name="description" content="Authenticate with Redshift using a NIP-46 bunker for remote signing." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">Bunker (NIP-46)</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Connect to a remote signing service for enhanced security and automation.
	</p>

	<section class="prose prose-invert max-w-none">
		<ProseHeading level={2} id="what-is-a-bunker">What is a Bunker?</ProseHeading>
		<p>
			A bunker (defined in NIP-46) is a remote signing service that holds your private key and signs requests on your behalf. Instead of your key living in your browser or CLI, it stays securely on a separate server or device.
		</p>

		<p>Think of it like a hardware wallet for your Nostr identity - the key never leaves the secure environment, and all signing requests go through it.</p>

		<ProseHeading level={2} id="when-to-use-a-bunker">When to Use a Bunker</ProseHeading>
		<div class="not-prose my-6 grid gap-4 sm:grid-cols-2">
			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Server class="size-5 shrink-0 text-tokyo-blue" />
				<div>
					<p class="font-medium">CI/CD Pipelines</p>
					<p class="text-sm text-muted-foreground">
						Run builds that need secrets without embedding your nsec in environment variables.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Shield class="size-5 shrink-0 text-tokyo-purple" />
				<div>
					<p class="font-medium">Enhanced Security</p>
					<p class="text-sm text-muted-foreground">
						Keep your key on a hardened server or air-gapped device.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Smartphone class="size-5 shrink-0 text-tokyo-cyan" />
				<div>
					<p class="font-medium">Mobile Signing</p>
					<p class="text-sm text-muted-foreground">
						Use your phone as a signing device for desktop sessions.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Server class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium">Team Access</p>
					<p class="text-sm text-muted-foreground">
						Multiple team members can sign with a shared identity (with proper controls).
					</p>
				</div>
			</div>
		</div>

		<ProseHeading level={2} id="bunker-uri-format">Bunker URI Format</ProseHeading>
		<p>
			Bunker connections use a special URI format:
		</p>

		<CodeBlock language="bash" code={`bunker://<signer-pubkey>?relay=<relay-url>&secret=<connection-secret>

# Example:
bunker://3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d?relay=wss://relay.nsecbunker.com&secret=abc123`} />

		<p>The URI contains:</p>
		<ul>
			<li><strong>signer-pubkey</strong> - The public key of the bunker that will sign for you</li>
			<li><strong>relay</strong> - The relay used for communication between client and bunker</li>
			<li><strong>secret</strong> - A shared secret to authenticate the connection</li>
		</ul>

		<ProseHeading level={2} id="connecting-to-a-bunker">Connecting to a Bunker</ProseHeading>

		<ProseHeading level={3} id="web-admin">Web Admin</ProseHeading>
		<ol>
			<li>Go to <a href="/admin">/admin</a></li>
			<li>Click "Connect"</li>
			<li>Select "Bunker URL (NIP-46)"</li>
			<li>Paste your bunker URI</li>
			<li>Click "Connect"</li>
			<li>Approve the connection in your bunker app (if required)</li>
		</ol>

		<ProseHeading level={3} id="cli">CLI</ProseHeading>
		<CodeBlock language="bash" code={`# Interactive
redshift login
# Select "Use bunker URL"
# Paste your bunker URI

# Direct
redshift login --bunker "bunker://..."

# Environment variable (for CI/CD)
export REDSHIFT_BUNKER="bunker://..."
redshift secrets list`} />

		<ProseHeading level={2} id="popular-bunker-services">Popular Bunker Services</ProseHeading>

		<ProseHeading level={3} id="nsecbunker">nsecBunker</ProseHeading>
		<p>
			A popular self-hosted bunker solution. You can run it on your own server to maintain full control.
		</p>
		<a href="https://github.com/kind-0/nsecbunker" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			github.com/kind-0/nsecbunker →
		</a>

		<ProseHeading level={3} id="amber-android">Amber (Android)</ProseHeading>
		<p>
			An Android app that acts as a bunker, letting you sign requests on your phone.
		</p>
		<a href="https://github.com/greenart7c3/Amber" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			github.com/greenart7c3/Amber →
		</a>

		<ProseHeading level={2} id="self-hosting-a-bunker">Self-Hosting a Bunker</ProseHeading>
		<p>
			For maximum security, run your own bunker:
		</p>

		<CodeBlock language="bash" code={`# Clone nsecBunker
git clone https://github.com/kind-0/nsecbunker
cd nsecbunker

# Configure with your nsec
cp .env.example .env
# Edit .env with your settings

# Run
docker-compose up -d`} />

		<p>
			This gives you full control over the signing infrastructure while keeping your key off developer machines.
		</p>

		<ProseHeading level={2} id="cicd-integration">CI/CD Integration</ProseHeading>
		<p>
			Bunkers are ideal for CI/CD because you don't need to store your nsec in CI secrets:
		</p>

		<CodeBlock language="bash" code={`# GitHub Actions example
name: Deploy
on: push

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Redshift
        run: curl -fsSL https://redshiftapp.com/install | sh
        
      - name: Setup secrets
        env:
          REDSHIFT_BUNKER: \${{ secrets.REDSHIFT_BUNKER }}
        run: |
          redshift setup --project my-app --environment production
          redshift run -- npm run deploy`} />

		<p>
			The bunker can be configured to:
		</p>
		<ul>
			<li>Auto-approve requests from specific IPs</li>
			<li>Require manual approval via mobile app</li>
			<li>Limit signing to specific event kinds</li>
			<li>Rate limit requests</li>
		</ul>

		<ProseHeading level={2} id="how-it-works">How It Works</ProseHeading>
		<p>
			The NIP-46 flow:
		</p>

		<ol>
			<li>Redshift generates a temporary local key pair for the session</li>
			<li>It connects to the bunker via the specified relay</li>
			<li>When signing is needed, Redshift sends an encrypted request to the bunker</li>
			<li>The bunker decrypts the request, signs the event, and sends back the signature</li>
			<li>Redshift receives the signature and publishes the event</li>
		</ol>

		<p>
			All communication is encrypted end-to-end. The relay cannot read the signing requests or responses.
		</p>

		<ProseHeading level={2} id="security-considerations">Security Considerations</ProseHeading>
		<ul>
			<li><strong>Bunker security is critical</strong> - A compromised bunker means a compromised identity</li>
			<li><strong>Use HTTPS relays</strong> - Ensure the relay connection is encrypted</li>
			<li><strong>Rotate secrets</strong> - Periodically regenerate bunker connection secrets</li>
			<li><strong>Monitor usage</strong> - Watch for unexpected signing requests</li>
			<li><strong>Limit permissions</strong> - Configure the bunker to only allow necessary operations</li>
		</ul>

		<ProseHeading level={2} id="troubleshooting">Troubleshooting</ProseHeading>

		<ProseHeading level={3} id="failed-to-connect-to-bunker">"Failed to connect to bunker"</ProseHeading>
		<ul>
			<li>Check that the bunker service is running</li>
			<li>Verify the relay URL is correct and accessible</li>
			<li>Ensure the connection secret matches</li>
		</ul>

		<ProseHeading level={3} id="connection-timed-out">"Connection timed out"</ProseHeading>
		<ul>
			<li>The bunker may require manual approval - check your bunker app</li>
			<li>Network issues between client and relay</li>
			<li>Bunker server may be overloaded</li>
		</ul>

		<ProseHeading level={3} id="signing-request-rejected">"Signing request rejected"</ProseHeading>
		<ul>
			<li>The bunker may have permission restrictions</li>
			<li>Manual approval was denied</li>
			<li>Rate limiting triggered</li>
		</ul>
	</section>
</div>
