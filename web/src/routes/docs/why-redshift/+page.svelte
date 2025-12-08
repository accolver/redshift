<script lang="ts">
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';
import { CircleCheck, CircleX, Minus } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Why Redshift? - Redshift Docs</title>
	<meta name="description" content="Compare Redshift with Doppler, HashiCorp Vault, AWS Secrets Manager, and other secret management solutions." />
</svelte:head>

<DocsPage title="Why Redshift?" description="How Redshift compares to Doppler, Vault, and other secret management solutions.">
		<ProseHeading level={2} id="the-problem">The Problem with Traditional Secret Managers</ProseHeading>
		<p>
			Most secret management tools share a common architecture: your secrets are stored on someone else's servers, encrypted with keys they control. This creates several issues:
		</p>

		<ul>
			<li><strong>Vendor lock-in</strong> - Your data is trapped in a proprietary format</li>
			<li><strong>Single point of failure</strong> - If the service goes down, so does your deployment</li>
			<li><strong>Trust requirement</strong> - You must trust the company won't be compromised, subpoenaed, or shut down</li>
			<li><strong>Censorship risk</strong> - Your account can be terminated at any time</li>
			<li><strong>Cost scaling</strong> - Pricing often scales with usage, team size, or secrets count</li>
		</ul>

		<ProseHeading level={2} id="the-redshift-difference">The Redshift Difference</ProseHeading>
		<p>
			Redshift takes a fundamentally different approach:
		</p>

		<div class="not-prose my-8 grid gap-4 sm:grid-cols-2">
			<div class="rounded-lg border border-border bg-card p-5">
				<h3 class="mb-2 font-semibold text-tokyo-blue">Client-Side Encryption</h3>
				<p class="text-sm text-muted-foreground">
					Secrets are encrypted on your device before being sent anywhere. Even relay operators cannot read your data.
				</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-5">
				<h3 class="mb-2 font-semibold text-tokyo-purple">Your Keys, Your Data</h3>
				<p class="text-sm text-muted-foreground">
					Your Nostr identity controls access. No company can lock you out of your own secrets.
				</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-5">
				<h3 class="mb-2 font-semibold text-tokyo-cyan">Decentralized Storage</h3>
				<p class="text-sm text-muted-foreground">
					Data is replicated across multiple independent relays. No single point of failure.
				</p>
			</div>
			<div class="rounded-lg border border-border bg-card p-5">
				<h3 class="mb-2 font-semibold text-tokyo-green">Open Protocol</h3>
				<p class="text-sm text-muted-foreground">
					Built on Nostr, an open standard. Export your data anytime, use any compatible client.
				</p>
			</div>
		</div>

		<ProseHeading level={2} id="feature-comparison">Feature Comparison</ProseHeading>
		<div class="not-prose my-8 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-2 py-3 text-left font-medium sm:px-4">Feature</th>
						<th class="px-2 py-3 text-center font-medium sm:px-4">Redshift</th>
						<th class="px-2 py-3 text-center font-medium sm:px-4">Doppler</th>
						<th class="px-2 py-3 text-center font-medium sm:px-4">Vault</th>
						<th class="px-2 py-3 text-center font-medium sm:px-4">AWS SM</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr>
						<td class="px-2 py-3 sm:px-4">Client-side encryption</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><Minus class="mx-auto size-5 text-muted-foreground" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">No vendor lock-in</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><Minus class="mx-auto size-5 text-muted-foreground" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">Self-hostable</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">Free for individuals</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">No infra to manage</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">Censorship resistant</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><Minus class="mx-auto size-5 text-muted-foreground" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">Doppler-compatible CLI</td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleX class="mx-auto size-5 text-tokyo-red" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">Team sharing</td>
						<td class="px-2 py-3 text-center sm:px-4"><Minus class="mx-auto size-5 text-muted-foreground" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
					</tr>
					<tr>
						<td class="px-2 py-3 sm:px-4">Audit logs</td>
						<td class="px-2 py-3 text-center sm:px-4"><Minus class="mx-auto size-5 text-muted-foreground" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
						<td class="px-2 py-3 text-center sm:px-4"><CircleCheck class="mx-auto size-5 text-tokyo-green" /></td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="text-sm text-muted-foreground">
			<CircleCheck class="inline size-4 text-tokyo-green" /> = Full support, 
			<Minus class="inline size-4 text-muted-foreground" /> = Partial/Coming soon, 
			<CircleX class="inline size-4 text-tokyo-red" /> = Not available
		</p>

		<ProseHeading level={2} id="when-to-use-redshift">When to Use Redshift</ProseHeading>
		<p><strong>Redshift is ideal for:</strong></p>
		<ul>
			<li>Solo developers and small teams</li>
			<li>Privacy-conscious developers</li>
			<li>Open source projects</li>
			<li>Side projects and indie hackers</li>
			<li>Anyone who values sovereignty over their data</li>
			<li>Developers already using Nostr</li>
		</ul>

		<p><strong>Consider alternatives if you need:</strong></p>
		<ul>
			<li>Enterprise compliance features (SOC2, HIPAA)</li>
			<li>Complex role-based access control</li>
			<li>Detailed audit logging</li>
			<li>Professional support SLAs</li>
		</ul>

		<ProseHeading level={2} id="migrating-from-doppler">Migrating from Doppler</ProseHeading>
		<p>
			Redshift's CLI is designed to be Doppler-compatible, making migration straightforward:
		</p>

		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Doppler Command</th>
						<th class="px-4 py-3 text-left font-medium">Redshift Equivalent</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border font-mono">
					<tr>
						<td class="px-4 py-3">doppler login</td>
						<td class="px-4 py-3">redshift login</td>
					</tr>
					<tr>
						<td class="px-4 py-3">doppler setup</td>
						<td class="px-4 py-3">redshift setup</td>
					</tr>
					<tr>
						<td class="px-4 py-3">doppler run -- npm start</td>
						<td class="px-4 py-3">redshift run -- npm start</td>
					</tr>
					<tr>
						<td class="px-4 py-3">doppler secrets set KEY value</td>
						<td class="px-4 py-3">redshift secrets set KEY value</td>
					</tr>
					<tr>
						<td class="px-4 py-3">doppler secrets</td>
						<td class="px-4 py-3">redshift secrets list</td>
					</tr>
				</tbody>
			</table>
		</div>

		<ProseHeading level={2} id="the-bottom-line">The Bottom Line</ProseHeading>
		<p>
			Redshift offers a fundamentally different trust model. Instead of trusting a company with your secrets, you trust cryptography. Your secrets are encrypted with keys only you control, and stored on a decentralized network with no single point of failure.
		</p>

		<p>
			This comes with trade-offs - you're responsible for backing up your Nostr keys, and some enterprise features aren't available yet. But for developers who value sovereignty and simplicity, Redshift offers a compelling alternative to the status quo.
		</p>

		<ProseHeading level={2} id="get-started">Get Started</ProseHeading>
		<p>
			Ready to try Redshift? <a href="/docs/installation">Install the CLI</a> and follow the <a href="/docs/quickstart">Quick Start guide</a>.
		</p>
</DocsPage>
