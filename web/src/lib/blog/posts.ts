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
				Traditional secret managers like Doppler, HashiCorp Vault, and AWS Secrets Manager have made managing secrets easier. But they've also created a fundamental problem: <strong>you don't own your secrets</strong>.
			</p>
			<p>
				When you store secrets with these providers, you're trusting them with the keys to your kingdom. They can:
			</p>
			<ul>
				<li>Revoke your access at any time</li>
				<li>Be compelled to hand over your data to authorities</li>
				<li>Suffer breaches that expose your credentials</li>
				<li>Change pricing or terms of service</li>
				<li>Shut down entirely, leaving you scrambling</li>
			</ul>

			<h2>What is Secret Sovereignty?</h2>
			<p>
				Secret sovereignty means you have complete, unconditional control over your credentials. No third party can access, revoke, or compromise your secrets without your explicit consent.
			</p>
			<p>
				This isn't just a philosophical ideal—it's a practical necessity for:
			</p>
			<ul>
				<li><strong>Open source projects</strong> that need to operate independently of any company</li>
				<li><strong>Privacy-focused applications</strong> where data protection is paramount</li>
				<li><strong>Developers in restrictive jurisdictions</strong> who need censorship-resistant infrastructure</li>
				<li><strong>Anyone who values long-term reliability</strong> over vendor convenience</li>
			</ul>

			<h2>How Redshift Enables Sovereignty</h2>
			<p>
				Redshift is built on three principles that guarantee sovereignty:
			</p>

			<h3>1. Client-Side Encryption</h3>
			<p>
				Your secrets never leave your device unencrypted. We use NIP-59 Gift Wrap encryption, meaning even the relays that store your data can't read it. There's no server-side key, no admin backdoor, no way for anyone to access your plaintext secrets.
			</p>

			<h3>2. Decentralized Storage</h3>
			<p>
				Instead of storing secrets on a single company's servers, Redshift uses the Nostr protocol to distribute your encrypted data across multiple independent relays. There's no single point of failure—if one relay goes down, your secrets are still accessible from others.
			</p>

			<h3>3. Your Keys, Your Data</h3>
			<p>
				Redshift uses your Nostr identity for authentication. You own your private key, which means you own your secrets. No account required, no vendor lock-in, no permission needed. Export your data anytime using standard Nostr protocols.
			</p>

			<h2>The Future is Sovereign</h2>
			<p>
				The trend toward decentralization isn't slowing down. As developers increasingly recognize the risks of centralized infrastructure, tools like Redshift will become the standard for security-conscious teams.
			</p>
			<p>
				Ready to own your secrets? <a href="/admin">Get started for free</a>—no credit card, no account, just sovereignty.
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
				Most developers know Nostr as "that decentralized Twitter thing." But the protocol's potential extends far beyond social media—and it's already being used to build the next generation of developer infrastructure.
			</p>

			<h2>What is Nostr, Really?</h2>
			<p>
				At its core, Nostr (Notes and Other Stuff Transmitted by Relays) is a simple, open protocol for creating censorship-resistant global networks. It consists of:
			</p>
			<ul>
				<li><strong>Clients</strong>: Applications that create and display content</li>
				<li><strong>Relays</strong>: Servers that store and forward messages</li>
				<li><strong>Events</strong>: Signed JSON objects representing any kind of data</li>
			</ul>
			<p>
				The genius of Nostr is its simplicity. Events are just JSON. Signing uses standard secp256k1 cryptography. Relays are dumb pipes that store and query events. This simplicity makes it incredibly versatile.
			</p>

			<h2>Why Nostr for Developer Tools?</h2>
			<p>
				Several properties make Nostr ideal for developer infrastructure:
			</p>

			<h3>Identity Without Registration</h3>
			<p>
				Your Nostr identity is a public/private keypair. No email verification, no phone number, no "sign up" flow. Generate a keypair and you're done. This is perfect for CLI tools that need authentication without the overhead of OAuth flows.
			</p>

			<h3>Built-in Encryption</h3>
			<p>
				Nostr includes NIP-04 (direct messages) and NIP-59 (gift wrap) for encrypted communication. This means you can build end-to-end encrypted applications without implementing your own crypto.
			</p>

			<h3>Decentralized by Default</h3>
			<p>
				Data is replicated across multiple relays automatically. There's no need to set up replication, handle failover, or worry about a single provider going down.
			</p>

			<h3>Interoperability</h3>
			<p>
				Any Nostr client can read any Nostr event. This means your data isn't locked into one application—you can switch tools, build custom integrations, or migrate entirely without losing anything.
			</p>

			<h2>What Developers Are Building</h2>
			<p>
				Beyond social media, Nostr is powering:
			</p>
			<ul>
				<li><strong>Redshift</strong>: Decentralized secret management (that's us!)</li>
				<li><strong>Nostr Git</strong>: Git hosting on Nostr relays</li>
				<li><strong>Stemstr</strong>: Music collaboration and sharing</li>
				<li><strong>Npub.cash</strong>: Bitcoin Lightning wallets tied to Nostr identity</li>
				<li><strong>Highlighter</strong>: Decentralized annotations and highlights</li>
			</ul>

			<h2>Getting Started with Nostr Development</h2>
			<p>
				If you want to build on Nostr, here's where to start:
			</p>
			<ol>
				<li><strong>Read the NIPs</strong>: <a href="https://github.com/nostr-protocol/nips" target="_blank" rel="noopener">Nostr Implementation Possibilities</a> define the protocol</li>
				<li><strong>Use nostr-tools</strong>: The de facto JavaScript library for Nostr development</li>
				<li><strong>Run a local relay</strong>: Try nostream or strfry for local development</li>
				<li><strong>Get a NIP-07 extension</strong>: Alby or nos2x for browser-based signing</li>
			</ol>

			<h2>The Nostr Ecosystem is Growing</h2>
			<p>
				Nostr is still young, but it's growing fast. The protocol's simplicity means new use cases are emerging constantly. Whether you're building a CLI tool, a web app, or something entirely new, Nostr provides a solid foundation for decentralized, censorship-resistant infrastructure.
			</p>
			<p>
				Ready to see Nostr in action? <a href="/docs/what-is-nostr">Read our Nostr explainer</a> or <a href="/admin">try Redshift</a>—it's built entirely on Nostr.
			</p>
		`,
	},
	{
		slug: 'migrating-from-doppler-to-redshift',
		title: 'Migrating from Doppler to Redshift: Complete Guide',
		description:
			"Redshift is designed as a drop-in replacement for Doppler. Here's how to migrate your secrets in under 10 minutes.",
		date: '2024-12-10',
		author: 'Redshift Team',
		readingTime: '4 min read',
		tags: ['migration', 'doppler', 'tutorial'],
		content: `
			<p class="lead">
				Redshift's CLI is designed to be Doppler-compatible. If you're using <code>doppler run</code> in your scripts, you can switch to <code>redshift run</code> with minimal changes.
			</p>

			<h2>Before You Begin</h2>
			<p>
				Make sure you have:
			</p>
			<ul>
				<li>Redshift CLI installed (<code>curl -fsSL https://redshiftapp.com/install | sh</code>)</li>
				<li>A Nostr identity (NIP-07 extension or nsec key)</li>
				<li>Access to your Doppler project</li>
			</ul>

			<h2>Step 1: Export Secrets from Doppler</h2>
			<p>
				First, export your secrets from Doppler in JSON format:
			</p>
			<pre><code>doppler secrets download --no-file --format json > secrets.json</code></pre>
			<p>
				This creates a JSON file with all your secrets for the current environment.
			</p>

			<h2>Step 2: Authenticate with Redshift</h2>
			<p>
				Log in to Redshift using your preferred authentication method:
			</p>
			<pre><code>redshift login</code></pre>
			<p>
				Select NIP-07 browser extension (recommended) or enter your nsec manually.
			</p>

			<h2>Step 3: Create a Project</h2>
			<p>
				Create a new Redshift project to match your Doppler project:
			</p>
			<pre><code>redshift setup</code></pre>
			<p>
				This interactive wizard will guide you through project and environment creation.
			</p>

			<h2>Step 4: Upload Your Secrets</h2>
			<p>
				Upload the secrets you exported from Doppler:
			</p>
			<pre><code>redshift secrets upload secrets.json</code></pre>
			<p>
				Your secrets are now encrypted with your Nostr identity and stored on decentralized relays.
			</p>

			<h2>Step 5: Update Your Scripts</h2>
			<p>
				Replace <code>doppler run</code> with <code>redshift run</code> in your scripts:
			</p>
			<pre><code># Before
doppler run -- npm start

# After
redshift run -- npm start</code></pre>
			<p>
				That's it. The command syntax is identical.
			</p>

			<h2>Step 6: Clean Up</h2>
			<p>
				Once you've verified everything works:
			</p>
			<ol>
				<li>Delete the <code>secrets.json</code> file (it contains plaintext secrets!)</li>
				<li>Update your CI/CD pipelines to use <code>redshift</code></li>
				<li>Optionally, revoke your Doppler secrets</li>
			</ol>

			<h2>Command Compatibility Reference</h2>
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

			<h2>Need Help?</h2>
			<p>
				Check out our <a href="/docs/cli">CLI documentation</a> or <a href="https://github.com/accolver/redshift" target="_blank" rel="noopener">open an issue on GitHub</a>.
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
				Redshift stores your secrets on public Nostr relays, yet no one can read them except you. The magic behind this is NIP-59 Gift Wrap—a sophisticated encryption scheme that provides metadata protection beyond simple message encryption.
			</p>

			<h2>The Problem: Metadata Leaks</h2>
			<p>
				Traditional encrypted messaging has a fundamental problem: even when the message content is encrypted, the metadata is often exposed. This includes:
			</p>
			<ul>
				<li><strong>Who sent the message</strong> (the public key of the sender)</li>
				<li><strong>When it was sent</strong> (the timestamp)</li>
				<li><strong>Who can decrypt it</strong> (the recipient's public key)</li>
			</ul>
			<p>
				For secret management, this metadata exposure is dangerous. An attacker could determine which projects you're working on, when you last updated credentials, and potentially correlate your identity across services.
			</p>

			<h2>How NIP-59 Gift Wrap Works</h2>
			<p>
				NIP-59 solves metadata leakage with a three-layer encryption scheme. Think of it like putting a letter inside an envelope, inside another envelope, with a random return address.
			</p>

			<h3>Layer 1: The Rumor (Unsigned Event)</h3>
			<p>
				The actual content (your secrets) is placed in an unsigned Nostr event called a "rumor." This event has no cryptographic signature, so it can't be attributed to anyone just by looking at it.
			</p>
			<pre><code>{
  "kind": 30078,
  "content": "DATABASE_URL=postgres://...",
  "tags": [["d", "my-project|production"]],
  // No "sig" field - unsigned!
}</code></pre>

			<h3>Layer 2: The Seal (Encrypted Rumor)</h3>
			<p>
				The rumor is encrypted to the recipient using NIP-44 encryption and wrapped in a "seal" event. The seal is signed by the sender, but this signature is about to be hidden.
			</p>
			<pre><code>{
  "kind": 13,
  "content": "[encrypted rumor]",
  "pubkey": "[sender's real pubkey]",
  "sig": "[sender's signature]"
}</code></pre>

			<h3>Layer 3: The Gift Wrap (Hidden Sender)</h3>
			<p>
				Here's the clever part: the seal is encrypted again and placed in a "gift wrap" event signed by a <strong>random, one-time keypair</strong>. The timestamp is also randomized within a window.
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
				To anyone observing the relay, this event appears to come from a random, unknown sender. The real sender's identity is hidden inside the encrypted layers.
			</p>

			<h2>Why This Matters for Secret Management</h2>
			<p>
				With NIP-59, Redshift achieves true confidentiality:
			</p>
			<ul>
				<li><strong>Content protection</strong>: Your secrets are encrypted with NIP-44</li>
				<li><strong>Sender anonymity</strong>: No one knows which Nostr identity stored the secrets</li>
				<li><strong>Timing obfuscation</strong>: Randomized timestamps prevent activity correlation</li>
				<li><strong>Relay blindness</strong>: Relays store encrypted blobs with no idea what's inside</li>
			</ul>

			<h2>The Encryption Under the Hood</h2>
			<p>
				NIP-44, used for the actual encryption, provides:
			</p>
			<ul>
				<li><strong>ChaCha20 with HMAC-SHA256</strong>: Modern authenticated encryption</li>
				<li><strong>secp256k1 ECDH</strong>: Key agreement using Nostr keypairs</li>
				<li><strong>HKDF key derivation</strong>: Secure key expansion</li>
				<li><strong>Padding</strong>: Message length obfuscation</li>
			</ul>
			<p>
				The combination means that even if an attacker compromises a relay and captures all traffic, they learn nothing about your secrets—not the content, not the sender, not even the approximate time they were stored.
			</p>

			<h2>Decryption Flow</h2>
			<p>
				When you fetch secrets with Redshift, the decryption happens in reverse:
			</p>
			<ol>
				<li>Query relays for Gift Wrap events tagged with your public key</li>
				<li>Decrypt the gift wrap to reveal the seal</li>
				<li>Verify the seal's signature matches your own public key (self-sent secrets)</li>
				<li>Decrypt the seal to reveal the rumor</li>
				<li>Parse the rumor to extract your secrets</li>
			</ol>
			<p>
				All of this happens client-side. The relays never see your private key, and the decrypted secrets never leave your device.
			</p>

			<h2>Security Considerations</h2>
			<p>
				NIP-59 is secure, but it's not magic. Keep these points in mind:
			</p>
			<ul>
				<li><strong>Key management is critical</strong>: If someone gets your nsec, they get your secrets</li>
				<li><strong>Relay availability matters</strong>: Use multiple relays for redundancy</li>
				<li><strong>Forward secrecy is limited</strong>: Old secrets encrypted with a compromised key are exposed</li>
			</ul>

			<h2>Try It Yourself</h2>
			<p>
				Want to see NIP-59 in action? <a href="/admin">Create a Redshift project</a> and inspect the network traffic—you'll see encrypted Gift Wrap events with no identifiable sender. Your secrets are truly sovereign.
			</p>
			<p>
				For more technical details, read <a href="https://github.com/nostr-protocol/nips/blob/master/59.md" target="_blank" rel="noopener">NIP-59 on GitHub</a> or explore our <a href="/docs/security">security documentation</a>.
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
				When evaluating secret management tools, most teams focus on pricing, features, and ease of use. But the most significant costs of centralized providers aren't on the pricing page—they're hidden in the fine print, the architecture, and the long-term implications of giving up control.
			</p>

			<h2>Cost #1: Vendor Lock-in</h2>
			<p>
				Every secret manager has its own API, CLI syntax, and data format. The deeper you integrate, the harder it becomes to leave. This creates leverage that vendors exploit:
			</p>
			<ul>
				<li><strong>Price increases</strong>: Once you're locked in, vendors can raise prices knowing migration is painful</li>
				<li><strong>Feature bundling</strong>: Essential features get moved to higher tiers</li>
				<li><strong>Acquisition risk</strong>: When your vendor gets acquired, priorities change—often not in your favor</li>
			</ul>
			<p>
				We've seen this play out repeatedly. HashiCorp's license change to BSL. Heroku's free tier elimination. Docker's rate limiting. The pattern is predictable: grow users with generous terms, then tighten the screws.
			</p>

			<h2>Cost #2: Compliance Complexity</h2>
			<p>
				Storing secrets with a third party introduces compliance headaches:
			</p>
			<ul>
				<li><strong>Data residency</strong>: Where are your secrets physically stored? Can you prove it?</li>
				<li><strong>Audit trails</strong>: Who at the vendor has accessed your data?</li>
				<li><strong>Subpoena risk</strong>: Your secrets are subject to the vendor's legal jurisdiction</li>
				<li><strong>Breach notification</strong>: If the vendor is breached, you may be the last to know</li>
			</ul>
			<p>
				For regulated industries, these aren't theoretical concerns—they're audit findings waiting to happen.
			</p>

			<h2>Cost #3: Single Point of Failure</h2>
			<p>
				Centralized services fail. When they do, your entire deployment pipeline stops:
			</p>
			<ul>
				<li><strong>Outages</strong>: AWS has outages. Azure has outages. Everyone has outages.</li>
				<li><strong>Rate limiting</strong>: Hit API limits during a critical deployment? Too bad.</li>
				<li><strong>Account suspension</strong>: Billing issues, ToS disputes, or mistakes can lock you out instantly</li>
			</ul>
			<p>
				In 2023 alone, major cloud providers experienced dozens of significant outages. Each one represents developers unable to deploy, unable to access credentials, unable to work.
			</p>

			<h2>Cost #4: The Trust Tax</h2>
			<p>
				Every centralized provider requires you to trust them with your most sensitive data:
			</p>
			<ul>
				<li><strong>Trust their employees</strong>: Insider threats are real and documented</li>
				<li><strong>Trust their security</strong>: You can't audit their actual implementation</li>
				<li><strong>Trust their longevity</strong>: Startups fail, get acquired, or pivot</li>
				<li><strong>Trust their ethics</strong>: Will they sell your data? Cooperate with surveillance?</li>
			</ul>
			<p>
				This isn't paranoia—it's risk assessment. Every additional trust relationship is a potential failure point.
			</p>

			<h2>Cost #5: Loss of Sovereignty</h2>
			<p>
				The most insidious cost is philosophical: when you store secrets with a third party, they're not really <em>your</em> secrets anymore. The provider can:
			</p>
			<ul>
				<li>Revoke your access at any time</li>
				<li>Change how your data is stored or processed</li>
				<li>Be compelled by governments to hand over your data</li>
				<li>Shut down entirely, with limited notice</li>
			</ul>
			<p>
				This loss of sovereignty has real consequences for open-source projects, activists, journalists, and anyone operating outside mainstream approval.
			</p>

			<h2>The Alternative: Decentralized Sovereignty</h2>
			<p>
				Redshift eliminates these hidden costs by design:
			</p>
			<ul>
				<li><strong>No lock-in</strong>: Your data uses standard Nostr protocols—export anytime</li>
				<li><strong>No single point of failure</strong>: Secrets are replicated across independent relays</li>
				<li><strong>No trust required</strong>: Client-side encryption means we can't read your secrets</li>
				<li><strong>True ownership</strong>: Your keys, your data, your rules</li>
			</ul>
			<p>
				The upfront learning curve of a new tool is nothing compared to the compounding costs of centralized dependency.
			</p>

			<h2>Calculate Your Real Cost</h2>
			<p>
				Next time you evaluate a secret manager, ask yourself:
			</p>
			<ol>
				<li>What happens if I need to leave this vendor in 2 years?</li>
				<li>What happens if they have a major breach?</li>
				<li>What happens if they're acquired by a competitor?</li>
				<li>What happens if they're subpoenaed for my data?</li>
			</ol>
			<p>
				If the answers make you uncomfortable, it might be time to consider a sovereign alternative. <a href="/admin">Try Redshift free</a>—and own your secrets for real.
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
				Open source projects need secrets too—API keys for CI/CD, tokens for publishing packages, credentials for test infrastructure. But most secret management solutions assume you have a corporate credit card and a procurement process. Here's how to manage secrets when you're building in the open.
			</p>

			<h2>The Open Source Secret Challenge</h2>
			<p>
				Open source maintainers face unique constraints:
			</p>
			<ul>
				<li><strong>No budget</strong>: Many projects run on volunteer time with zero funding</li>
				<li><strong>Rotating contributors</strong>: People come and go; access management is crucial</li>
				<li><strong>Public repositories</strong>: One accidental commit can expose credentials</li>
				<li><strong>CI/CD complexity</strong>: Secrets need to be available in automated workflows</li>
				<li><strong>Bus factor</strong>: What happens if the primary maintainer is unavailable?</li>
			</ul>
			<p>
				Traditional solutions either cost money, require corporate accounts, or introduce dependencies that outlive the project.
			</p>

			<h2>Pattern 1: Environment Separation</h2>
			<p>
				Keep development secrets completely separate from production:
			</p>
			<ul>
				<li><strong>Development</strong>: Use local-only credentials, mock services, or public test APIs</li>
				<li><strong>CI/CD</strong>: Dedicated secrets with minimal permissions, rotated regularly</li>
				<li><strong>Production</strong>: Tightly controlled, accessed only by release automation</li>
			</ul>
			<p>
				With Redshift, each environment is a separate namespace. Contributors can have access to development secrets without ever seeing production credentials.
			</p>
			<pre><code>$ redshift setup
? Select environment: development
? Select environment: ci
? Select environment: production

$ redshift run -e development -- npm test</code></pre>

			<h2>Pattern 2: Minimal Permissions</h2>
			<p>
				Every secret should have the minimum permissions required:
			</p>
			<ul>
				<li><strong>Read-only tokens</strong> for most CI jobs</li>
				<li><strong>Scoped API keys</strong> limited to specific actions</li>
				<li><strong>Time-limited credentials</strong> that expire automatically</li>
			</ul>
			<p>
				If a secret is exposed, the blast radius should be as small as possible. A token that can only read public package metadata is far less dangerous than one with full admin access.
			</p>

			<h2>Pattern 3: Contributor Access Without Shared Secrets</h2>
			<p>
				The biggest mistake projects make is sharing a single set of credentials among all maintainers. When someone leaves, you have to rotate everything.
			</p>
			<p>
				Better approaches:
			</p>
			<ul>
				<li><strong>Per-contributor tokens</strong>: Each maintainer has their own credentials</li>
				<li><strong>Role-based access</strong>: Define roles (release manager, CI admin) with specific permissions</li>
				<li><strong>Audit logging</strong>: Know who accessed what and when</li>
			</ul>
			<p>
				Redshift's roadmap includes team features specifically designed for this—cryptographic access control without a central authority.
			</p>

			<h2>Pattern 4: Secrets in CI/CD</h2>
			<p>
				GitHub Actions, GitLab CI, and other platforms have built-in secret storage. Use it wisely:
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
				The CI platform only stores your Nostr identity—actual secrets are fetched at runtime from decentralized relays.
			</p>

			<h2>Pattern 5: The Bus Factor Solution</h2>
			<p>
				What happens if you're hit by a bus (or just take a vacation)?
			</p>
			<ul>
				<li><strong>Document everything</strong>: List all secrets and their purposes in a private maintainer doc</li>
				<li><strong>Multi-maintainer access</strong>: At least two people should be able to access critical credentials</li>
				<li><strong>Recovery procedures</strong>: Write down how to regenerate or rotate each secret</li>
			</ul>
			<p>
				With Redshift, you can share encrypted secrets with co-maintainers using their Nostr public keys. No central service required—just cryptography.
			</p>

			<h2>Pattern 6: Public Secrets for Development</h2>
			<p>
				Some "secrets" don't need to be secret in development:
			</p>
			<ul>
				<li><strong>Public API keys</strong> for services with generous free tiers</li>
				<li><strong>Test credentials</strong> for sandboxed environments</li>
				<li><strong>Mock service tokens</strong> that work in development only</li>
			</ul>
			<p>
				Document these clearly so new contributors can get started without requesting access. Keep them in a <code>.env.example</code> file committed to the repo.
			</p>

			<h2>Getting Started</h2>
			<p>
				For open source projects, Redshift offers:
			</p>
			<ul>
				<li><strong>Free forever</strong>: No credit card, no limits for individuals</li>
				<li><strong>Decentralized</strong>: No corporate account or billing relationship required</li>
				<li><strong>Portable</strong>: If Redshift disappears tomorrow, your encrypted secrets are still on Nostr relays</li>
			</ul>
			<p>
				Ready to secure your open source project? <a href="/docs/quickstart">Read the quickstart guide</a> or <a href="/admin">create your first project</a>.
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
				When a security tool is closed-source, you're placing blind trust in the vendor's claims. When it's open source, you can verify those claims yourself—or pay someone you trust to verify them for you.
			</p>

			<h2>The Trust Problem</h2>
			<p>
				Every security tool makes promises:
			</p>
			<ul>
				<li>"We use military-grade encryption"</li>
				<li>"Your data is never stored unencrypted"</li>
				<li>"We can't access your secrets"</li>
				<li>"There are no backdoors"</li>
			</ul>
			<p>
				With closed-source software, these are just marketing claims. You have no way to verify them. The vendor could be lying, mistaken, or compromised—and you'd never know.
			</p>

			<h2>What Open Source Enables</h2>

			<h3>Independent Audits</h3>
			<p>
				Anyone can review the code. Security researchers, competitors, paranoid users—all can examine exactly how the software works. Bugs and vulnerabilities get found faster because more eyes are looking.
			</p>
			<p>
				Redshift's encryption implementation is visible at <a href="https://github.com/accolver/redshift" target="_blank" rel="noopener">github.com/accolver/redshift</a>. You can verify we're using NIP-59 correctly, that secrets are encrypted before transmission, and that there's no key escrow.
			</p>

			<h3>No Hidden Backdoors</h3>
			<p>
				Closed-source vendors can be compelled—by governments, by investors, by acquirers—to add backdoors. They might not even tell you about it.
			</p>
			<p>
				With open source, backdoors are visible. If we added one, someone would notice. The code is the contract.
			</p>

			<h3>Longevity and Forking</h3>
			<p>
				Companies fail. Products get discontinued. Acquisitions happen.
			</p>
			<p>
				When a closed-source security tool dies, your data may die with it. When an open-source tool's maintainers move on, the community can fork it and continue development. Your investment in learning the tool, integrating it, and storing data with it is protected.
			</p>

			<h3>Customization</h3>
			<p>
				Need a feature the vendor won't build? With open source, you can build it yourself or hire someone to build it. You're not dependent on the vendor's roadmap or priorities.
			</p>

			<h2>The "Security Through Obscurity" Myth</h2>
			<p>
				Some vendors claim that hiding their code makes it more secure. This is a discredited idea in security circles.
			</p>
			<p>
				Good security doesn't depend on attackers not knowing how it works. AES encryption, TLS, and every other trusted security standard is fully documented. Security comes from strong algorithms and proper implementation—not from hiding the details.
			</p>
			<p>
				In fact, obscurity often <em>hides</em> security problems rather than preventing them. The most embarrassing security breaches often come from closed-source systems that looked secure on the surface.
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
				But these challenges exist for closed-source too—they're just invisible. At least with open source, you have the <em>option</em> to verify.
			</p>

			<h2>Redshift's Approach</h2>
			<p>
				Redshift is MIT licensed. Every line of code is public:
			</p>
			<ul>
				<li><strong>CLI</strong>: The binary you run on your machine</li>
				<li><strong>Web admin</strong>: The dashboard you use to manage secrets</li>
				<li><strong>Crypto libraries</strong>: The encryption implementation</li>
			</ul>
			<p>
				We believe security tools should be verifiable. If you don't trust us, read the code. If you find a bug, open an issue. If you want a feature, submit a PR.
			</p>
			<p>
				That's how security software should work. <a href="/admin">Try Redshift</a> and verify for yourself.
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
				Your CI/CD pipeline needs access to secrets—API keys, deployment credentials, signing certificates. Here's how to use Redshift to inject secrets into automated workflows without exposing them in your repository or CI platform.
			</p>

			<h2>The Problem with CI/CD Secrets</h2>
			<p>
				Most CI platforms have built-in secret storage, but it comes with limitations:
			</p>
			<ul>
				<li><strong>Platform lock-in</strong>: Secrets stored in GitHub Actions don't transfer to GitLab</li>
				<li><strong>Access control gaps</strong>: Anyone with repo admin access can often read secrets</li>
				<li><strong>Audit limitations</strong>: Tracking who accessed what and when is often poor</li>
				<li><strong>No versioning</strong>: Rolling back a secret change is difficult</li>
			</ul>
			<p>
				Redshift solves this by storing secrets on decentralized Nostr relays and injecting them at runtime.
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
				Store your CI Nostr identity as a repository secret, then use Redshift in your workflow:
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
				Add <code>REDSHIFT_NSEC</code> as a CI/CD variable in your project settings:
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
				Add <code>REDSHIFT_NSEC</code> in Project Settings → Environment Variables:
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

			<h2>Security Best Practices</h2>

			<h3>Use Dedicated CI Identities</h3>
			<p>
				Don't use your personal Nostr identity for CI. Create a separate keypair using a Nostr key generator or your NIP-07 extension, then authenticate with it:
			</p>
			<pre><code># Generate a new keypair using any Nostr tool (e.g., nak, nostr-tools)
$ nak key generate
npub1abc...xyz
nsec1...

# Then login with the new identity
$ redshift login --nsec nsec1...</code></pre>
			<p>
				This limits blast radius if the CI secret is exposed and makes revocation easier.
			</p>

			<h3>Scope Secrets by Environment</h3>
			<p>
				Use different environments for different pipeline stages:
			</p>
			<ul>
				<li><code>-e ci</code> for build/test jobs (limited secrets)</li>
				<li><code>-e staging</code> for staging deployments</li>
				<li><code>-e production</code> for production deployments (restricted access)</li>
			</ul>

			<h3>Rotate Regularly</h3>
			<p>
				Rotate your CI Nostr identity periodically, especially after team changes. Since secrets are encrypted to the identity, you'll need to re-share secrets with the new identity.
			</p>

			<h2>Debugging CI Issues</h2>
			<p>
				If secrets aren't being injected:
			</p>
			<ol>
				<li>Verify <code>REDSHIFT_NSEC</code> is set: <code>echo $REDSHIFT_NSEC | head -c 10</code></li>
				<li>Check relay connectivity: <code>redshift status</code></li>
				<li>Verify project/environment exist: <code>redshift projects list</code></li>
				<li>Test locally with the same identity</li>
			</ol>

			<h2>Next Steps</h2>
			<p>
				With Redshift in your CI/CD pipeline, you get:
			</p>
			<ul>
				<li>Secrets that aren't locked into any CI platform</li>
				<li>Cryptographic access control without shared credentials</li>
				<li>The same secrets locally and in CI</li>
			</ul>
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
				This is similar to how MetaMask works for Ethereum—the extension holds your keys, and websites request signatures through a standard interface.
			</p>

			<h2>Why Use a NIP-07 Extension?</h2>
			<ul>
				<li><strong>Key isolation</strong>: Your private key never leaves the extension</li>
				<li><strong>Phishing protection</strong>: Malicious websites can't steal your nsec</li>
				<li><strong>Convenience</strong>: One-click authentication across all Nostr apps</li>
				<li><strong>Approval control</strong>: You approve each signing request</li>
			</ul>

			<h2>Popular NIP-07 Extensions</h2>

			<h3>Alby</h3>
			<p>
				<a href="https://getalby.com" target="_blank" rel="noopener">Alby</a> is the most popular option. It combines a Bitcoin Lightning wallet with Nostr key management:
			</p>
			<ul>
				<li>Available for Chrome, Firefox, and Safari</li>
				<li>Supports multiple Nostr accounts</li>
				<li>Integrates Lightning payments with Nostr identity</li>
				<li>Open source and actively maintained</li>
			</ul>

			<h3>nos2x</h3>
			<p>
				<a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noopener">nos2x</a> is a minimal, no-frills option:
			</p>
			<ul>
				<li>Chrome only</li>
				<li>Does one thing well: signs Nostr events</li>
				<li>Lightweight and simple</li>
			</ul>

			<h3>Flamingo</h3>
			<p>
				A newer option focused on mobile-friendly design and ease of use.
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

			<h2>Security Considerations</h2>

			<h3>Extension Permissions</h3>
			<p>
				NIP-07 extensions can request different permission levels:
			</p>
			<ul>
				<li><strong>Read public key</strong>: Always allowed, just returns your npub</li>
				<li><strong>Sign events</strong>: Requires approval, signs Nostr events</li>
				<li><strong>Encrypt/decrypt</strong>: Requires approval, used for private messages and secrets</li>
			</ul>
			<p>
				Redshift needs all three. Review the permission requests before approving.
			</p>

			<h3>Site Allowlists</h3>
			<p>
				Configure your extension to auto-approve requests from trusted sites like redshiftapp.com. This improves UX while maintaining security for unknown sites.
			</p>

			<h3>Backup Your Keys</h3>
			<p>
				Your extension stores keys locally. If you clear browser data or switch devices, you'll need your nsec backup. Export it from the extension settings and store it securely (password manager, encrypted note, hardware backup).
			</p>

			<h2>Troubleshooting</h2>

			<h3>Extension Not Detected</h3>
			<p>
				If Redshift doesn't see your extension:
			</p>
			<ul>
				<li>Refresh the page after installing the extension</li>
				<li>Check that the extension is enabled</li>
				<li>Try a different browser (some extensions are Chrome-only)</li>
			</ul>

			<h3>Signing Requests Timing Out</h3>
			<p>
				If approval popups don't appear:
			</p>
			<ul>
				<li>Click the extension icon to check for pending requests</li>
				<li>Disable popup blockers for the extension</li>
				<li>Restart the browser</li>
			</ul>

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
				Most applications run in multiple environments: development, staging, production, and maybe more. Each environment needs its own set of secrets, and mixing them up can cause anything from test failures to production outages.
			</p>

			<h2>The Multi-Environment Problem</h2>
			<p>
				Common issues when managing secrets across environments:
			</p>
			<ul>
				<li><strong>Accidental production access</strong>: Development code hitting production databases</li>
				<li><strong>Secret drift</strong>: Environments getting out of sync</li>
				<li><strong>Onboarding friction</strong>: New developers struggling to get the right credentials</li>
				<li><strong>Audit confusion</strong>: Not knowing which secrets are used where</li>
			</ul>

			<h2>Redshift Environment Model</h2>
			<p>
				In Redshift, secrets are organized as:
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
				Each environment is a separate namespace. The same secret name can have different values per environment.
			</p>

			<h2>Setting Up Environments</h2>
			<p>
				Create environments during project setup:
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
				Use the <code>-e</code> flag to target specific environments:
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
				Inject the right secrets by specifying the environment:
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
				Some secrets are the same everywhere (maybe a third-party API key with environment detection). You can:
			</p>
			<ol>
				<li><strong>Duplicate manually</strong>: Set the same value in each environment</li>
				<li><strong>Script it</strong>: Write a shell script that sets common secrets across environments</li>
				<li><strong>Use inheritance</strong>: Coming in a future Redshift release</li>
			</ol>

			<h2>Preventing Environment Mistakes</h2>

			<h3>Use Descriptive Values</h3>
			<p>
				Make it obvious which environment you're connected to:
			</p>
			<pre><code># Include environment in URLs where possible
DATABASE_URL=postgres://localhost:5432/myapp_development
DATABASE_URL=postgres://staging.internal:5432/myapp_staging</code></pre>

			<h3>Color-Code Your Terminals</h3>
			<p>
				Many developers set terminal background colors per environment—red for production, green for development. This visual cue prevents accidents.
			</p>

			<h3>Require Explicit Environment</h3>
			<p>
				Don't default to production. Make users explicitly specify <code>-e production</code>:
			</p>
			<pre><code># In package.json scripts
"start:prod": "redshift run -e production -- node server.js"</code></pre>

			<h2>Auditing Environment Access</h2>
			<p>
				Redshift Cloud (coming soon) includes audit logs showing:
			</p>
			<ul>
				<li>Who accessed which environment</li>
				<li>When secrets were read or modified</li>
				<li>What changes were made</li>
			</ul>
			<p>
				For now, use separate Nostr identities per environment tier for coarse access control.
			</p>

			<h2>Migration from .env Files</h2>
			<p>
				If you're currently using <code>.env</code> files per environment:
			</p>
			<pre><code># Import each environment
$ redshift secrets import .env.development -e development
$ redshift secrets import .env.staging -e staging
$ redshift secrets import .env.production -e production

# Then delete the .env files (they contain plaintext secrets!)
$ rm .env.*</code></pre>
			<p>
				Your secrets are now encrypted and accessible from anywhere, not just machines with the right dotfiles.
			</p>

			<h2>Next Steps</h2>
			<p>
				Ready to organize your secrets by environment? <a href="/docs/quickstart">Follow the quickstart</a> or <a href="/admin">create a project</a> to get started.
			</p>
		`,
	},
	{
		slug: 'redshift-vs-hashicorp-vault',
		title: 'Redshift vs HashiCorp Vault: When to Choose Each',
		description:
			'Vault is the industry standard for enterprise secrets. Redshift takes a different approach. Here is an honest comparison.',
		date: '2024-10-20',
		author: 'Redshift Team',
		readingTime: '7 min read',
		tags: ['comparison', 'vault', 'enterprise'],
		content: `
			<p class="lead">
				HashiCorp Vault is the dominant player in enterprise secret management. Redshift is a newcomer with a radically different architecture. This isn't a "Redshift is better" piece—it's an honest comparison to help you choose the right tool.
			</p>

			<h2>Architecture Differences</h2>

			<h3>Vault: Centralized Server</h3>
			<p>
				Vault runs as a server (or cluster) that clients connect to. Secrets are stored in a backend (Consul, PostgreSQL, etc.) and encrypted at rest. Access is controlled through policies and authentication methods.
			</p>
			<ul>
				<li><strong>Server required</strong>: You must run and maintain Vault infrastructure</li>
				<li><strong>Network dependency</strong>: Clients need connectivity to the Vault server</li>
				<li><strong>Centralized trust</strong>: Vault operators can access all secrets</li>
			</ul>

			<h3>Redshift: Decentralized Protocol</h3>
			<p>
				Redshift stores encrypted secrets on Nostr relays. There's no Redshift server—just a CLI and web interface that communicate with public relays.
			</p>
			<ul>
				<li><strong>No server to run</strong>: Use public relays or run your own</li>
				<li><strong>Relay redundancy</strong>: Secrets replicate across multiple independent relays</li>
				<li><strong>Zero-knowledge</strong>: Relay operators can't decrypt your secrets</li>
			</ul>

			<h2>When to Choose Vault</h2>

			<h3>Enterprise Compliance Requirements</h3>
			<p>
				Vault has years of enterprise deployments, SOC 2 certifications, and compliance documentation. If your auditors require specific certifications, Vault is the safer choice today.
			</p>

			<h3>Dynamic Secrets</h3>
			<p>
				Vault can generate short-lived credentials on demand—database users, AWS IAM credentials, PKI certificates. These are created when needed and automatically revoked. Redshift doesn't do this.
			</p>

			<h3>Complex Access Policies</h3>
			<p>
				Vault's policy language is powerful. You can define fine-grained access rules based on paths, metadata, time windows, and more. Redshift's access control is simpler: you either have the decryption key or you don't.
			</p>

			<h3>Existing HashiCorp Stack</h3>
			<p>
				If you're already using Consul, Nomad, or Terraform Enterprise, Vault integrates seamlessly. The ecosystem benefits are significant.
			</p>

			<h2>When to Choose Redshift</h2>

			<h3>No Infrastructure to Manage</h3>
			<p>
				Vault requires running servers, managing storage backends, handling upgrades, and ensuring high availability. Redshift requires nothing—secrets are stored on existing Nostr infrastructure.
			</p>
			<p>
				For small teams, solo developers, or anyone who doesn't want to run Vault, Redshift removes the operational burden entirely.
			</p>

			<h3>True Secret Sovereignty</h3>
			<p>
				With Vault, operators can access secrets. With Redshift, no one can—not us, not relay operators, not anyone without your private key. If you need secrets that are truly beyond reach of any third party, Redshift's architecture guarantees it.
			</p>

			<h3>Censorship Resistance</h3>
			<p>
				Vault servers can be shut down, blocked, or seized. Redshift secrets are distributed across global Nostr relays. There's no single point of control to target.
			</p>

			<h3>Zero Cost for Individuals</h3>
			<p>
				Vault Enterprise is expensive. Even Vault OSS requires infrastructure investment. Redshift is free for individuals—unlimited projects, unlimited secrets.
			</p>

			<h3>Doppler-Compatible CLI</h3>
			<p>
				If you're migrating from Doppler or want a simple CLI experience, Redshift's <code>run</code> command is a drop-in replacement. Vault's CLI is more complex.
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
						<td>Redshift Cloud (coming)</td>
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
						<td>Coming soon</td>
					</tr>
					<tr>
						<td>SSO/SAML</td>
						<td>Enterprise</td>
						<td>Coming soon</td>
					</tr>
				</tbody>
			</table>

			<h2>Can They Coexist?</h2>
			<p>
				Yes. You might use Vault for dynamic database credentials and PKI while using Redshift for static secrets that need to be truly sovereign. They solve different problems.
			</p>

			<h2>Our Honest Take</h2>
			<p>
				If you're a large enterprise with compliance requirements, dedicated DevOps staff, and budget for infrastructure—use Vault. It's battle-tested and feature-rich.
			</p>
			<p>
				If you're an individual developer, small team, open-source project, or anyone who values sovereignty over enterprise features—Redshift is built for you.
			</p>
			<p>
				The secret management space is big enough for both approaches. <a href="/admin">Try Redshift</a> and see if it fits your needs.
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
				Every developer identity you use—GitHub, npm, Docker Hub, your work email—is controlled by someone else. They can suspend it, delete it, or lock you out. Self-sovereign identity flips this: you control your identity, and platforms simply verify it.
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
				Nostr provides a practical implementation of self-sovereign identity:
			</p>
			<ul>
				<li><strong>npub</strong>: Your public identifier, derived from your public key</li>
				<li><strong>nsec</strong>: Your private key, stored securely on your devices</li>
				<li><strong>Signatures</strong>: Prove you authored any Nostr event</li>
			</ul>
			<p>
				This same identity works for social media, messaging, payments, and—with Redshift—secret management. One identity, many applications, no central authority.
			</p>

			<h2>Practical Benefits for Developers</h2>

			<h3>Portable Reputation</h3>
			<p>
				Contributions signed with your Nostr key are attributable to you forever. If a platform shuts down, your signed commits still prove you authored them.
			</p>

			<h3>Cross-Platform Authentication</h3>
			<p>
				Use the same identity to authenticate with multiple services. No more username/password per platform, no more OAuth dance.
			</p>

			<h3>True Account Recovery</h3>
			<p>
				Forget password reset emails. Your private key <em>is</em> your account. Back it up securely and you can never be locked out.
			</p>

			<h3>Censorship Resistance</h3>
			<p>
				No one can deplatform your identity. They can refuse to host your content, but they can't take away who you are.
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

			<h2>The Future</h2>
			<p>
				Self-sovereign identity is still early. But the trend is clear: developers are recognizing that platform dependency is a risk. The tools are maturing. The ecosystem is growing.
			</p>
			<p>
				Redshift is built on this foundation. Your secrets are tied to your cryptographic identity, not to our platform. If we disappear tomorrow, your identity and your encrypted data remain.
			</p>
			<p>
				That's what sovereignty means. <a href="/admin">Experience it yourself</a>.
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
				Serverless functions run in ephemeral environments you don't control. Getting secrets into them securely—without hardcoding or exposing them in logs—requires careful design.
			</p>

			<h2>The Serverless Secret Challenge</h2>
			<p>
				Serverless environments have unique constraints:
			</p>
			<ul>
				<li><strong>No persistent filesystem</strong>: You can't store <code>.env</code> files</li>
				<li><strong>Cold starts</strong>: Functions spin up fresh, so initialization matters</li>
				<li><strong>Limited environment</strong>: You can't install arbitrary software</li>
				<li><strong>Platform lock-in</strong>: Each provider has its own secret storage</li>
			</ul>

			<h2>Pattern 1: Build-Time Injection</h2>
			<p>
				Fetch secrets during build and inject them as environment variables:
			</p>
			<pre><code># In your build script or CI
$ redshift run -e production -- npm run build

# Or export and pass to your bundler
$ export $(redshift secrets export -e production)
$ npm run build</code></pre>
			<p>
				<strong>Pros</strong>: Simple, works everywhere, no runtime dependency<br />
				<strong>Cons</strong>: Secrets are baked into the deployment artifact
			</p>

			<h2>Pattern 2: Platform Secret Storage</h2>
			<p>
				Store secrets in your serverless platform's native storage, synced from Redshift:
			</p>

			<h3>Vercel</h3>
			<pre><code># Sync Redshift secrets to Vercel
$ redshift secrets export -e production | while IFS='=' read -r key value; do
    vercel env add "$key" production <<< "$value"
done</code></pre>

			<h3>AWS Lambda</h3>
			<pre><code># Sync to AWS Secrets Manager
$ redshift secrets export -e production --format json | \\
    aws secretsmanager put-secret-value \\
    --secret-id my-app/production \\
    --secret-string file:///dev/stdin</code></pre>

			<h3>Cloudflare Workers</h3>
			<pre><code># Sync to Cloudflare secrets
$ redshift secrets export -e production | while IFS='=' read -r key value; do
    echo "$value" | wrangler secret put "$key"
done</code></pre>
			<p>
				<strong>Pros</strong>: Uses platform-native features, no runtime calls<br />
				<strong>Cons</strong>: Requires sync step, secrets live in two places
			</p>

			<h2>Pattern 3: Runtime Fetching</h2>
			<p>
				Fetch secrets at function startup. This requires network access and adds latency but ensures secrets are always fresh:
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
				<strong>Pros</strong>: Secrets always current, single source of truth<br />
				<strong>Cons</strong>: Adds cold start latency, requires network access
			</p>

			<h2>Security Best Practices</h2>

			<h3>Never Log Secrets</h3>
			<p>
				Serverless logs are often centralized and persistent. Never log environment variables or API responses that might contain secrets:
			</p>
			<pre><code>// Bad - secrets might appear in logs
console.log('Config:', process.env);

// Good - log only what you need
console.log('Function initialized');</code></pre>

			<h3>Use Least Privilege</h3>
			<p>
				Create separate secret sets for each function. A function that only reads from an API shouldn't have database write credentials.
			</p>

			<h3>Rotate Regularly</h3>
			<p>
				Serverless functions often run for months without redeployment. Establish a rotation schedule and redeploy when secrets change.
			</p>

			<h3>Encrypt in Transit</h3>
			<p>
				If fetching secrets at runtime, ensure you're using HTTPS and validating certificates. Nostr relay connections are websocket-based and should use WSS.
			</p>

			<h2>Platform-Specific Considerations</h2>

			<h3>AWS Lambda</h3>
			<ul>
				<li>Use Secrets Manager or Parameter Store for native integration</li>
				<li>Lambda extensions can fetch secrets before your code runs</li>
				<li>IAM roles control access to secret storage</li>
			</ul>

			<h3>Vercel</h3>
			<ul>
				<li>Environment variables are encrypted at rest</li>
				<li>Different values per environment (preview, production)</li>
				<li>Edge functions have more limited access than serverless functions</li>
			</ul>

			<h3>Cloudflare Workers</h3>
			<ul>
				<li>Use Workers Secrets for sensitive values</li>
				<li>KV storage is not suitable for secrets (readable via API)</li>
				<li>Workers run in isolates, reducing cross-request leakage risk</li>
			</ul>

			<h2>The Hybrid Approach</h2>
			<p>
				For most teams, we recommend a hybrid:
			</p>
			<ol>
				<li><strong>Store secrets in Redshift</strong> as your source of truth</li>
				<li><strong>Sync to platform storage</strong> during CI/CD</li>
				<li><strong>Access via platform APIs</strong> at runtime</li>
			</ol>
			<p>
				This gives you Redshift's sovereignty and portability while using each platform's optimized secret delivery.
			</p>

			<h2>Get Started</h2>
			<p>
				Ready to secure your serverless secrets? <a href="/docs/quickstart">Follow our quickstart</a> or check out the <a href="/docs/cli">CLI documentation</a> for export and sync commands.
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
