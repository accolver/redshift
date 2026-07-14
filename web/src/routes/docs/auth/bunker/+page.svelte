<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';
import { Shield, Server, Smartphone, Zap, Globe, Terminal, AlertTriangle } from '@lucide/svelte';
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

		<ProseHeading level={2} id="bunker-auth-flow">Bunker Auth Flow</ProseHeading>
		<p>
			Bunker auth lets Redshift use your Nostr identity without holding your private key. Redshift and the bunker exchange encrypted NIP-46 messages through shared relays.
		</p>

		<div class="not-prose my-6 rounded-lg border border-border bg-card p-4">
			<div class="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
				<div class="rounded-lg border border-tokyo-blue/30 bg-tokyo-blue/5 p-4 text-center">
					<Terminal class="mx-auto size-6 text-tokyo-blue" />
					<p class="mt-2 font-medium">Redshift CLI</p>
					<p class="mt-1 text-xs text-muted-foreground">Creates a client key and asks for signatures</p>
				</div>

				<div class="hidden text-2xl text-muted-foreground md:block">↔</div>

				<div class="rounded-lg border border-tokyo-cyan/30 bg-tokyo-cyan/5 p-4 text-center">
					<Server class="mx-auto size-6 text-tokyo-cyan" />
					<p class="mt-2 font-medium">Relays</p>
					<p class="mt-1 text-xs text-muted-foreground">Pass encrypted messages only</p>
				</div>

				<div class="hidden text-2xl text-muted-foreground md:block">↔</div>

				<div class="rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4 text-center">
					<Shield class="mx-auto size-6 text-tokyo-green" />
					<p class="mt-2 font-medium">nak bunker</p>
					<p class="mt-1 text-xs text-muted-foreground">Keeps the private key and signs</p>
				</div>
			</div>
			<p class="mt-4 text-center text-sm text-muted-foreground">
				Relays help Redshift and the bunker find each other, but they cannot read the encrypted requests or access your private key.
			</p>
		</div>

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
				<Zap class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium leading-5">Individual Automation</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Keep one individual's signing key outside the CLI process while automating approved requests.
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
						<td class="px-4 py-3 text-muted-foreground">Individual CLI, CI/CD, self-hosted</td>
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

		<div class="not-prose my-8 rounded-lg border-2 border-tokyo-orange bg-tokyo-orange/5 p-6">
			<div class="flex items-start gap-4">
				<AlertTriangle class="size-8 shrink-0 text-tokyo-orange" />
				<div>
					<h3 class="text-lg font-semibold text-tokyo-orange">Current scope: individual NIP-46</h3>
					<p class="mt-2 text-muted-foreground">
						Redshift v0.14.2 verifies an individual remote-signer workflow with the pinned
						<code>nak</code> v0.19.7 test fixture. Shared custody, role-based access,
						invitations, organizational recovery, and SSO are not launched. Upstream bunker
						client authorization is not a Redshift team-access or compliance control.
					</p>
					<a href="#nak-bunker" class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-tokyo-orange hover:underline">
						Jump to the tested reference →
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

# One-time pairing URI (hidden input; never exposed through process argv)
redshift login --bunker-stdin

# NostrConnect flow (scan QR with bunker app)
redshift login --connect

# Environment variable (for CI/CD)
export REDSHIFT_BUNKER="bunker://..."
redshift secrets list`} />

		<ProseHeading level={2} id="bunker-options">Bunker Options</ProseHeading>

		<!-- Option 1: pinned nak reference -->
		<ProseHeading level={3} id="nak-bunker">nak bunker (Individual & CI/CD)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border-2 border-tokyo-green bg-tokyo-green/5 p-4">
			<Terminal class="size-5 shrink-0 text-tokyo-green" />
			<div>
				<p class="flex items-center gap-2 font-medium">
					Tested reference: individual CLI, CI/CD, self-hosted infrastructure
					<span class="rounded-full bg-tokyo-green px-2 py-0.5 text-xs font-medium text-white">Pinned in tests</span>
				</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Redshift's local and release gates exercise <code>nak</code> v0.19.7. Operators must assess upstream security, persistence, availability, and upgrades for their own environment.
				</p>
			</div>
		</div>

		<p>
			<strong>Why use the pinned nak reference?</strong>
		</p>
		<ul>
			<li><strong>Verified interoperability</strong> - Redshift tests the exact pinned version through a real local relay</li>
			<li><strong>Separate signer process</strong> - The Redshift CLI does not need the signing key</li>
			<li><strong>Explicit client authorization</strong> - Upstream controls can limit client pubkeys, but do not provide Redshift RBAC</li>
			<li><strong>Operator-owned deployment</strong> - Persistence, hardening, monitoring, and recovery remain your responsibility</li>
		</ul>

		<ProseHeading level={4} id="nak-install">Installation</ProseHeading>

		<CodeBlock language="bash" code={`# Install via Go
go install github.com/fiatjaf/nak@v0.19.7

