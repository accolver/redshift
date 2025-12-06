<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
</script>

<svelte:head>
	<title>What is Nostr? - Redshift Docs</title>
	<meta name="description" content="Understanding the Nostr protocol and how Redshift uses it for decentralized secret management." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">What is Nostr?</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Understanding the decentralized protocol that powers Redshift.
	</p>

	<section class="prose prose-invert max-w-none">
		<h2>Nostr in a Nutshell</h2>
		<p>
			<strong>Nostr</strong> (Notes and Other Stuff Transmitted by Relays) is a simple, open protocol for creating censorship-resistant global networks. Think of it as a decentralized alternative to platforms like Twitter or Slack, but the underlying technology can be used for much more than social media.
		</p>

		<p>At its core, Nostr is built on three simple concepts:</p>

		<ol>
			<li><strong>Identities are key pairs</strong> - Your identity is a cryptographic key pair. No email, phone, or username required.</li>
			<li><strong>Data is signed</strong> - Everything you publish is cryptographically signed, proving it came from you.</li>
			<li><strong>Relays store and forward</strong> - Independent servers (relays) store and distribute data. You can use any relay, or run your own.</li>
		</ol>

		<h2>How Nostr Works</h2>

		<h3>Keys = Identity</h3>
		<p>
			Your Nostr identity is a public/private key pair using the secp256k1 curve (the same as Bitcoin). Your <strong>public key</strong> (npub) is your identity that others can see. Your <strong>private key</strong> (nsec) proves you are the owner of that identity.
		</p>

		<CodeBlock code={`# Example Nostr keys
Public key (npub): npub1abc123...xyz
Private key (nsec): nsec1secret...key

# Never share your nsec!`} />

		<h3>Events = Data</h3>
		<p>
			All data in Nostr is represented as "events" - JSON objects with a specific structure:
		</p>

		<CodeBlock code={`{
  "id": "event_hash",
  "pubkey": "your_public_key",
  "created_at": 1234567890,
  "kind": 1,
  "tags": [["tag", "value"]],
  "content": "Your data here",
  "sig": "cryptographic_signature"
}`} />

		<p>Key fields:</p>
		<ul>
			<li><strong>kind</strong> - The type of event (1 = text note, 0 = profile metadata, etc.)</li>
			<li><strong>content</strong> - The actual data (can be encrypted)</li>
			<li><strong>sig</strong> - Your cryptographic signature proving you created this</li>
		</ul>

		<h3>Relays = Storage</h3>
		<p>
			Relays are simple servers that receive, store, and forward events. They're like email servers, but for Nostr data. Key properties:
		</p>

		<ul>
			<li><strong>Anyone can run a relay</strong> - No permission needed</li>
			<li><strong>You choose your relays</strong> - Use public ones or self-host</li>
			<li><strong>Redundancy</strong> - Publish to multiple relays so your data survives if one goes down</li>
			<li><strong>No single point of failure</strong> - If a relay bans you, use another</li>
		</ul>

		<h2>How Redshift Uses Nostr</h2>
		<p>
			Redshift leverages Nostr's architecture for secret management:
		</p>

		<table>
			<thead>
				<tr>
					<th>Nostr Concept</th>
					<th>Redshift Usage</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>Key pair identity</td>
					<td>Your Nostr keys authenticate you and encrypt your secrets</td>
				</tr>
				<tr>
					<td>Signed events</td>
					<td>Your project and secret data is signed, preventing tampering</td>
				</tr>
				<tr>
					<td>Relays</td>
					<td>Your encrypted secrets are stored across multiple relays</td>
				</tr>
				<tr>
					<td>Event kinds</td>
					<td>Redshift uses Kind 30078 (parameterized replaceable events)</td>
				</tr>
			</tbody>
		</table>

		<h3>Security Model</h3>
		<p>
			Your secrets are <strong>encrypted before leaving your device</strong>. Relay operators can see that you have data, but cannot read its contents. Only someone with your private key can decrypt your secrets.
		</p>

		<CodeBlock code={`# What relay operators see:
{
  "kind": 30078,
  "pubkey": "your_npub",
  "content": "encrypted_blob_they_cannot_read",
  "tags": [["d", "project-id"]]
}`} />

		<h2>NIPs: Nostr Implementation Possibilities</h2>
		<p>
			Nostr is extended through NIPs - specifications that define how different features work. Redshift uses several NIPs:
		</p>

		<ul>
			<li><strong>NIP-01</strong> - Basic protocol (events, signatures, relays)</li>
			<li><strong>NIP-07</strong> - Browser extension interface (Alby, nos2x)</li>
			<li><strong>NIP-19</strong> - Bech32 encoding (npub, nsec formats)</li>
			<li><strong>NIP-46</strong> - Remote signing (bunker connections)</li>
		</ul>

		<h2>Why Nostr for Secrets?</h2>
		<p>
			Traditional secret managers require you to trust a company with your most sensitive data. Nostr flips this:
		</p>

		<ul>
			<li><strong>You own your identity</strong> - No account to create or company to trust</li>
			<li><strong>You own your data</strong> - Encrypted with your keys, stored on relays you choose</li>
			<li><strong>No vendor lock-in</strong> - Standard protocol, can switch tools anytime</li>
			<li><strong>Censorship resistant</strong> - No single entity can revoke your access</li>
		</ul>

		<h2>Learn More</h2>
		<ul>
			<li><a href="https://nostr.com" target="_blank" rel="noopener">nostr.com</a> - Official resources</li>
			<li><a href="https://github.com/nostr-protocol/nips" target="_blank" rel="noopener">NIPs Repository</a> - Protocol specifications</li>
			<li><a href="https://nostr.how" target="_blank" rel="noopener">nostr.how</a> - Beginner's guide</li>
		</ul>

		<h2>Next Steps</h2>
		<p>
			Now that you understand Nostr, learn <a href="/docs/why-redshift">why Redshift vs. other secret managers</a> or dive into <a href="/docs/auth">authentication options</a>.
		</p>
	</section>
</div>
