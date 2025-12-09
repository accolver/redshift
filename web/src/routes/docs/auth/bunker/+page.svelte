<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';
import { Shield, Server, Smartphone, Users, Building2, Zap, Globe, Terminal, AlertTriangle } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Bunker (NIP-46) Auth - Redshift Docs</title>
	<meta name="description" content="Authenticate with Redshift using a NIP-46 bunker for remote signing." />
</svelte:head>

<DocsPage title="Bunker (NIP-46)" description="Connect to a remote signing service for enhanced security and automation.">
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
					<p class="font-medium leading-5">CI/CD Pipelines</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Run builds that need secrets without embedding your nsec in environment variables.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Shield class="size-5 shrink-0 text-tokyo-purple" />
				<div>
					<p class="font-medium leading-5">Enhanced Security</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Keep your key on a hardened server or air-gapped device.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Smartphone class="size-5 shrink-0 text-tokyo-cyan" />
				<div>
					<p class="font-medium leading-5">Mobile Signing</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Use your phone as a signing device for desktop sessions.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
				<Users class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium leading-5">Team Access</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Multiple team members can sign with a shared identity (with proper controls).
					</p>
				</div>
			</div>
		</div>

		<ProseHeading level={2} id="choosing-a-bunker">Choosing a Bunker Strategy</ProseHeading>
		<p>
			The right bunker depends on your use case. Here's our recommendation matrix:
		</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Solution</th>
						<th class="px-4 py-3 text-left font-medium">Best For</th>
						<th class="px-4 py-3 text-left font-medium">Setup Time</th>
						<th class="px-4 py-3 text-left font-medium">Platform</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr class="bg-tokyo-green/10">
						<td class="px-4 py-3 font-medium">
							<span class="flex items-center gap-2">
								nak bunker
								<span class="rounded-full bg-tokyo-green px-2 py-0.5 text-xs font-medium text-white">Recommended</span>
							</span>
						</td>
						<td class="px-4 py-3 text-muted-foreground">Teams, CI/CD, self-hosted</td>
						<td class="px-4 py-3 text-muted-foreground">2 min</td>
						<td class="px-4 py-3 text-muted-foreground">macOS, Linux, Windows</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-medium">nsec.app</td>
						<td class="px-4 py-3 text-muted-foreground">Personal use, cross-platform</td>
						<td class="px-4 py-3 text-muted-foreground">1 min</td>
						<td class="px-4 py-3 text-muted-foreground">Web, iOS, Android</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-medium">Amber</td>
						<td class="px-4 py-3 text-muted-foreground">Mobile-first users</td>
						<td class="px-4 py-3 text-muted-foreground">5 min</td>
						<td class="px-4 py-3 text-muted-foreground">Android only</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Teams & Enterprise Recommendation -->
		<div class="not-prose my-8 rounded-lg border-2 border-tokyo-green bg-tokyo-green/5 p-6">
			<div class="flex items-start gap-4">
				<Building2 class="size-8 shrink-0 text-tokyo-green" />
				<div>
					<h3 class="text-lg font-semibold text-tokyo-green">Recommended for Teams & Enterprise</h3>
					<p class="mt-2 text-muted-foreground">
						For organizations using <strong>Redshift Teams</strong> or <strong>Enterprise SSO</strong>, 
						we recommend <strong>nak bunker</strong> deployed on your own infrastructure. It provides:
					</p>
					<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<Shield class="size-4 text-tokyo-green" />
							<span>Self-hosted with no external dependencies</span>
						</li>
						<li class="flex items-center gap-2">
							<Server class="size-4 text-tokyo-green" />
							<span>Persistent configuration across restarts</span>
						</li>
						<li class="flex items-center gap-2">
							<Users class="size-4 text-tokyo-green" />
							<span>Authorized client pubkeys for team access</span>
						</li>
						<li class="flex items-center gap-2">
							<Building2 class="size-4 text-tokyo-green" />
							<span>Run in secure enclaves for compliance requirements</span>
						</li>
					</ul>
					<a href="#nak-bunker" class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-tokyo-green hover:underline">
						Jump to Setup Guide →
					</a>
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

# NostrConnect flow (scan QR with bunker app)
redshift login --connect