# Or download pre-built binary from releases:
# https://github.com/fiatjaf/nak/releases

# Verify installation
nak --version`} />

		<ProseHeading level={4} id="nak-quickstart">Quick Start</ProseHeading>

		<CodeBlock language="bash" code={`# Generate a new bunker key and save it locally.
# Keep this file private; it is the signing key for the bunker.
mkdir -p ~/.redshift
chmod 700 ~/.redshift
nak key generate > ~/.redshift/bunker.key
chmod 600 ~/.redshift/bunker.key

# Start the bunker in the background without printing the key in your shell history.
# Its output is saved so Redshift can read the generated bunker:// URL for you.
nak bunker --sec "$(cat ~/.redshift/bunker.key)" relay.damus.io nos.lol \
  > ~/.redshift/bunker.log 2>&1 &
echo $! > ~/.redshift/bunker.pid

# Wait for nak to print the bunker URL, then export it.
until grep -q 'bunker: bunker://' ~/.redshift/bunker.log; do sleep 0.2; done
export REDSHIFT_BUNKER="$(awk '/bunker: bunker:\/\// { print $2 }' ~/.redshift/bunker.log | tail -n 1)"

# Connect Redshift without placing the one-time pairing secret in process argv.
redshift login --bunker-stdin
# Paste the REDSHIFT_BUNKER value at the hidden prompt.

# Re-authenticate an existing Redshift CLI profile through the same protected input path.
redshift login --force --bunker-stdin`} />

		<ProseHeading level={4} id="nak-operation">Persistent Operation Boundary</ProseHeading>
		<p>
			A long-running bunker is independent infrastructure that you operate. Review the pinned
			upstream version's persistence, authorization, service supervision, backup, upgrade, and
			recovery documentation before relying on it. Redshift does not currently provide managed
			bunker hosting, shared custody, organizational recovery, compliance certification, or an
			identity-provider bridge.
		</p>

		<a href="https://github.com/fiatjaf/nak" target="_blank" rel="noopener" class="text-tokyo-blue hover:underline">
			github.com/fiatjaf/nak →
		</a>

		<!-- Option 2: nsec.app -->
		<ProseHeading level={3} id="nsec-app">nsec.app (Third-Party Signer)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
			<Globe class="size-5 shrink-0 text-tokyo-cyan" />
			<div>
				<p class="font-medium">Compatibility is not release-certified</p>
				<p class="mt-1 text-sm text-muted-foreground">
					nsec.app is an independent service. Review its custody, privacy, availability, and
					current NIP-46 compatibility before using it; Redshift's release evidence does not certify it.
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
		<ProseHeading level={3} id="amber-android">Amber (Third-Party Android Signer)</ProseHeading>
		<div class="not-prose my-4 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
			<Smartphone class="size-5 shrink-0 text-tokyo-purple" />
			<div>
				<p class="font-medium">Compatibility is not release-certified</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Amber is independent software. Review its custody model and current NostrConnect/NIP-46
					compatibility; Redshift's release evidence currently certifies only the pinned nak fixture.
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
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
      
      - name: Install Redshift
        run: curl -fsSL https://redshiftapp.com/install | sh
        
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
					<p class="font-medium text-tokyo-blue">Individual CI/CD boundary</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Use a dedicated signer identity and narrowly authorized client for each automation context.
						Upstream allowlists do not provide Redshift team RBAC, approval workflows, or shared recovery.
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
			<li><strong>Use WSS relays</strong> - Use encrypted relay transport except for explicit loopback development</li>
			<li><strong>Rotate secrets</strong> - Periodically regenerate bunker connection secrets</li>
			<li><strong>Monitor usage</strong> - Watch for unexpected signing requests</li>
			<li><strong>Limit permissions</strong> - Configure the bunker to only allow necessary operations</li>
		</ul>

		<div class="not-prose my-6 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
			<div class="flex items-start gap-3">
				<Shield class="size-5 shrink-0 text-tokyo-green" />
				<div>
					<p class="font-medium text-tokyo-green">Operator security boundary</p>
					<p class="mt-1 text-sm text-muted-foreground">
						A remote signer moves key custody; it does not make the workflow compliant or managed.
						Harden, monitor, back up, and recover the signer according to your own threat model,
						and test revocation before unattended use.
					</p>
				</div>
			</div>
		</div>

		<ProseHeading level={2} id="troubleshooting">Troubleshooting</ProseHeading>

		<ProseHeading level={3} id="failed-to-connect-to-bunker">"Failed to connect to bunker" or "unauthorized"</ProseHeading>
		<ul>
			<li>Check that the bunker service is running</li>
			<li>Verify the relay URL is correct and accessible</li>
			<li>Ensure the connection secret matches</li>
			<li>Quote the full <code>bunker://</code> URL. In most shells, an unquoted <code>&amp;secret=...</code> is treated as a background command separator, so Redshift receives the URL without the secret.</li>
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
