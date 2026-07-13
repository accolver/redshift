/**
 * Blog posts data for Redshift
 *
 * Each post contains metadata and full content.
 * Posts are ordered by date (newest first).
 */

export interface BlogPost {
	slug: string;
	title: string;
	description: string;
	date: string; // ISO date string
	author: string;
	readingTime: string;
	tags: string[];
	content: string; // Markdown-like content with HTML
}

export const posts: BlogPost[] = [
	{
		slug: 'why-your-secrets-deserve-sovereignty',
		title: 'Why Your Secrets Deserve Sovereignty',
		description:
			'Centralized secret managers are single points of failure. Learn why decentralized secret management is the future.',
		date: '2024-12-18',
		author: 'Redshift Team',
		readingTime: '5 min read',
		tags: ['sovereignty', 'security', 'decentralization'],
		content: `
			<p class="lead">
				Every API key, database credential, and private token you store with a centralized provider is one subpoena, one breach, or one policy change away from being compromised.
			</p>

			<h2>The Problem with Centralized Secret Management</h2>
			<p>
				Tools like Doppler, HashiCorp Vault, and AWS Secrets Manager have genuinely made secrets easier to manage. That part's great. The problem is what you give up in return: <strong>you don't actually own your secrets anymore</strong>.
			</p>
			<p>
				Think about it. When your secrets live on someone else's servers, that someone else can revoke your access whenever they want. They can be compelled to hand your data over to authorities. They can get breached. They can jack up prices once you're too deep to migrate easily. Or they can just... shut down. It's happened before.
			</p>

			<h2>What is Secret Sovereignty?</h2>
			<p>
				Secret sovereignty means you have complete, unconditional control over your credentials. No third party can access, revoke, or compromise your secrets without your explicit consent.
			</p>
			<p>
				That matters a lot in practice, not just in principle. Open source projects can't afford to depend on a single company's goodwill. Privacy-focused apps need guarantees, not promises. If you're a developer in a restrictive jurisdiction, censorship-resistant infrastructure isn't a nice-to-have. And honestly, even if none of that applies to you today, picking a tool that can't rug-pull you is just good engineering.
			</p>

			<h2>How Redshift Enables Sovereignty</h2>
			<p>
				Redshift is built around three ideas that make sovereignty the default, not an upgrade tier.
			</p>

			<h3>1. Client-Side Encryption</h3>
			<p>
				Your secrets never leave your device unencrypted. Redshift uses NIP-59 Gift Wrap encryption, so even the relays storing your data can't read it. There's no server-side key. No admin backdoor. If we wanted to peek at your secrets, we literally couldn't.
			</p>

			<h3>2. Decentralized Storage</h3>
			<p>
				Instead of one company's servers, Redshift uses the Nostr protocol to distribute your encrypted data across multiple independent relays. If one relay goes down, your secrets are still available from the others. No single point of failure.
			</p>

			<h3>3. Your Keys, Your Data</h3>
			<p>
				Authentication is just your Nostr identity. You hold the private key, so you hold the secrets. There's no account to create, no vendor that can lock you out, and you can export everything anytime using standard Nostr protocols. If Redshift disappeared tomorrow, your data wouldn't go with it.
			</p>

			<h2>Where This is Heading</h2>
			<p>
				More developers are waking up to the risks of centralizing their most sensitive data with third parties. We think sovereign secret management will become the norm, not the exception. But we're biased, obviously.
			</p>
			<p>
				If you want to try it, <a href="/admin">get started for free</a>. No credit card, no account creation.
			</p>
		`,
	},
	{
		slug: 'nostr-for-developers-beyond-social-media',
		title: 'Nostr for Developers: Beyond Social Media',
		description:
			'Nostr is more than a Twitter alternative. Discover how this decentralized protocol is powering the next generation of developer tools.',
		date: '2024-12-15',
		author: 'Redshift Team',
		readingTime: '7 min read',
		tags: ['nostr', 'protocol', 'development'],
		content: `
			<p class="lead">
				Most developers know Nostr as "that decentralized Twitter thing." Fair enough, that's where the hype started. But if you stop there, you're missing what makes the protocol genuinely interesting for building tools and infrastructure.
			</p>

			<h2>What is Nostr, Really?</h2>
			<p>
				Nostr stands for "Notes and Other Stuff Transmitted by Relays," which is a deliberately vague name because the protocol is deliberately general. The whole thing boils down to three concepts:
			</p>
			<ul>
				<li><strong>Clients</strong> are apps that create and display content</li>
				<li><strong>Relays</strong> are servers that store and forward messages</li>
				<li>Everything is an <strong>Event</strong> -- a signed JSON object that can represent basically anything</li>
			</ul>
			<p>
				That's really it. Events are just JSON. Signing uses standard secp256k1 (same as Bitcoin). Relays are dumb pipes. There's no consensus mechanism, no blockchain, no token. This radical simplicity is the whole point, and it's what makes the protocol useful for things nobody originally anticipated.
			</p>

			<h2>Why Nostr for Developer Tools?</h2>
			<p>
				We started building Redshift on Nostr because a few of its properties lined up almost too well with what we needed. Here's what stood out:
			</p>

			<h3>Identity Without Registration</h3>
			<p>
				Your Nostr identity is a keypair. That's it. No email verification, no OAuth dance, no "sign up" page. Generate a key and you exist. If you've ever tried to bolt authentication onto a CLI tool, you know how appealing this is -- you skip the entire account system.
			</p>

			<h3>Built-in Encryption</h3>
			<p>
				The protocol already has specs for encrypted communication: NIP-04 for direct messages and NIP-59 for gift wrap (which is what we use). You get end-to-end encryption without rolling your own crypto, which, as we all know, you should never do.
			</p>

			<h3>Decentralized by Default</h3>
			<p>
				Your data gets replicated across whatever relays you publish to. No replication config, no failover logic, no single provider to worry about. One relay goes down and your data is still sitting on the others. We didn't have to build any of that -- the protocol just does it.
			</p>

			<h3>Interoperability</h3>
			<p>
				Any Nostr client can read any Nostr event. Your data isn't locked into one app. You could build a completely different tool that reads the same events Redshift writes, and it would just work. Try doing that with Vault.
			</p>

			<h2>What Developers Are Building</h2>
			<p>
				The non-social-media side of Nostr is more active than most people realize:
			</p>
			<ul>
				<li><strong>Redshift</strong> -- decentralized secret management (hi, that's us)</li>
				<li><strong>Nostr Git</strong> -- git hosting backed by Nostr relays, no GitHub required</li>
				<li>Stemstr is doing music collaboration on the protocol</li>
				<li>Npub.cash ties Bitcoin Lightning wallets to Nostr identities</li>
				<li>Highlighter built decentralized annotations -- think Hypothesis but on Nostr</li>
			</ul>

			<h2>Getting Started with Nostr Development</h2>
			<p>
				If you want to build something on Nostr, the barrier to entry is genuinely low:
			</p>
			<ol>
				<li>Start with the <a href="https://github.com/nostr-protocol/nips" target="_blank" rel="noopener">NIPs</a> (Nostr Implementation Possibilities). They define the protocol and they're readable -- most are a single page.</li>
				<li>Grab <strong>nostr-tools</strong> if you're in JS/TS land. It's the de facto library and covers most of what you'll need.</li>
				<li>Run a local relay for development. strfry is fast, nostream is full-featured. Either works.</li>
				<li>Install a NIP-07 browser extension (Alby or nos2x) so you can test signing without hardcoding keys.</li>
			</ol>

			<h2>Worth Paying Attention To</h2>
			<p>
				Nostr is still early. Some parts of the ecosystem are rough. Relay implementations vary in quality, NIP adoption is uneven, and the tooling has gaps. But the protocol's simplicity means the design space is wide open. People keep finding new things to build with it that the original creators never planned for -- which, honestly, is usually the sign of a good protocol.
			</p>
			<p>
				If you want to see what building on Nostr actually looks like in practice, <a href="/docs/what-is-nostr">read our Nostr explainer</a> or just <a href="/admin">try Redshift</a> -- the whole thing runs on Nostr under the hood.
			</p>
		`,
	},
	{
		slug: 'migrating-from-doppler-to-redshift',
		title: 'Migrating from Doppler to Redshift: Complete Guide',
		description:
			"Redshift offers a Doppler-inspired workflow with its own documented command contract. Here's how to migrate deliberately.",
		date: '2024-12-10',
		author: 'Redshift Team',
		readingTime: '4 min read',
		tags: ['migration', 'doppler', 'tutorial'],
		content: `
			<p class="lead">
				We built the Redshift CLI to feel familiar if you're coming from Doppler, but it has its own supported commands and flags. Review each command below rather than assuming full compatibility. The data migration itself is straightforward once you have exported the intended Doppler project and environment.
			</p>

			<h2>Before You Begin</h2>
			<p>
				You'll need three things ready:
			</p>
			<ul>
				<li>Redshift CLI installed (<code>curl -fsSL https://redshiftapp.com/install | sh</code>)</li>
				<li>A CLI signer (local nsec or NIP-46 remote signer); NIP-07 is for the browser dashboard</li>
				<li>Access to your Doppler project</li>
			</ul>

			<h2>Step 1: Export Secrets from Doppler</h2>
			<p>
				Grab everything out of Doppler as JSON. Make sure you're in the right project/environment first -- Doppler uses whatever you last configured with <code>doppler setup</code>.
			</p>
			<pre><code>doppler secrets download --no-file --format json > secrets.json</code></pre>
			<p>
				This dumps all your secrets for the current environment into a single file. Worth a quick <code>cat secrets.json</code> to sanity-check that it looks right before moving on.
			</p>

			<h2>Step 2: Authenticate with Redshift</h2>
			<p>
				This is the part most people overthink. Just run:
			</p>
			<pre><code>redshift login</code></pre>
			<p>
				The CLI offers local nsec and NIP-46 remote-signer paths. NIP-07 extensions authenticate the browser dashboard and are not a CLI login method. Review the custody trade-offs in the authentication documentation before choosing.
			</p>

			<h2>Step 3: Create a Project</h2>
			<p>
				Now set up a project to hold your secrets. The setup wizard asks a few questions -- project name, which environments you want -- and creates everything for you.
			</p>
			<pre><code>redshift setup</code></pre>
			<p>
				I'd recommend matching your Doppler project name so you don't confuse yourself later. If you have multiple environments in Doppler (dev, staging, production), create them all here. You can always add more later.
			</p>

			<h2>Step 4: Upload Your Secrets</h2>
			<p>
				Point Redshift at the JSON file you exported earlier:
			</p>
			<pre><code>redshift secrets upload secrets.json -e production</code></pre>
			<p>
				That's the whole thing. Redshift encrypts each secret with your Nostr identity client-side, then publishes them to your configured relays. If you exported multiple environments from Doppler, repeat this step with each file and the matching <code>-e</code> flag.
			</p>

			<h2>Step 5: Update Your Scripts</h2>
			<p>
				Here's the payoff for the Doppler-inspired run workflow: many scripts can swap <code>doppler run</code> for <code>redshift run</code> while keeping the same <code>--</code> separator. Check the Redshift CLI reference for strict flag differences.
			</p>
			<pre><code># Before
doppler run -- npm start

# After
redshift run -- npm start</code></pre>
			<p>
				If you have a dozen scripts or CI configs that reference Doppler, a find-and-replace gets you most of the way there. I'd test one locally before going on a bulk-replace spree, though.
			</p>

			<h2>Step 6: Clean Up</h2>
			<p>
				Once you've confirmed everything runs correctly with Redshift:
			</p>
			<ol>
				<li>Delete the <code>secrets.json</code> file -- seriously, it's sitting there in plaintext</li>
				<li>Update your CI/CD pipelines to use <code>redshift</code></li>
				<li>Optionally, revoke your Doppler secrets (maybe give it a week first, just in case)</li>
			</ol>

			<h2>Command Compatibility Reference</h2>
			<p>
				For quick reference, here's how the main commands line up. If you've been using Doppler for a while, you'll barely notice the difference.
			</p>
			<table>
				<thead>
					<tr>
						<th>Doppler</th>
						<th>Redshift</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>doppler run</code></td>
						<td><code>redshift run</code></td>
					</tr>
					<tr>
						<td><code>doppler secrets</code></td>
						<td><code>redshift secrets</code></td>
					</tr>
					<tr>
						<td><code>doppler setup</code></td>
						<td><code>redshift setup</code></td>
					</tr>
				</tbody>
			</table>

			<h2>Stuck on Something?</h2>
			<p>
				The <a href="/docs/cli">CLI docs</a> cover all the flags and options in detail. If you hit something weird during migration, <a href="https://github.com/accolver/redshift" target="_blank" rel="noopener">open an issue</a> -- we've seen most of the edge cases by now and can usually point you in the right direction quickly.
			</p>
		`,
	},
	{
		slug: 'nip-59-gift-wrap-encryption-explained',
		title: 'NIP-59 Gift Wrap Encryption Explained',
		description:
			'A technical deep dive into how Redshift uses NIP-59 Gift Wrap to provide end-to-end encrypted secret storage on Nostr.',
		date: '2024-12-05',
		author: 'Redshift Team',
		readingTime: '8 min read',
		tags: ['encryption', 'nostr', 'security', 'technical'],
		content: `
			<p class="lead">
				Redshift stores your secrets on public Nostr relays, yet no one can read them except you. This post walks through how NIP-59 Gift Wrap actually works under the hood, why simple encryption isn't enough, and what the three-layer scheme buys you in practice.
			</p>

			<h2>The Problem: Metadata Leaks</h2>
			<p>
				Encrypting message content is table stakes. The harder problem is metadata. Even with encrypted payloads, a standard Nostr event leaks the sender's public key, the timestamp, and the recipient's public key in the <code>p</code> tag. That's enough for an observer to build a graph of who's talking to whom and when.
			</p>
			<p>
				For secret management this is worse than it sounds. An attacker watching relay traffic could correlate your identity across projects, figure out when you last rotated credentials, and infer which services you depend on. None of that requires breaking any encryption.
			</p>

			<h2>How NIP-59 Gift Wrap Works</h2>
			<p>
				NIP-59 addresses metadata leakage with three nested layers. Each layer hides a different piece of information. Let's walk through them bottom-up.
			</p>

			<h3>Layer 1: The Rumor (Unsigned Event)</h3>
			<p>
				Your actual content goes into an unsigned Nostr event called a "rumor." Because it has no signature, there's no cryptographic link back to any identity.
			</p>
			<pre><code>{
  "kind": 30078,
  "content": "DATABASE_URL=postgres://...",
  "tags": [["d", "my-project|production"]],
  // No "sig" field - unsigned!
}</code></pre>

			<h3>Layer 2: The Seal (Encrypted Rumor)</h3>
			<p>
				The rumor gets NIP-44 encrypted to the recipient and placed in a kind <code>13</code> "seal" event. The sender signs the seal with their real key, which proves authorship. But nobody's going to see this signature directly.
			</p>
			<pre><code>{
  "kind": 13,
  "content": "[encrypted rumor]",
  "pubkey": "[sender's real pubkey]",
  "sig": "[sender's signature]"
}</code></pre>

			<h3>Layer 3: The Gift Wrap (Hidden Sender)</h3>
			<p>
				This is where it gets interesting. The seal is encrypted <em>again</em> and wrapped in a kind <code>1059</code> event signed by a <strong>random, one-time keypair</strong> generated just for this message. The timestamp is also randomized within a 48-hour window.
			</p>
			<pre><code>{
  "kind": 1059,
  "content": "[encrypted seal]",
  "pubkey": "[random throwaway pubkey]",
  "created_at": [randomized timestamp],
  "tags": [["p", "[recipient pubkey]"]],
  "sig": "[random key signature]"
}</code></pre>
			<p>
				From the relay's perspective, this event came from some pubkey it's never seen before and will never see again. The real sender is buried two encryption layers deep.
			</p>

			<h2>Why This Matters for Secret Management</h2>
			<p>
				The net effect is that Redshift gets four properties out of a single protocol mechanism:
			</p>
			<ul>
				<li>Content is NIP-44 encrypted. Relays see ciphertext.</li>
				<li>Sender identity is hidden behind a throwaway key. No attribution without decryption.</li>
				<li>Timestamps are randomized, so you can't correlate activity patterns.</li>
				<li>Relays have no way to distinguish secret storage events from any other Gift Wrap traffic.</li>
			</ul>

			<h2>NIP-44 Encryption Details</h2>
			<p>
				NIP-44 handles the actual cryptographic operations inside the seal and gift wrap layers. The construction looks like this:
			</p>
			<p>
				Key agreement uses secp256k1 ECDH between the sender and recipient Nostr keypairs, producing a shared secret. That shared secret is expanded via HKDF into the actual encryption key and nonce. The payload is encrypted with XChaCha20 and authenticated with HMAC-SHA256. Messages are also padded to fixed lengths to prevent content-length analysis.
			</p>
			<p>
				This is a solid, modern construction. If an attacker compromises a relay and dumps everything, they get a pile of padded, authenticated ciphertext with no useful metadata attached. They'd need the recipient's private key to make any progress.
			</p>

			<h2>Decryption Flow</h2>
			<p>
				When Redshift fetches your secrets, it peels the layers off in reverse:
			</p>
			<ol>
				<li>Query relays for kind <code>1059</code> events with a <code>p</code> tag matching your pubkey</li>
				<li>NIP-44 decrypt the gift wrap content using the throwaway pubkey + your private key, revealing the seal</li>
				<li>Verify the seal's <code>pubkey</code> matches your own (for self-stored secrets) or a trusted sender</li>
				<li>NIP-44 decrypt the seal content, revealing the unsigned rumor</li>
				<li>Parse the rumor's content and tags to extract the actual secret values</li>
			</ol>
			<p>
				Everything happens client-side. Your private key never leaves your device, and plaintext secrets exist only in memory during the session.
			</p>

			<h2>Security Considerations</h2>
			<p>
				A few things to keep in mind when reasoning about this threat model:
			</p>
			<p>
				<strong>Key compromise is total.</strong> If someone gets your nsec, they can decrypt every secret ever encrypted to your pubkey. There's no forward secrecy here; NIP-59 uses static ECDH, not a ratcheting protocol. Rotate secrets if you suspect key compromise.
			</p>
			<p>
				<strong>Relay availability is your responsibility.</strong> Relays can go offline, purge old events, or refuse to store your data. Use multiple relays. Redshift publishes to several by default, but you should verify your relay list periodically.
			</p>
			<p>
				<strong>The throwaway key is per-event.</strong> Reusing it across messages would re-link them. Redshift generates a fresh keypair for every Gift Wrap, which is the correct behavior per the spec.
			</p>

			<h2>Further Reading</h2>
			<p>
				You can inspect this in practice by <a href="/admin">creating a Redshift project</a> and watching the network tab. The kind <code>1059</code> events will have random pubkeys and no readable content.
			</p>
			<p>
				For the full spec, see <a href="https://github.com/nostr-protocol/nips/blob/master/59.md" target="_blank" rel="noopener">NIP-59 on GitHub</a>. Our <a href="/docs/security">security docs</a> cover Redshift's specific implementation choices.
			</p>
		`,
	},
	{
		slug: 'hidden-costs-of-centralized-secret-management',
		title: 'The Hidden Costs of Centralized Secret Management',
		description:
			'Beyond pricing tiers, centralized secret managers carry risks that compound over time. Here are the costs no one talks about.',
		date: '2024-11-28',
		author: 'Redshift Team',
		readingTime: '6 min read',
		tags: ['security', 'sovereignty', 'philosophy'],
		content: `
			<p class="lead">
				I spent a weekend migrating off a secret manager last year. Not because it was bad software, but because the vendor got acquired and the new owners tripled the price on our tier. Two days of my life, rewriting CI pipelines and rotating credentials, because someone else controlled where our secrets lived. That experience got me thinking about all the ways centralized secret management costs you beyond the monthly bill.
			</p>

			<h2>You can check in, but you can't check out</h2>
			<p>
				Every secret manager has its own API, its own CLI syntax, its own way of organizing data. That's fine on day one. By month six, you've got it wired into your CI/CD, your deployment scripts reference it by name, your onboarding docs all assume it exists. You're locked in, and the vendor knows it.
			</p>
			<p>
				We've watched this play out over and over. HashiCorp changed Vault's license to BSL and teams that had built their entire infrastructure around it suddenly had to consult lawyers. Heroku killed its free tier overnight. Docker slapped rate limits on pulls that had been free for years. The playbook is always the same: get developers hooked with generous terms, wait until switching costs are high, then change the deal.
			</p>
			<p>
				The worst part is that migration isn't just "point at a new API." It's re-auditing access controls, re-testing every integration, and hoping nothing breaks in production at 2am. Most teams just eat the price increase because the alternative is worse.
			</p>

			<h2>Compliance gets weird fast</h2>
			<p>
				If you work in a regulated industry, try answering these questions about your secret manager: Where are your secrets physically stored right now? Which employees at the vendor have access to the underlying infrastructure? What jurisdiction are those servers in, and whose subpoena power applies to them?
			</p>
			<p>
				Most teams can't answer any of those confidently. And it gets worse during audits. Your auditor asks where your production database credentials live, and the honest answer is "on servers we don't control, in a region we think is us-east-1, managed by people we've never met." That's not a great answer. If the vendor gets breached, you might find out from a news article before their incident response team gets around to notifying you.
			</p>

			<h2>When the service goes down, you go down</h2>
			<p>
				Every major cloud provider has outages. This isn't controversial, it's just reality. But when your secret manager is down, it's not like a CDN outage where pages load a bit slower. You literally cannot deploy. You can't rotate credentials. You can't onboard a new service. You're stuck.
			</p>
			<p>
				I've seen teams hit API rate limits during an incident response, right when they needed to rotate a compromised key. And account suspensions happen too, sometimes over something as dumb as a billing dispute or an expired credit card. Imagine explaining to your CTO that production is down because your corporate card got flagged for fraud and the vault provider auto-suspended the account.
			</p>

			<h2>Trust is a liability</h2>
			<p>
				This is the one that bothers me most. When you use a centralized provider, you're trusting their employees won't go rogue, their security practices are actually as good as their marketing claims, and that the company will still exist and care about your use case in three years. You can't audit their implementation. You can't verify their access logs. You just... trust.
			</p>
			<p>
				That's a lot of trust to extend to an organization you have zero visibility into. And every additional trust relationship is another surface area for things to go wrong. This isn't paranoia. It's the same risk calculus you'd apply to any other dependency in your stack.
			</p>

			<h2>Who actually owns your secrets?</h2>
			<p>
				Here's what keeps me up at night: if a provider can revoke your access to your own secrets, are they really yours? They can change their ToS. They can be compelled by a government to hand over your data. They can shut down with 30 days notice and a "thanks for being a customer" email. For most commercial SaaS teams this is an acceptable risk. But for open-source projects, independent developers, journalists, or anyone operating in a politically sensitive context, this is a non-starter. Your secrets should survive your relationship with any single vendor.
			</p>

			<h2>What we built instead</h2>
			<p>
				Redshift sidesteps all of this. Your data uses standard Nostr protocols, so there's no proprietary format locking you in. Secrets replicate across independent relays, so no single outage takes you down. Everything is encrypted client-side before it ever leaves your machine, so there's no trust required in relay operators. Your keys, your data, full stop.
			</p>
			<p>
				Yeah, there's a learning curve. But it's a one-time cost, not a compounding one. Every month you spend on a centralized provider, the switching costs get higher and your leverage gets lower.
			</p>

			<h2>Questions worth asking</h2>
			<p>
				Before you sign up for (or renew) any secret management service, sit with these for a minute: What does it actually look like to leave this vendor? Not in theory, in practice, with your current integrations. What happens to your deployments if they have a bad day? And what happens to your data if they get acquired by someone who doesn't care about your use case?
			</p>
			<p>
				If you don't like the answers, <a href="/admin">give Redshift a look</a>. It's free, it's open, and your secrets stay yours.
			</p>
		`,
	},
	{
		slug: 'secret-management-for-open-source-projects',
		title: 'Secret Management for Open Source Projects',
		description:
			'Open source maintainers face unique challenges with secrets. Learn patterns that work without relying on centralized services.',
		date: '2024-11-20',
		author: 'Redshift Team',
		readingTime: '6 min read',
		tags: ['open-source', 'tutorial', 'best-practices'],
		content: `
			<p class="lead">
				Your open source project has secrets. Here's how to manage them without a corporate account or a budget.
			</p>

			<h2>The Open Source Secret Challenge</h2>
			<p>
				If you maintain an open source project, you've dealt with this: you need API keys for CI, tokens for publishing, maybe credentials for test infrastructure. But the tools that manage secrets all seem to assume you're a company with a procurement department.
			</p>
			<p>
				Meanwhile, you're juggling contributors who come and go, public repos where one bad commit exposes everything, and the nagging worry about what happens if you step away for a month. Traditional solutions either cost money or introduce dependencies that'll outlive your interest in the project.
			</p>

			<h2>Pattern 1: Environment Separation</h2>
			<p>
				This sounds obvious, but I've seen plenty of projects where the same NPM token gets used for local dev, CI, and production releases. Don't do that.
			</p>
			<p>
				Keep your environments isolated. Use local-only credentials for development, dedicated CI tokens with minimal permissions, and production secrets that only the release automation touches. If a contributor's laptop gets compromised, it shouldn't matter for prod.
			</p>
			<p>
				In Redshift, each environment is its own namespace, so you can hand out development access freely without anyone seeing production credentials.
			</p>
			<pre><code>$ redshift setup
? Select environment: development
? Select environment: ci
? Select environment: production

$ redshift run -e development -- npm test</code></pre>

			<h2>Pattern 2: Minimal Permissions</h2>
			<p>
				Scope everything down. Read-only tokens for CI jobs that only need to fetch. API keys limited to specific actions. Credentials that expire on their own so you don't have to remember to rotate them.
			</p>
			<p>
				The goal is blast radius. When (not if) something leaks, a token that can only read public package metadata is a non-event. A token with full admin access is an incident.
			</p>

			<h2>Pattern 3: Contributor Access Without Shared Secrets</h2>
			<p>
				I've learned this one the hard way. You share one set of credentials with all your maintainers, someone steps away from the project, and now you're rotating everything at 11pm because you're not sure they revoked access on their end.
			</p>
			<p>
				Give each maintainer their own credentials instead. Define roles—release manager, CI admin—with specific permissions tied to each. Keep audit logs so you know who accessed what. It's more setup upfront, but future-you will be grateful.
			</p>
			<p>
				Redshift's roadmap includes team features for exactly this: cryptographic access control without needing a central authority.
			</p>

			<h2>Pattern 4: Secrets in CI/CD</h2>
			<p>
				GitHub Actions, GitLab CI, and the rest all have built-in secret storage. Use it, but think about what you're actually storing there. Here's what a Redshift setup looks like:
			</p>
			<pre><code># .github/workflows/release.yml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Redshift
        run: curl -fsSL https://redshiftapp.com/install | sh
      - name: Publish Package
        run: redshift run -e production -- npm publish
        env:
          REDSHIFT_NSEC: \${{ secrets.REDSHIFT_NSEC }}</code></pre>
			<p>
				The CI platform only stores your Nostr identity. Actual secrets get fetched at runtime from decentralized relays, so you're not duplicating sensitive values across GitHub's secret store and everywhere else.
			</p>

			<h2>Pattern 5: The Bus Factor Solution</h2>
			<p>
				What happens if you take a two-week vacation and something breaks? Or, less charitably, what if you just lose interest?
			</p>
			<p>
				At minimum: keep a private maintainer doc listing every secret and what it's for. Make sure at least two people can access critical credentials. Write down how to regenerate or rotate each one—you think you'll remember, but you won't.
			</p>
			<p>
				With Redshift, you can share encrypted secrets with co-maintainers using their Nostr public keys. No central service in the middle, just cryptography.
			</p>

			<h2>Pattern 6: Public Secrets for Development</h2>
			<p>
				Not everything needs to be locked down. Public API keys for services with generous free tiers, test credentials for sandboxed environments, mock tokens that only work locally—these are fine to share openly.
			</p>
			<p>
				Put them in a <code>.env.example</code> committed to the repo. New contributors should be able to clone, copy that file, and have a working dev environment without asking anyone for access. The fewer barriers to a first contribution, the better.
			</p>

			<h2>Getting Started</h2>
			<p>
				Redshift is free for individuals—no credit card, no corporate account needed. Your encrypted secrets live on Nostr relays, so even if Redshift disappears, your data doesn't.
			</p>
			<p>
				Check the <a href="/docs/quickstart">quickstart guide</a> or <a href="/admin">create your first project</a>.
			</p>
		`,
	},
	{
		slug: 'why-open-source-matters-for-security-tools',
		title: 'Why Open Source Matters for Security Tools',
		description:
			'Closed-source security tools ask you to trust without verification. Open source flips that equation entirely.',
		date: '2024-11-15',
		author: 'Redshift Team',
		readingTime: '5 min read',
		tags: ['open-source', 'security', 'philosophy'],
		content: `
			<p class="lead">
				I don't trust closed-source security tools. Not because the people building them are dishonest, but because "just trust us" is a fundamentally broken model for software that handles your secrets.
			</p>

			<h2>The Trust Problem</h2>
			<p>
				Go read the landing page for any closed-source secrets manager. You'll find some version of: "your data is encrypted at rest," "we never see your plaintext secrets," "zero-knowledge architecture." Maybe a compliance badge or two.
			</p>
			<p>
				How would you know if any of that is true? You wouldn't. The vendor could be mistaken about their own implementation. They could have a bug they haven't found yet. They could be under a gag order. You're trusting a marketing page, not a codebase.
			</p>

			<h2>What Open Source Actually Gets You</h2>

			<h3>Independent Audits</h3>
			<p>
				Redshift's encryption implementation is at <a href="https://github.com/accolver/redshift" target="_blank" rel="noopener">github.com/accolver/redshift</a>. You can go read how we use NIP-59, confirm secrets are encrypted before they leave your machine, and check that there's no key escrow. You don't need to take our word for it. Security researchers and paranoid developers have the same access you do.
			</p>

			<h3>Backdoors Are Visible</h3>
			<p>
				Closed-source vendors can be compelled to add backdoors -- by governments, by investors, by acquirers -- and they may not be allowed to tell you about it. This isn't theoretical.
			</p>
			<p>
				An open source backdoor would show up in a diff. That's a meaningful difference.
			</p>

			<h3>The Project Outlives the Company</h3>
			<p>
				Companies fail. Products get acqui-hired into oblivion. When your closed-source secrets manager shuts down, you're scrambling. When an open source project's maintainers move on, the community can fork it. All the time you invested in integration and tooling isn't wasted.
			</p>

			<h3>You Can Fix It Yourself</h3>
			<p>
				Need something the maintainers won't prioritize? Build it. You're not sitting in a feature request queue hoping the next quarterly roadmap goes your way.
			</p>

			<h2>Security Through Obscurity Is Still Wrong</h2>
			<p>
				Some vendors argue that hiding source code makes their product more secure. This has been a discredited position in cryptography for decades. AES, TLS, every serious security primitive you rely on daily -- all publicly documented. Strong security comes from sound algorithms and correct implementation, not from hoping attackers can't read your code.
			</p>
			<p>
				Obscurity doesn't prevent security problems. It <em>hides</em> them. Some of the worst breaches in recent memory came from closed-source systems that looked perfectly secure from the outside.
			</p>

			<h2>Open Source Isn't Perfect</h2>
			<p>
				To be fair, open source has challenges:
			</p>
			<ul>
				<li><strong>Funding</strong>: Maintainers need to eat; sustainability is hard</li>
				<li><strong>Review capacity</strong>: Just because code <em>can</em> be reviewed doesn't mean it <em>is</em></li>
				<li><strong>Supply chain attacks</strong>: Dependencies can be compromised</li>
			</ul>
			<p>
				But these problems all exist in closed-source software too -- you just can't see them. Open source at least gives you the <em>option</em> to verify.
			</p>

			<h2>Redshift's Approach</h2>
			<p>
				Redshift is MIT licensed. The CLI, the web admin dashboard, the crypto libraries -- all public. If you don't trust us, read the code. If you find a bug, open an issue. If you want a feature, submit a PR.
			</p>
			<p>
				<a href="/admin">Try Redshift</a> and see for yourself.
			</p>
		`,
	},
	{
		slug: 'setting-up-redshift-for-cicd-pipelines',
		title: 'Setting Up Redshift for Your CI/CD Pipeline',
		description:
			'Inject secrets into GitHub Actions, GitLab CI, and other automation platforms using Redshift. Complete setup guide included.',
		date: '2024-11-10',
		author: 'Redshift Team',
		readingTime: '6 min read',
		tags: ['tutorial', 'cicd', 'devops'],
		content: `
			<p class="lead">
				I recently wired up Redshift to three different CI platforms in the same week. The actual config is straightforward once you see it, but there were a few things I wish I'd known upfront. This is the guide I would've wanted.
			</p>

			<h2>Why Not Just Use the Built-in Secrets?</h2>
			<p>
				GitHub Actions, GitLab, CircleCI -- they all have secret storage built in. It works fine until you need to share secrets across platforms, or you realize that anyone with repo admin can read them, or you try to figure out who changed a value last Tuesday. The built-in options get you 80% of the way there, but the last 20% is where things get annoying.
			</p>
			<p>
				Redshift takes a different approach: your secrets live on Nostr relays, encrypted to your identity, and get pulled in at runtime. The CI platform only ever holds one thing -- your Nostr key.
			</p>

			<h2>Prerequisites</h2>
			<p>
				Before setting up CI/CD integration:
			</p>
			<ol>
				<li>Install Redshift locally: <code>curl -fsSL https://redshiftapp.com/install | sh</code></li>
				<li>Create a project and add secrets: <code>redshift setup</code></li>
				<li>Create a dedicated Nostr identity for CI (recommended for security isolation)</li>
			</ol>

			<h2>GitHub Actions Setup</h2>
			<p>
				This is probably where most people will start. Add your CI identity's nsec as a repository secret called <code>REDSHIFT_NSEC</code>, then your workflow looks like this:
			</p>
			<pre><code># .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Redshift
        run: curl -fsSL https://redshiftapp.com/install | sh

      - name: Deploy with secrets
        run: redshift run -p my-project -e production -- ./deploy.sh
        env:
          REDSHIFT_NSEC: \${{ secrets.REDSHIFT_NSEC }}</code></pre>
			<p>
				The <code>REDSHIFT_NSEC</code> secret is your CI identity's private key. Redshift uses it to decrypt secrets from relays and inject them into your deploy script.
			</p>

			<h2>GitLab CI Setup</h2>
			<p>
				GitLab keeps CI/CD variables in project settings rather than a secrets tab. Go to Settings > CI/CD > Variables and add <code>REDSHIFT_NSEC</code> there. The pipeline config itself is pretty minimal:
			</p>
			<pre><code># .gitlab-ci.yml
stages:
  - deploy

deploy:
  stage: deploy
  image: ubuntu:latest
  before_script:
    - curl -fsSL https://redshiftapp.com/install | sh
  script:
    - redshift run -p my-project -e production -- ./deploy.sh
  only:
    - main</code></pre>

			<h2>CircleCI Setup</h2>
			<p>
				For CircleCI, you'll find environment variables under Project Settings. The YAML is a bit more verbose than the others, but the Redshift part is identical:
			</p>
			<pre><code># .circleci/config.yml
version: 2.1

jobs:
  deploy:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - run:
          name: Install Redshift
          command: curl -fsSL https://redshiftapp.com/install | sh
      - run:
          name: Deploy
          command: redshift run -p my-project -e production -- ./deploy.sh

workflows:
  deploy:
    jobs:
      - deploy:
          filters:
            branches:
              only: main</code></pre>

			<h2>Keep Your CI Identity Separate</h2>

			<h3>Don't Reuse Your Personal Key</h3>
			<p>
				This is the one thing I'd really stress. Don't use your personal Nostr identity for CI. If that nsec leaks from a CI log or a misconfigured workflow, you don't want it to be the same key that holds your personal secrets. Generate a dedicated keypair:
			</p>
			<pre><code># Generate a new keypair using any Nostr tool (e.g., nak, nostr-tools)
$ nak key generate
npub1abc...xyz
nsec1...

# Then login with the new identity
$ redshift login --nsec nsec1...</code></pre>
			<p>
				If the CI key does get exposed, you revoke that one identity and re-share secrets with a new one. Your personal stuff stays untouched.
			</p>

			<h3>Scope Secrets by Environment</h3>
			<p>
				Use different environments for different pipeline stages. Your test suite doesn't need production database credentials:
			</p>
			<ul>
				<li><code>-e ci</code> for build/test jobs (limited secrets)</li>
				<li><code>-e staging</code> for staging deployments</li>
				<li><code>-e production</code> for production deployments (restricted access)</li>
			</ul>

			<h3>Rotate After Team Changes</h3>
			<p>
				When someone leaves the team, rotate your CI Nostr identity. Since secrets are encrypted to that identity, you'll need to re-share them with the new keypair -- but that's a feature, not a bug. It forces you to actually revoke access instead of just hoping the old credentials aren't saved somewhere.
			</p>

			<h2>Debugging CI Issues</h2>
			<p>
				If secrets aren't being injected:
			</p>
			<ol>
				<li>Verify <code>REDSHIFT_NSEC</code> is set: <code>echo $REDSHIFT_NSEC | head -c 10</code></li>
				<li>Check your identity: <code>redshift me</code></li>
				<li>Verify project setup: <code>redshift configure</code></li>
				<li>Test locally with the same identity</li>
			</ol>

			<h2>Next Steps</h2>
			<p>
				Once this is running, you get secrets that travel with you across CI platforms, cryptographic access control without passing credentials around, and the same secret values locally and in CI. No more "it works on my machine" because of a missing env var.
			</p>
			<p>
				For more details, see our <a href="/docs/cli">CLI documentation</a> or <a href="/docs/quickstart">quickstart guide</a>.
			</p>
		`,
	},
	{
		slug: 'using-nip-07-browser-extensions',
		title: 'Using NIP-07 Browser Extensions: A Complete Guide',
		description:
			'NIP-07 extensions let you sign Nostr events without exposing your private key. Learn how to use them with Redshift.',
		date: '2024-11-05',
		author: 'Redshift Team',
		readingTime: '5 min read',
		tags: ['nostr', 'tutorial', 'security'],
		content: `
			<p class="lead">
				NIP-07 defines a standard way for web applications to request signatures from browser extensions. This means you can use Redshift's web admin without ever typing your private key into a website.
			</p>

			<h2>What is NIP-07?</h2>
			<p>
				NIP-07 is a Nostr Implementation Possibility that defines a <code>window.nostr</code> API for browser extensions. When a web app needs to sign an event (like encrypting your secrets), it asks the extension to sign instead of handling your private key directly.
			</p>
			<p>
				If you've used SSH keys, the mental model is similar -- your key lives in one place, and applications ask it to sign things on their behalf. The key itself never gets handed over.
			</p>

			<h2>Why Use a NIP-07 Extension?</h2>
			<p>
				The short answer: your private key stays out of websites entirely. Without an extension, you'd paste your nsec into every Nostr app you use. One phishing site or one XSS vulnerability and it's gone. With NIP-07, the extension holds the key and the website just gets the signature it asked for. You also get a confirmation prompt for each request, so nothing happens without you approving it.
			</p>
			<p>
				On a practical level, it's also just faster. Install the extension once, and every Nostr app recognizes you instantly. No passwords, no login forms.
			</p>

			<h2>Popular NIP-07 Extensions</h2>

			<h3>Alby (the one we recommend)</h3>
			<p>
				<a href="https://getalby.com" target="_blank" rel="noopener">Alby</a> started as a Bitcoin Lightning wallet and grew into the most full-featured NIP-07 extension available. It supports Chrome, Firefox, and Safari, handles multiple Nostr accounts, and is actively maintained and open source. The Lightning integration is nice if you use it, but honestly the Nostr key management alone makes it worth installing.
			</p>
			<p>
				It's what we use internally and what most of the Nostr ecosystem has standardized around. If you're not sure which to pick, pick Alby.
			</p>

			<h3>nos2x</h3>
			<p>
				<a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noopener">nos2x</a> is fiatjaf's original NIP-07 implementation. Chrome only, no wallet, no extras -- it just signs Nostr events and gets out of the way. If you want the smallest possible extension and don't care about Lightning or multi-account support, nos2x is fine. It hasn't seen as much active development lately though, which is worth considering.
			</p>

			<h3>Flamingo</h3>
			<p>
				A newer option focused on mobile-friendly design. We haven't tested it extensively with Redshift, so your mileage may vary.
			</p>

			<h2>Setting Up Alby (Recommended)</h2>
			<ol>
				<li>
					<strong>Install the extension</strong>: Visit <a href="https://getalby.com" target="_blank" rel="noopener">getalby.com</a> and install for your browser
				</li>
				<li>
					<strong>Create or import identity</strong>: You can generate a new Nostr keypair or import an existing nsec
				</li>
				<li>
					<strong>Set a password</strong>: Alby encrypts your key locally with this password
				</li>
				<li>
					<strong>Pin the extension</strong>: Click the puzzle icon in your browser and pin Alby for easy access
				</li>
			</ol>

			<h2>Using NIP-07 with Redshift</h2>
			<p>
				Once you have a NIP-07 extension installed:
			</p>
			<ol>
				<li>Visit <a href="/admin">redshiftapp.com/admin</a></li>
				<li>Click "Sign in with Extension"</li>
				<li>Approve the connection request in your extension popup</li>
				<li>You're authenticated—no password or nsec required</li>
			</ol>
			<p>
				When you save secrets, Redshift asks the extension to encrypt them. You'll see a popup for each encryption request (or you can configure auto-approve for trusted sites).
			</p>

			<h2>A Few Things to Be Aware Of</h2>
			<p>
				NIP-07 extensions handle three types of requests: reading your public key (harmless -- it's public), signing events, and encrypting/decrypting content. Redshift needs all three. When you first connect, the extension will ask you to approve each type. Take a second to actually read those prompts rather than clicking through them.
			</p>
			<p>
				Once you trust a site, you can configure your extension to auto-approve its requests. Alby makes this easy in its settings. We'd recommend doing this for redshiftapp.com since you'll be triggering encryption requests frequently when managing secrets, and clicking "approve" fifty times gets old fast.
			</p>
			<p>
				One thing that catches people: <strong>your extension stores keys in your browser's local storage</strong>. Clear your browser data, switch to a new machine, or uninstall the extension without exporting your nsec first, and you've locked yourself out. Export your nsec from the extension settings and back it up somewhere safe -- a password manager, an encrypted note, whatever works for you. Do this before you need it, not after.
			</p>

			<h2>Common Issues</h2>

			<h3>"Redshift says no extension found"</h3>
			<p>
				This is almost always a page load timing issue. The extension injects <code>window.nostr</code> on page load, so if you installed it without refreshing, Redshift doesn't know it's there. Refresh the page. If that doesn't work, check that the extension is actually enabled (it's easy to accidentally disable it) and make sure you're not using a browser it doesn't support -- nos2x is Chrome-only, for instance.
			</p>

			<h3>"I click approve but nothing happens" / signing seems stuck</h3>
			<p>
				The approval popup might be hiding behind your browser window, or your popup blocker might be eating it. Click the extension icon directly to see if there are pending requests queued up. If the extension seems completely unresponsive, a browser restart usually fixes it. This happens more often than you'd think after browser updates.
			</p>

			<h2>CLI Authentication</h2>
			<p>
				NIP-07 is web-only. For CLI authentication, you'll need to either:
			</p>
			<ul>
				<li>Enter your nsec directly (stored in system keychain)</li>
				<li>Use a Nostr Bunker for remote signing</li>
			</ul>
			<p>
				See our <a href="/docs/auth">authentication documentation</a> for all options.
			</p>
		`,
	},
	{
		slug: 'managing-secrets-across-environments',
		title: 'Managing Secrets Across Multiple Environments',
		description:
			'Development, staging, production—each environment needs different secrets. Learn patterns for keeping them organized and secure.',
		date: '2024-10-28',
		author: 'Redshift Team',
		readingTime: '5 min read',
		tags: ['best-practices', 'tutorial', 'environments'],
		content: `
			<p class="lead">
				If you've ever truncated a production table because your local app was pointed at the wrong database, you already know why this matters. The fix isn't complicated, but most teams don't set up proper environment separation until after something goes wrong.
			</p>

			<h2>The Multi-Environment Problem</h2>
			<p>
				The root issue is that <code>DATABASE_URL</code> means something completely different depending on context. Locally, it's your throwaway Postgres container. In CI, it's a shared test instance. In production, it's the thing that page-alerts you at 3am when it goes down. Same variable name, wildly different consequences if you mix them up.
			</p>
			<p>
				Beyond the obvious "dev pointed at prod" disaster, environments tend to drift apart quietly. Someone updates a key in staging but forgets production. A new hire spends half a day figuring out which Slack thread has the current dev credentials. Six months in, nobody's confident that any two environments actually match.
			</p>

			<h2>Redshift Environment Model</h2>
			<p>
				Redshift keeps each environment in its own namespace under a project. The structure looks like this:
			</p>
			<pre><code>Project
├── development
│   ├── DATABASE_URL
│   ├── API_KEY
│   └── DEBUG=true
├── staging
│   ├── DATABASE_URL
│   ├── API_KEY
│   └── DEBUG=false
└── production
    ├── DATABASE_URL
    ├── API_KEY
    └── DEBUG=false</code></pre>
			<p>
				Same secret names, different values, no chance of cross-contamination. The <code>-e</code> flag is the only thing that determines which set you get.
			</p>

			<h2>Setting Up Environments</h2>
			<p>
				The setup wizard walks you through it. You can always add more later, but starting with the environments you know you need saves you from the "I'll organize this eventually" trap:
			</p>
			<pre><code>$ redshift setup
? Project name: my-api
? Create environment: development
? Create another environment? yes
? Create environment: staging
? Create another environment? yes
? Create environment: production
? Create another environment? no

Created project "my-api" with 3 environments</code></pre>

			<h2>Adding Secrets Per Environment</h2>
			<p>
				The <code>-e</code> flag targets a specific environment. Nothing surprising here, but seeing it spelled out makes the isolation concrete:
			</p>
			<pre><code># Development - local database, verbose logging
$ redshift secrets set DATABASE_URL postgres://localhost:5432/myapp_dev -e development
$ redshift secrets set LOG_LEVEL debug -e development

# Staging - shared test database
$ redshift secrets set DATABASE_URL postgres://staging.db.internal:5432/myapp -e staging
$ redshift secrets set LOG_LEVEL info -e staging

# Production - production database, minimal logging
$ redshift secrets set DATABASE_URL postgres://prod.db.internal:5432/myapp -e production
$ redshift secrets set LOG_LEVEL warn -e production</code></pre>

			<h2>Running with Environment Secrets</h2>
			<p>
				This is the part your scripts and CI configs actually care about:
			</p>
			<pre><code># Local development
$ redshift run -e development -- npm run dev

# Test against staging
$ redshift run -e staging -- npm test

# Production deployment (in CI)
$ redshift run -e production -- npm start</code></pre>

			<h2>Environment Naming Conventions</h2>
			<p>
				Stick to consistent, predictable names:
			</p>
			<table>
				<thead>
					<tr>
						<th>Environment</th>
						<th>Purpose</th>
						<th>Access</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>development</code></td>
						<td>Local development</td>
						<td>All developers</td>
					</tr>
					<tr>
						<td><code>test</code></td>
						<td>Automated testing</td>
						<td>CI systems</td>
					</tr>
					<tr>
						<td><code>staging</code></td>
						<td>Pre-production testing</td>
						<td>Dev team</td>
					</tr>
					<tr>
						<td><code>production</code></td>
						<td>Live system</td>
						<td>Restricted</td>
					</tr>
				</tbody>
			</table>

			<h2>Sharing Secrets Across Environments</h2>
			<p>
				Sometimes a secret genuinely is the same everywhere -- a third-party API key that auto-detects the environment, or a shared analytics token. You have a few options:
			</p>
			<ol>
				<li><strong>Duplicate manually</strong>: Set the same value in each environment</li>
				<li><strong>Script it</strong>: Write a shell script that sets common secrets across environments</li>
				<li><strong>Use inheritance</strong>: Coming in a future Redshift release</li>
			</ol>
			<p>
				Duplication is annoying but at least it's explicit. We're building inheritance so you can define base values that environments override selectively, but that's not shipped yet.
			</p>

			<h2>Preventing Environment Mistakes</h2>
			<p>
				The goal here is to make it hard to accidentally run against the wrong environment. No single trick solves this, but a few habits stacked together make it pretty unlikely.
			</p>

			<h3>Use Descriptive Values</h3>
			<p>
				If your database URL contains the word "staging" and you see it in a production log, that's an instant red flag. Bake the environment name into values wherever it makes sense:
			</p>
			<pre><code># Include environment in URLs where possible
DATABASE_URL=postgres://localhost:5432/myapp_development
DATABASE_URL=postgres://staging.internal:5432/myapp_staging</code></pre>

			<h3>Require Explicit Environment</h3>
			<p>
				This one matters more than people think. If <code>redshift run</code> without a <code>-e</code> flag defaulted to production, you'd eventually fat-finger it. Redshift requires you to specify, and you should do the same in your npm scripts:
			</p>
			<pre><code># In package.json scripts
"start:prod": "redshift run -e production -- node server.js"</code></pre>

			<h2>Auditing Environment Access</h2>
			<p>
				The current managed relay does not provide a user-facing audit-log guarantee. If your workflow requires access auditing, record it in your deployment system and treat a Redshift audit-log product as future roadmap work.
			</p>
			<p>
				On the free tier, you can use separate Nostr identities per environment tier for coarse access control.
			</p>

			<h2>Migration from .env Files</h2>
			<p>
				If you're sitting on a pile of <code>.env.development</code>, <code>.env.staging</code>, <code>.env.production</code> files, the migration is mechanical:
			</p>
			<pre><code># Import each environment
$ redshift secrets upload .env.development -e development
$ redshift secrets upload .env.staging -e staging
$ redshift secrets upload .env.production -e production

# Then delete the .env files (they contain plaintext secrets!)
$ rm .env.*</code></pre>
			<p>
				Your secrets are now encrypted and accessible from anywhere, not just machines with the right dotfiles.
			</p>

			<h2>One Last Thing</h2>
			<p>
				If you take one thing from this post: set up the separation <em>before</em> you need it. It takes five minutes during <code>redshift setup</code> and saves you from the 2am "wait, which database is this connected to" panic. The <a href="/docs/quickstart">quickstart</a> covers the full flow, or just run <code>redshift setup</code> and follow the prompts.
			</p>
		`,
	},
	{
		slug: 'redshift-vs-hashicorp-vault',
		title: 'Redshift vs HashiCorp Vault: When to Choose Each',
		description:
			'Vault is the industry standard for enterprise secrets. Redshift takes a fundamentally different approach. A comparison for developers trying to pick the right tool.',
		date: '2024-10-20',
		author: 'Redshift Team',
		readingTime: '7 min read',
		tags: ['comparison', 'vault', 'enterprise'],
		content: `
			<p class="lead">
				We get asked about Vault a lot. Fair enough -- it's the default choice for secret management at most companies, and for good reason. But Vault and Redshift are built on fundamentally different assumptions about how secrets should work, and the right choice depends on what you actually need.
			</p>

			<h2>The Core Architectural Split</h2>
			<p>
				Everything else in this comparison flows from one decision: centralized server vs. decentralized protocol.
			</p>

			<h3>Vault: Centralized Server</h3>
			<p>
				Vault is a server (or cluster) that your applications connect to. Secrets live in a storage backend -- Consul, PostgreSQL, whatever you configure -- encrypted at rest. Access is governed by policies and auth methods. It's a well-understood model and it works.
			</p>
			<ul>
				<li><strong>Server required</strong>: You run and maintain Vault infrastructure</li>
				<li><strong>Network dependency</strong>: Clients need connectivity to the Vault server</li>
				<li><strong>Centralized trust</strong>: Vault operators can access all secrets</li>
			</ul>

			<h3>Redshift: Decentralized Protocol</h3>
			<p>
				Redshift stores encrypted secrets on Nostr relays. There's no Redshift server -- just a CLI and web interface that talk to public relays. It's a less proven model, but it eliminates a whole category of operational concerns.
			</p>
			<ul>
				<li><strong>No server to run</strong>: Use public relays or run your own</li>
				<li><strong>Relay redundancy</strong>: Secrets replicate across multiple independent relays</li>
				<li><strong>Zero-knowledge</strong>: Relay operators can't decrypt your secrets</li>
			</ul>

			<h2>Where Vault Wins</h2>
			<p>
				Let's start here, because Vault genuinely does a lot of things we don't.
			</p>

			<h3>Enterprise Compliance</h3>
			<p>
				Vault has years of enterprise deployments behind it, SOC 2 certifications, and the kind of compliance documentation that makes auditors happy. If you need specific certification coverage, evaluate products that currently provide it. The Redshift individual product does not offer compliance certification.
			</p>

			<h3>Dynamic Secrets</h3>
			<p>
				This is probably Vault's best feature. It generates short-lived database credentials, AWS IAM creds, PKI certificates -- created on demand and automatically revoked. Redshift doesn't do any of this, and we don't have plans to. Dynamic secrets fundamentally require the centralized server model that Vault uses.
			</p>

			<h3>Access Policies</h3>
			<p>
				Vault's policy language is genuinely powerful -- fine-grained rules based on paths, metadata, time windows, identity. Redshift's access model is binary: you have the key or you don't. For large orgs with complex permission requirements, that simplicity is a real limitation.
			</p>

			<h3>HashiCorp Ecosystem</h3>
			<p>
				If you're already running Consul, Nomad, or Terraform Enterprise, Vault fits right in. That ecosystem integration is a legitimate advantage we can't replicate.
			</p>

			<h2>Where Redshift Wins</h2>

			<h3>No Required Redshift-Operated Service</h3>
			<p>
				Running Vault in production is real work. The Redshift individual product instead uses relays you select, so no Redshift-operated service is required. Relay selection, availability, and retention still remain your operational decisions.
			</p>
			<p>
				For an individual developer without dedicated infrastructure staff, that narrower operating model can be useful. It is not a managed availability or retention guarantee.
			</p>

			<h3>Actual Zero-Knowledge</h3>
			<p>
				Vault operators can read your secrets. That's not a bug -- it's how centralized secret management works. With Redshift, nobody can read your secrets without your private key. Not us, not relay operators, nobody. If that property matters to you, Vault can't offer it by design.
			</p>

			<h3>Censorship Resistance</h3>
			<p>
				A Vault server can be shut down, blocked, or seized. Redshift secrets are spread across independent Nostr relays around the world. For most teams this is irrelevant, but for some it matters a lot.
			</p>

			<h3>Cost</h3>
			<p>
				Vault Enterprise is expensive. Vault OSS is free but you're paying in infrastructure and ops time. Redshift is free for individuals -- unlimited projects, unlimited secrets.
			</p>

			<h3>Doppler-inspired CLI</h3>
			<p>
				If you're coming from Doppler, Redshift's <code>run</code> workflow is familiar, but only Redshift's documented commands and flags are supported. Vault's CLI is more powerful and more complex for day-to-day use.
			</p>

			<h2>Feature Comparison</h2>
			<table>
				<thead>
					<tr>
						<th>Feature</th>
						<th>Vault</th>
						<th>Redshift</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Static secrets</td>
						<td>Yes</td>
						<td>Yes</td>
					</tr>
					<tr>
						<td>Dynamic secrets</td>
						<td>Yes</td>
						<td>No</td>
					</tr>
					<tr>
						<td>PKI/certificates</td>
						<td>Yes</td>
						<td>No</td>
					</tr>
					<tr>
						<td>Self-hosted option</td>
						<td>Yes (required)</td>
						<td>Optional (run own relay)</td>
					</tr>
					<tr>
						<td>Managed service</td>
						<td>HCP Vault</td>
						<td>Not launched</td>
					</tr>
					<tr>
						<td>Zero-knowledge</td>
						<td>No</td>
						<td>Yes</td>
					</tr>
					<tr>
						<td>Free tier</td>
						<td>OSS only</td>
						<td>Unlimited for individuals</td>
					</tr>
					<tr>
						<td>Audit logs</td>
						<td>Yes</td>
						<td>Not currently</td>
					</tr>
					<tr>
						<td>SSO/SAML</td>
						<td>Enterprise</td>
						<td>Not launched</td>
					</tr>
				</tbody>
			</table>

			<h2>Can They Coexist?</h2>
			<p>
				Absolutely. Use Vault for dynamic database credentials and PKI -- that's what it's great at. Use Redshift for static secrets where you want true sovereignty. They solve different problems and complement each other fine.
			</p>

			<h2>Bottom Line</h2>
			<p>
				If you're a large enterprise with compliance requirements, a platform team, and budget for infrastructure -- use Vault. It's earned its reputation and we're not going to pretend otherwise.
			</p>
			<p>
				If you're an individual developer or open-source maintainer who wants sovereign static-secret workflows, Redshift may fit. Shared team custody, RBAC, and enterprise controls are not launched.
			</p>
			<p>
				<a href="/admin">Give Redshift a try</a> and see if it fits how you work. If Vault is a better fit, no hard feelings -- it's a good tool.
			</p>
		`,
	},
	{
		slug: 'the-case-for-self-sovereign-developer-identity',
		title: 'The Case for Self-Sovereign Developer Identity',
		description:
			'Your GitHub account can be suspended. Your email can be shut down. What if your developer identity was truly yours?',
		date: '2024-10-12',
		author: 'Redshift Team',
		readingTime: '6 min read',
		tags: ['sovereignty', 'identity', 'philosophy'],
		content: `
			<p class="lead">
				Think about how many places own a piece of your developer identity. GitHub has your code and contribution graph. npm has your packages. Google has the email that resets everything else. Any of them can lock you out tomorrow, and there's not much you can do about it—unless the identity itself belongs to you and not the platform.
			</p>

			<h2>The Fragility of Platform Identity</h2>
			<p>
				Consider how much of your developer life depends on platform accounts:
			</p>
			<ul>
				<li><strong>GitHub</strong>: Your code, issues, PRs, profile, and contributions</li>
				<li><strong>npm/PyPI/crates.io</strong>: Your published packages</li>
				<li><strong>Docker Hub</strong>: Your container images</li>
				<li><strong>Email</strong>: Password resets for everything else</li>
				<li><strong>Work accounts</strong>: Access to company resources</li>
			</ul>
			<p>
				Each of these is a single point of failure. If GitHub suspends your account—for any reason—you lose access to everything there. If Google disables your Gmail, you lose the recovery mechanism for your other accounts.
			</p>

			<h2>It Happens More Often Than You Think</h2>
			<p>
				Account suspensions and lockouts are common:
			</p>
			<ul>
				<li>Automated systems flag accounts incorrectly</li>
				<li>Terms of service violations are interpreted broadly</li>
				<li>Company policies change after acquisitions</li>
				<li>Governments request account takedowns</li>
				<li>Payment disputes trigger lockouts</li>
			</ul>
			<p>
				Developers in sanctioned countries, politically controversial projects, and edge cases of all kinds have found themselves suddenly locked out with no recourse.
			</p>

			<h2>What Self-Sovereign Identity Means</h2>
			<p>
				Self-sovereign identity (SSI) is based on cryptographic keypairs that you control:
			</p>
			<ul>
				<li><strong>You generate your keys</strong>: No registration, no approval needed</li>
				<li><strong>You store your keys</strong>: They're not held by any platform</li>
				<li><strong>You control your keys</strong>: No one can revoke or suspend them</li>
			</ul>
			<p>
				Your public key becomes your identity. You prove ownership by signing messages with your private key. Platforms can verify your signatures without controlling your identity.
			</p>

			<h2>Nostr as Developer Identity</h2>
			<p>
				So what does this look like concretely? Nostr gives you a keypair:
			</p>
			<ul>
				<li><strong>npub</strong>: Your public identifier, derived from your public key</li>
				<li><strong>nsec</strong>: Your private key, stored on your own devices</li>
				<li><strong>Signatures</strong>: Cryptographic proof that you authored a given event</li>
			</ul>
			<p>
				The same keypair already works for social media, messaging, and payments across Nostr clients. Redshift extends it to secret management. The point isn't that Nostr is the only way to do this—it's that the protocol exists today and the tooling is usable right now.
			</p>

			<h2>Practical Benefits for Developers</h2>
			<p>
				The most immediate win is <strong>portable reputation</strong>. Contributions signed with your Nostr key are attributable to you forever. Platform shuts down? Doesn't matter—your signed commits still prove authorship. That history is yours, not GitHub's.
			</p>
			<p>
				There's also a simplification angle. One keypair authenticates you across every service that supports it. No more juggling credentials per platform, no more OAuth redirect chains. It's closer to how SSH keys already work, just applied to identity more broadly.
			</p>
			<p>
				Account recovery gets interesting too. Your private key <em>is</em> your account—there's no "forgot password" flow because there's no password. Back the key up properly and lockout becomes a non-issue. (The flip side of this shows up in the tradeoffs below.)
			</p>
			<p>
				And then there's the hard-to-quantify benefit: nobody can deplatform your identity. A service can refuse to host your content, sure. But they can't revoke the keypair. The identity persists regardless of any single provider's decisions.
			</p>

			<h2>The Tradeoffs</h2>
			<p>
				Self-sovereign identity has downsides:
			</p>
			<ul>
				<li><strong>Key management burden</strong>: You must secure your private key; lose it and you lose everything</li>
				<li><strong>No password reset</strong>: There's no "forgot password" button</li>
				<li><strong>Learning curve</strong>: The concepts are unfamiliar to most developers</li>
				<li><strong>Ecosystem maturity</strong>: Not all platforms support cryptographic identity yet</li>
			</ul>
			<p>
				These are real costs. But for developers who value long-term control over convenience, they're worth paying.
			</p>

			<h2>Getting Started</h2>
			<p>
				To start using self-sovereign identity today:
			</p>
			<ol>
				<li><strong>Get a Nostr keypair</strong>: Generate one in Alby, nos2x, or any Nostr client</li>
				<li><strong>Back up your nsec</strong>: Store it in a password manager or hardware device</li>
				<li><strong>Use NIP-07</strong>: Browser extensions let you authenticate without exposing your key</li>
				<li><strong>Try Redshift</strong>: Manage secrets with your Nostr identity, no account required</li>
			</ol>

			<h2>Where This Is Headed</h2>
			<p>
				Self-sovereign identity is still early, and honestly most developers aren't thinking about it yet. But the pieces are falling into place faster than you might expect—Nostr clients are improving, NIP-07 browser extensions work well, and more services are starting to accept cryptographic authentication.
			</p>
			<p>
				We built Redshift on this foundation because it made sense for the problem. Secrets are tied to your cryptographic identity, not to our platform. If Redshift goes away, your keypair and your encrypted data don't go with it.
			</p>
			<p>
				If you're curious what this feels like in practice, <a href="/admin">give it a try</a>—no account signup required, just a Nostr key.
			</p>
		`,
	},
	{
		slug: 'protecting-api-keys-in-serverless-functions',
		title: 'Protecting API Keys in Serverless Functions',
		description:
			'Serverless functions need secrets but have unique constraints. Learn patterns for secure secret injection in Lambda, Vercel, and Cloudflare Workers.',
		date: '2024-10-05',
		author: 'Redshift Team',
		readingTime: '5 min read',
		tags: ['serverless', 'tutorial', 'security'],
		content: `
			<p class="lead">
				If you've deployed a Lambda or a Vercel function, you've had the moment: where do I put the API key? You can't just drop a <code>.env</code> file on a filesystem that doesn't persist. Hardcoding it is obviously out. And every platform has its own way of handling this, which means the "right" answer changes depending on where you're deploying. Here's what we've seen work.
			</p>

			<h2>Why Serverless Makes This Harder</h2>
			<p>
				Regular servers are straightforward -- put secrets in env vars, config files, or pull from a vault at boot. Serverless blows that up in a few ways. There's no persistent disk, so anything you write is gone next invocation. Cold starts mean your function might need to re-fetch secrets from scratch. You usually can't install whatever you want in the runtime. And if you're deploying across Lambda, Vercel, and Workers, congratulations -- you now get to learn three different secret storage systems.
			</p>
			<p>
				None of these are unsolvable, but they do mean you have to think about <em>when</em> secrets enter the picture, not just <em>how</em>.
			</p>

			<h2>Pattern 1: Build-Time Injection</h2>
			<p>
				The simplest approach: pull secrets during your build step and bake them into the deployment as environment variables. This is what most teams start with, and honestly it works fine for a lot of cases.
			</p>
			<pre><code># In your build script or CI
$ redshift run -e production -- npm run build

# Or download and pass to your bundler
$ export $(redshift secrets download -e production --raw)
$ npm run build</code></pre>
			<p>
				The tradeoff is that your secrets end up in the deployment artifact. If someone gets access to the built bundle, they get the secrets too. For many internal tools this is acceptable risk. For anything handling payment keys or PII, you probably want one of the other patterns.
			</p>

			<h2>Pattern 2: Platform Secret Storage</h2>
			<p>
				This is the most common pattern we see in production: keep Redshift as the source of truth, but sync secrets into whatever native storage your platform provides. Your functions read secrets the way the platform expects, and you avoid any runtime dependency on external services.
			</p>

			<h3>Vercel</h3>
			<pre><code># Sync Redshift secrets to Vercel
$ redshift secrets download -e production --raw | while IFS='=' read -r key value; do
    vercel env add "$key" production <<< "$value"
done</code></pre>

			<h3>AWS Lambda</h3>
			<pre><code># Export a mode-0600 .env file, then parse it with deployment tooling
$ redshift secrets download -e production --raw ./secrets.env</code></pre>

			<h3>Cloudflare Workers</h3>
			<pre><code># Sync to Cloudflare secrets
$ redshift secrets download -e production --raw | while IFS='=' read -r key value; do
    echo "$value" | wrangler secret put "$key"
done</code></pre>
			<p>
				The downside is obvious: your secrets now live in two places. You need a sync step in CI, and if someone updates a secret on the platform directly, it'll get overwritten next deploy. Discipline helps. Making Redshift the only place anyone edits secrets helps more.
			</p>

			<h2>Pattern 3: Runtime Fetching</h2>
			<p>
				Instead of baking secrets in at build or syncing them ahead of time, you fetch them when the function starts up. This means secrets are always current -- no stale values sitting in platform storage from a deploy three months ago. The cost is cold start latency and a network dependency.
			</p>
			<pre><code>// Inside your serverless function
import { fetchSecrets } from './redshift-client';

let secrets: Record&lt;string, string&gt; | null = null;

export async function handler(event) {
    // Fetch once per cold start
    if (!secrets) {
        secrets = await fetchSecrets('my-project', 'production');
    }

    const apiKey = secrets.API_KEY;
    // ... use secrets
}</code></pre>
			<p>
				We cache outside the handler so warm invocations skip the fetch. On a Lambda with a ~500ms cold start, adding a relay query might push that to 700-800ms. Whether that matters depends entirely on your use case. For a webhook handler, nobody cares. For a user-facing API, maybe test it first.
			</p>

			<h2>Security Best Practices</h2>

			<h3>Never Log Secrets</h3>
			<p>
				This one bites people constantly. Serverless logs tend to go to centralized logging services where retention policies are generous and access controls are lax. One <code>console.log(process.env)</code> during debugging and your keys are sitting in CloudWatch for the next 90 days.
			</p>
			<pre><code>// Bad - secrets might appear in logs
console.log('Config:', process.env);

// Good - log only what you need
console.log('Function initialized');</code></pre>

			<h3>Use Least Privilege</h3>
			<p>
				Scope your secrets per function. The function that sends welcome emails doesn't need your Stripe secret key. This is annoying to set up and absolutely worth it when something goes wrong.
			</p>

			<h3>Rotate Regularly</h3>
			<p>
				Serverless functions have a sneaky property: they can run unchanged for months because nobody redeploys them. If you rotated a key but didn't redeploy the function that uses build-time injection, you've got a stale secret in production and a fresh one in Redshift and neither of you knows about the mismatch until something breaks.
			</p>

			<h3>Encrypt in Transit</h3>
			<p>
				If you're fetching secrets at runtime, make sure the connection is encrypted. HTTPS for REST APIs, WSS for Nostr relay connections. This should be the default, but verify it -- especially in local development where it's tempting to skip TLS.
			</p>

			<h2>Platform-Specific Notes</h2>

			<h3>AWS Lambda</h3>
			<ul>
				<li>Secrets Manager and Parameter Store both work; Parameter Store is cheaper for static secrets</li>
				<li>Lambda extensions can pre-fetch secrets before your handler even runs, which is nice for cold starts</li>
				<li>IAM roles are how you control which functions can access which secrets -- use them, don't just give everything <code>secretsmanager:GetSecretValue</code> on <code>*</code></li>
			</ul>

			<h3>Vercel</h3>
			<ul>
				<li>Environment variables are encrypted at rest, which is good</li>
				<li>You can set different values for preview vs. production, which helps prevent the "tested in staging, deployed prod credentials to preview" mistake</li>
				<li>Edge functions run in a more restricted environment than serverless functions -- check what APIs are available before assuming your secret-fetching code will work there</li>
			</ul>

			<h3>Cloudflare Workers</h3>
			<ul>
				<li>Workers Secrets are the right choice for sensitive values -- don't put secrets in KV, it's readable through the API</li>
				<li>The V8 isolate model means less risk of cross-request leakage compared to traditional containers</li>
				<li>The <code>wrangler secret put</code> CLI is straightforward but doesn't support bulk import, hence the loop in the sync script above</li>
			</ul>

			<h2>What Most Teams End Up Doing</h2>
			<p>
				In practice, most teams we've talked to land on some version of pattern 2: Redshift as the canonical store, platform secrets synced during CI/CD, platform-native access at runtime. It's not the most elegant architecture on a whiteboard, but it works reliably and doesn't add latency to function invocations.
			</p>
			<p>
				Some teams add runtime fetching for secrets that change frequently (API keys that get rotated weekly, feature flags). Some skip the platform sync entirely and do build-time injection because their deploys are frequent enough that staleness isn't a concern. There's no single right answer -- it depends on how often your secrets change, how sensitive they are, and how much cold start latency you can tolerate.
			</p>

			<h2>Get Started</h2>
			<p>
				If you want to try any of these patterns, <a href="/docs/quickstart">the quickstart</a> will get you from zero to synced secrets in a few minutes. The <a href="/docs/cli">CLI docs</a> cover the plaintext acknowledgement and <code>secrets download --raw</code> contract in detail.
			</p>
		`,
	},
];

/**
 * Get all posts sorted by date (newest first)
 */
export function getAllPosts(): BlogPost[] {
	return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get a single post by slug
 */
export function getPostBySlug(slug: string): BlogPost | undefined {
	return posts.find((post) => post.slug === slug);
}

/**
 * Get all unique tags from posts
 */
export function getAllTags(): string[] {
	const tagSet = new Set<string>();
	for (const post of posts) {
		for (const tag of post.tags) {
			tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort();
}

/**
 * Get posts by tag
 */
export function getPostsByTag(tag: string): BlogPost[] {
	return getAllPosts().filter((post) => post.tags.includes(tag));
}
