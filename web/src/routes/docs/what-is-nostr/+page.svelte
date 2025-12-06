<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
</script>

<svelte:head>
	<title>What is Nostr? - Redshift Docs</title>
	<meta name="description" content="Understanding the Nostr protocol and how Redshift uses it for decentralized secret management." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
	<h1 class="mb-4 text-4xl font-bold">What is Nostr?</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Understanding the decentralized protocol that powers Redshift.
	</p>

	<section class="prose prose-invert max-w-none">
		<ProseHeading level={2} id="nostr-in-a-nutshell">Nostr in a Nutshell</ProseHeading>
		<p>
			<strong>Nostr</strong> (Notes and Other Stuff Transmitted by Relays) is a simple, open protocol for creating censorship-resistant global networks. Think of it as a decentralized alternative to platforms like Twitter or Slack, but the underlying technology can be used for much more than social media.
		</p>

		<p>At its core, Nostr is built on three simple concepts:</p>

		<ol>
			<li><strong>Identities are key pairs</strong> - Your identity is a cryptographic key pair. No email, phone, or username required.</li>
			<li><strong>Data is signed</strong> - Everything you publish is cryptographically signed, proving it came from you.</li>
			<li><strong>Relays store and forward</strong> - Independent servers (relays) store and distribute data. You can use any relay, or run your own.</li>
		</ol>

		<ProseHeading level={2} id="how-nostr-works">How Nostr Works</ProseHeading>

		<ProseHeading level={3} id="keys-identity">Keys = Identity</ProseHeading>
		<p>
			Your Nostr identity is a public/private key pair using the secp256k1 curve (the same as Bitcoin). Your <strong>public key</strong> (npub) is your identity that others can see. Your <strong>private key</strong> (nsec) proves you are the owner of that identity.
		</p>

		<CodeBlock code={`# Example Nostr keys
Public key (npub): npub1abc123...xyz
Private key (nsec): nsec1secret...key

# Never share your nsec!`} language="bash" />

		<ProseHeading level={3} id="events-data">Events = Data</ProseHeading>
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
}`} language="json" />

		<p>Key fields:</p>
		<ul>
			<li><strong>kind</strong> - The type of event (1 = text note, 0 = profile metadata, etc.)</li>
			<li><strong>content</strong> - The actual data (can be encrypted)</li>
			<li><strong>sig</strong> - Your cryptographic signature proving you created this</li>
		</ul>

		<ProseHeading level={3} id="relays-storage">Relays = Storage</ProseHeading>
		<p>
			Relays are simple servers that receive, store, and forward events. They're like email servers, but for Nostr data. Key properties:
		</p>

		<ul>
			<li><strong>Anyone can run a relay</strong> - No permission needed</li>
			<li><strong>You choose your relays</strong> - Use public ones or self-host</li>
			<li><strong>Redundancy</strong> - Publish to multiple relays so your data survives if one goes down</li>
			<li><strong>No single point of failure</strong> - If a relay bans you, use another</li>
		</ul>

		<ProseHeading level={2} id="how-redshift-uses-nostr">How Redshift Uses Nostr</ProseHeading>
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

		<ProseHeading level={3} id="security-model">Security Model</ProseHeading>
		<p>
			Your secrets are <strong>encrypted before leaving your device</strong>. Relay operators can see that you have data, but cannot read its contents. Only someone with your private key can decrypt your secrets.
		</p>

		<CodeBlock code={`# What relay operators see:
{
  "kind": 30078,
  "pubkey": "your_npub",
  "content": "encrypted_blob_they_cannot_read",
  "tags": [["d", "project-id"]]
}`} language="json" />

		<ProseHeading level={2} id="nips">NIPs: Nostr Implementation Possibilities</ProseHeading>
		<p>
			Nostr is extended through NIPs - specifications that define how different features work. Redshift uses several NIPs:
		</p>

		<ul>
			<li><strong><a href="https://nips.nostr.com/1" target="_blank" rel="noopener">NIP-01</a></strong> - Basic protocol (events, signatures, relays)</li>
			<li><strong><a href="https://nips.nostr.com/7" target="_blank" rel="noopener">NIP-07</a></strong> - Browser extension interface (Alby, nos2x)</li>
			<li><strong><a href="https://nips.nostr.com/19" target="_blank" rel="noopener">NIP-19</a></strong> - Bech32 encoding (npub, nsec formats)</li>
			<li><strong><a href="https://nips.nostr.com/44" target="_blank" rel="noopener">NIP-44</a></strong> - Versioned encryption (XChaCha20-Poly1305)</li>
			<li><strong><a href="https://nips.nostr.com/46" target="_blank" rel="noopener">NIP-46</a></strong> - Remote signing (bunker connections)</li>
			<li><strong><a href="https://nips.nostr.com/59" target="_blank" rel="noopener">NIP-59</a></strong> - Gift Wrap (metadata protection)</li>
		</ul>

		<ProseHeading level={2} id="why-nostr-for-secrets">Why Nostr for Secrets?</ProseHeading>
		<p>
			Traditional secret managers require you to trust a company with your most sensitive data. Nostr flips this:
		</p>

		<ul>
			<li><strong>You own your identity</strong> - No account to create or company to trust</li>
			<li><strong>You own your data</strong> - Encrypted with your keys, stored on relays you choose</li>
			<li><strong>No vendor lock-in</strong> - Standard protocol, can switch tools anytime</li>
			<li><strong>Censorship resistant</strong> - No single entity can revoke your access</li>
		</ul>

		<ProseHeading level={2} id="learn-more">Learn More</ProseHeading>
		<ul>
			<li><a href="https://nostr.com" target="_blank" rel="noopener">nostr.com</a> - Official resources</li>
			<li><a href="https://github.com/nostr-protocol/nips" target="_blank" rel="noopener">NIPs Repository</a> - Protocol specifications</li>
			<li><a href="https://nostr.how" target="_blank" rel="noopener">nostr.how</a> - Beginner's guide</li>
		</ul>

		<ProseHeading level={2} id="next-steps">Next Steps</ProseHeading>
		<p>
			Now that you understand Nostr, learn <a href="/docs/why-redshift">why Redshift vs. other secret managers</a> or dive into <a href="/docs/auth">authentication options</a>.
		</p>
	</section>
</div>