# Environment variable (for CI/CD)
export REDSHIFT_BUNKER="bunker://..."
redshift secrets list`} />

		<ProseHeading level={2} id="bunker-options">Bunker Options</ProseHeading>

		<!-- Option 1: nak (RECOMMENDED) -->
		<ProseHeading level={3} id="nak-bunker">nak bunker (Teams & CI/CD)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border-2 border-tokyo-green bg-tokyo-green/5 p-4">
			<Terminal class="size-5 shrink-0 text-tokyo-green" />
			<div>
				<p class="flex items-center gap-2 font-medium">
					Best for: Teams, CI/CD pipelines, self-hosted infrastructure
					<span class="rounded-full bg-tokyo-green px-2 py-0.5 text-xs font-medium text-white">Recommended</span>
				</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The "nostr army knife" CLI includes a production-ready bunker server with no external dependencies.
				</p>
			</div>
		</div>

		<p>
			<strong>Why nak bunker for Teams?</strong>
		</p>
		<ul>
			<li><strong>Self-contained</strong> - No external services to rely on, fully self-hosted</li>
			<li><strong>Persistent configuration</strong> - Survives restarts with <code>--persist</code></li>
			<li><strong>Authorized clients</strong> - Whitelist specific pubkeys with <code>-k</code> flag</li>
			<li><strong>Actively maintained</strong> - Core Nostr infrastructure by fiatjaf</li>
			<li><strong>Enterprise-ready</strong> - Deploy in secure enclaves for compliance</li>
		</ul>

		<ProseHeading level={4} id="nak-install">Installation</ProseHeading>

		<CodeBlock language="bash" code={`# Install via Go
go install github.com/fiatjaf/nak@latest

# Or download pre-built binary from releases:
# https://github.com/fiatjaf/nak/releases

# Verify installation
nak --version`} />

		<ProseHeading level={4} id="nak-quickstart">Quick Start</ProseHeading>

		<CodeBlock language="bash" code={`# Generate a new key (or use existing)
nak key generate > ~/.redshift-bunker-key

# Start bunker with your key
nak bunker --sec $(cat ~/.redshift-bunker-key) relay.damus.io nos.lol

# Output includes your bunker:// URL:
# bunker://f59911b5...?relay=wss://relay.damus.io&secret=XuuiMbcL

# Connect Redshift using that URL
redshift login --bunker "bunker://f59911b5..."`} />

		<ProseHeading level={4} id="nak-teams">Teams Setup (Persistent)</ProseHeading>
		<p>
			For production team use, enable persistence and authorize specific client pubkeys:
		</p>

		<CodeBlock language="bash" code={`# First-time setup: create persistent bunker with authorized clients
nak bunker --persist \\
  --sec ncryptsec1... \\
  -k <alice-pubkey> \\
  -k <bob-pubkey> \\
  -k <ci-runner-pubkey> \\
  relay.damus.io nos.lol

# Subsequent runs: just use --persist
nak bunker --persist

# The bunker remembers:
# - Your encrypted secret key
# - Authorized client pubkeys
# - Relay configuration`} />

		<ProseHeading level={4} id="nak-enterprise">Enterprise Deployment</ProseHeading>
		<p>
			For <strong>Redshift Enterprise</strong> with compliance requirements:
		</p>

		<CodeBlock language="bash" code={`# Run as a systemd service
# /etc/systemd/system/redshift-bunker.service
[Unit]
Description=Redshift NIP-46 Bunker
After=network.target

[Service]
Type=simple
User=redshift
ExecStart=/usr/local/bin/nak bunker --persist
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`} />

		<p>
			For SSO integration, the bunker can be deployed in:
		</p>
		<ul>
			<li>AWS Nitro Enclaves</li>
			<li>Azure Confidential Computing</li>
			<li>Air-gapped infrastructure</li>
		</ul>
		<p>
			Contact us for Enterprise SSO bridge configuration (Okta/AzureAD → Nostr identity mapping).
		</p>

		<a href="https://github.com/fiatjaf/nak" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			github.com/fiatjaf/nak →
		</a>

		<!-- Option 2: nsec.app -->
		<ProseHeading level={3} id="nsec-app">nsec.app (Cross-Platform, No Setup)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
			<Globe class="size-5 shrink-0 text-tokyo-cyan" />
			<div>
				<p class="font-medium">Best for: Personal use, mobile users, zero setup</p>
				<p class="mt-1 text-sm text-muted-foreground">
					A hosted non-custodial key storage with remote signing. Works everywhere.
				</p>
			</div>
		</div>

		<ol>
			<li>Visit <a href="https://nsec.app" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">nsec.app</a></li>
			<li>Create an account or import your existing nsec</li>
			<li>Use the NostrConnect flow in Redshift:</li>
		</ol>

		<CodeBlock language="bash" code={`# Generate a nostrconnect:// URI
redshift login --connect

# Paste the URI into nsec.app to authorize`} />

		<a href="https://nsec.app" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			nsec.app →
		</a>

		<!-- Option 3: Amber -->
		<ProseHeading level={3} id="amber-android">Amber (Android Mobile Signer)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
			<Smartphone class="size-5 shrink-0 text-tokyo-purple" />
			<div>
				<p class="font-medium">Best for: Android users who want phone-as-bunker</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Your phone becomes the signing device. No server required.
				</p>
			</div>
		</div>

		<ol>
			<li>Download Amber from <a href="https://github.com/greenart7c3/Amber" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">GitHub</a> or F-Droid</li>
			<li>Import or create your Nostr identity</li>
			<li>Scan the nostrconnect:// QR code from Redshift</li>
		</ol>

		<CodeBlock language="bash" code={`# Generate QR code for Amber to scan
redshift login --connect`} />

		<a href="https://github.com/greenart7c3/Amber" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			github.com/greenart7c3/Amber →
		</a>

		<!-- Option 4: nsecbunkerd (Legacy/Advanced) -->
		<ProseHeading level={3} id="nsecbunkerd">nsecbunkerd (Advanced Self-Hosting)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border border-tokyo-orange/30 bg-tokyo-orange/5 p-4">
			<AlertTriangle class="size-5 shrink-0 text-tokyo-orange" />
			<div>
				<p class="font-medium text-tokyo-orange">Advanced: External services unavailable</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The hosted admin interface (app.nsecbunker.com) is currently offline. 
					Use CLI-only administration or consider <strong>nak bunker</strong> instead.
				</p>
			</div>
		</div>

		<p>
			nsecbunkerd is a Docker-based bunker daemon with multi-user features. It can still be self-hosted 
			and administered via CLI, but the web admin interface is unavailable.
		</p>

		<CodeBlock language="bash" code={`# Clone and configure
git clone https://github.com/kind-0/nsecbunkerd.git
cd nsecbunkerd
cp .env.example .env
# Edit .env: Add your npub to ADMIN_NPUBS

# Start with Docker
docker compose up -d

# CLI administration (web admin unavailable)
docker compose exec nsecbunkerd npm run nsecbunkerd -- add --name "my-key"
docker compose exec nsecbunkerd cat /app/config/connection.txt`} />

		<a href="https://github.com/kind-0/nsecbunkerd" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			github.com/kind-0/nsecbunkerd →
		</a>

		<ProseHeading level={2} id="cicd-integration">CI/CD Integration</ProseHeading>
		<p>
			Bunkers are ideal for CI/CD because you don't need to store your nsec in CI secrets:
		</p>

		<CodeBlock language="yaml" code={`# GitHub Actions example
name: Deploy
on: push

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Redshift
        run: curl -fsSL https://redshift.dev/install | sh
        
      - name: Deploy with secrets
        env:
          REDSHIFT_BUNKER: \${{ secrets.REDSHIFT_BUNKER }}
        run: |
          redshift setup --project my-app --environment production
          redshift run -- npm run deploy`} />

		<p>
			For CI/CD, you'll need a bunker running on persistent infrastructure (not ephemeral CI runners). 
			Options include:
		</p>
		<ul>
			<li><strong>Self-hosted nak bunker</strong> - Run on a small VM or container in your infrastructure</li>
			<li><strong>nsec.app</strong> - Hosted service, authorize your CI runner's client pubkey</li>
			<li><strong>Amber on a dedicated device</strong> - Physical device for high-security environments</li>
		</ul>

		<div class="not-prose my-6 rounded-lg border border-tokyo-blue/30 bg-tokyo-blue/5 p-4">
			<div class="flex items-start gap-3">
				<Zap class="size-5 shrink-0 text-tokyo-blue" />
				<div>
					<p class="font-medium text-tokyo-blue">Pro Tip: Teams CI/CD</p>
					<p class="mt-1 text-sm text-muted-foreground">
						For Redshift Teams, deploy a dedicated <strong>nak bunker</strong> with your CI runner's pubkey 
						pre-authorized using the <code>-k</code> flag. This enables fully automated deployments 
						without manual approval steps.
					</p>
				</div>
			</div>
		</div>

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

		<div class="not-prose my-6 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
			<div class="flex items-start gap-3">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Enterprise Security</p>
					<p class="mt-1 text-sm text-muted-foreground">
						For Redshift Enterprise, deploy <strong>nak bunker</strong> in a hardened environment 
						(AWS Nitro Enclaves, Azure Confidential Computing, or air-gapped infrastructure). 
						The <code>--persist</code> flag stores encrypted keys locally - combine with HSM-backed 
						storage where compliance requires it.
					</p>
				</div>
			</div>
		</div>

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
</DocsPage>
