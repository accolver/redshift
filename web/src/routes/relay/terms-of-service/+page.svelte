<script lang="ts">
import Navbar from '$lib/components/Navbar.svelte';
import { FileText, Shield, CreditCard, AlertTriangle, Scale } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Terms of Service - Redshift Relay</title>
	<meta name="description" content="Terms of Service for the Redshift managed relay service." />
</svelte:head>

<Navbar />

<div class="mx-auto max-w-4xl px-4 pt-24 pb-16">
	<!-- Header -->
	<header class="mb-12">
		<div class="mb-4 flex items-center gap-3">
			<div class="rounded-lg bg-tokyo-blue/10 p-2">
				<FileText class="size-6 text-tokyo-blue" />
			</div>
			<span class="text-sm font-medium text-tokyo-blue">Legal</span>
		</div>
		<h1 class="mb-4 text-4xl font-bold">Terms of Service</h1>
		<p class="text-lg text-muted-foreground">
			Redshift Managed Relay Service
		</p>
		<div class="mt-4 flex gap-4 text-sm text-muted-foreground">
			<span><strong>Effective:</strong> January 2025</span>
			<span><strong>Last Updated:</strong> January 2025</span>
		</div>
	</header>

	<!-- Content -->
	<article class="prose prose-invert max-w-none">
		<section>
			<h2 id="introduction">1. Introduction</h2>
			<p>
				These Terms of Service ("Terms") govern your use of the Redshift managed relay
				service ("Service") operated at <code>wss://relay.redshiftapp.com</code>. By connecting to
				or using this relay, you agree to be bound by these Terms.
			</p>
			<p>
				The Redshift relay is a <strong>specialized Nostr relay</strong> designed exclusively for
				storing encrypted application data (NIP-59 Gift Wrapped <a href="https://github.com/nostr-protocol/nips/blob/master/78.md" target="_blank" rel="noopener">NIP-78</a> Kind 30078 events) for Redshift
				Cloud subscribers. This is not a general-purpose social relay.
			</p>
		</section>

		<section>
			<h2 id="service-description">2. Service Description</h2>
			<p>The Redshift relay provides:</p>

			<div class="not-prose my-6 grid gap-4 sm:grid-cols-2">
				<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
					<Shield class="size-5 shrink-0 text-tokyo-blue" />
					<div>
						<p class="font-medium leading-5">Managed Infrastructure</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Encrypted secrets and application data storage
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
					<Shield class="size-5 shrink-0 text-tokyo-purple" />
					<div>
						<p class="font-medium leading-5">NIP-42 Authentication</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Valid subscription tokens required
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
					<Shield class="size-5 shrink-0 text-tokyo-green" />
					<div>
						<p class="font-medium leading-5">High Availability</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Reliable infrastructure with monitoring
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
					<Shield class="size-5 shrink-0 text-tokyo-cyan" />
					<div>
						<p class="font-medium leading-5">Automatic Backups</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Encrypted backups to Cloudflare R2
						</p>
					</div>
				</div>
			</div>

			<h3 id="what-we-store">What We Store</h3>
			<p>
				We only store NIP-59 Gift Wrapped events containing NIP-78 Kind 30078 inner events
				(encrypted blobs) with the <code>["t", "redshift-secrets"]</code> tag. The encryption
				uses NIP-44 (XChaCha20-Poly1305). <strong>We cannot access your secret names, values,
				or metadata.</strong> All encryption and decryption happens client-side.
			</p>
		</section>

		<section>
			<h2 id="eligibility">3. Eligibility</h2>
			<p>To use this Service, you must:</p>
			<ul>
				<li>Be of legal age in your jurisdiction (typically 18 years or older)</li>
				<li>Have a valid Redshift Cloud subscription ($5/month)</li>
				<li>Possess a valid Nostr keypair for NIP-42 authentication</li>
				<li>Agree to these Terms and our <a href="/relay/privacy-policy">Privacy Policy</a></li>
			</ul>
		</section>

		<section>
			<h2 id="subscription-payment">4. Subscription and Payment</h2>

			<h3 id="pricing">4.1 Pricing</h3>
			<p>
				Access to the Redshift relay requires an active Cloud subscription at $5 USD per
				month, payable in Bitcoin (Lightning Network or on-chain).
			</p>

			<h3 id="payment-processing">4.2 Payment Processing</h3>
			<p>
				Payments are processed through BTCPay Server. We do not store payment card
				information. All transactions are Bitcoin-native.
			</p>

			<h3 id="refund-policy">4.3 Refund Policy</h3>
			<div class="not-prose my-6">
				<div class="flex items-start gap-3 rounded-lg border border-tokyo-orange/30 bg-tokyo-orange/5 p-4">
					<CreditCard class="size-5 shrink-0 text-tokyo-orange" />
					<div>
						<p class="font-medium leading-5 text-tokyo-orange">All Sales Final</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Due to the nature of cryptocurrency payments and instant service activation,
							we do not offer refunds, returns, or cancellations.
						</p>
					</div>
				</div>
			</div>

			<h3 id="subscription-renewal">4.4 Subscription Renewal</h3>
			<p>
				Subscriptions are valid for 30 days from payment. You will receive notification
				before expiration. Failure to renew will result in loss of relay access, though
				your encrypted data will be retained for 30 days to allow renewal.
			</p>
		</section>

		<section>
			<h2 id="acceptable-use">5. Acceptable Use</h2>
			<p>By using this Service, you agree to:</p>
			<ul>
				<li>Use the relay only for its intended purpose (Redshift secret storage)</li>
				<li>Not attempt to bypass authentication or access controls</li>
				<li>Not flood, spam, or otherwise abuse the relay infrastructure</li>
				<li>Comply with all applicable laws in your jurisdiction</li>
				<li>Act in good faith and not seek to harm the relay operators</li>
				<li>Not attempt to reverse engineer or attack the relay software</li>
			</ul>

			<h3 id="prohibited-activities">5.1 Prohibited Activities</h3>
			<p>You may not use this Service to:</p>
			<ul>
				<li>Store or transmit illegal content</li>
				<li>Circumvent the subscription or payment system</li>
				<li>Interfere with other users' access to the Service</li>
				<li>Attempt to access other users' encrypted data</li>
				<li>Resell or redistribute relay access</li>
				<li>Use automated systems to abuse rate limits</li>
			</ul>
		</section>

		<section>
			<h2 id="content-encryption">6. Content and Encryption</h2>

			<h3 id="your-content">6.1 Your Content</h3>
			<p>
				You retain ownership of all content you publish to the relay. By using the
				Service, you grant us the limited right to store, transmit, and replicate your
				encrypted events as necessary to provide the Service.
			</p>

			<h3 id="encryption-guarantee">6.2 Encryption Guarantee</h3>
			<div class="not-prose my-6">
				<div class="flex items-start gap-3 rounded-lg border border-tokyo-green/30 bg-tokyo-green/5 p-4">
					<Shield class="size-5 shrink-0 text-tokyo-green" />
					<div>
						<p class="font-medium leading-5 text-tokyo-green">Cryptographic Privacy</p>
						<p class="mt-1 text-sm text-muted-foreground">
							All Redshift secrets are encrypted client-side using NIP-59 Gift Wrap with
							NIP-44 encryption (XChaCha20-Poly1305) before transmission. We have no ability
							to decrypt or access your plaintext data. This is by design and fundamental
							to our security model.
						</p>
					</div>
				</div>
			</div>

			<h3 id="content-removal">6.3 Content Removal</h3>
			<p>
				Due to the encrypted nature of stored data, we cannot selectively remove
				specific secrets. If you need to delete content, use your Redshift client to
				publish deletion events (NIP-09).
			</p>
		</section>

		<section>
			<h2 id="service-availability">7. Service Availability</h2>

			<h3 id="uptime-target">7.1 Uptime Target</h3>
			<p>
				We strive to maintain high availability for the relay service. While we do not
				offer a formal SLA with the Cloud tier, we monitor uptime and work to resolve
				any issues promptly.
			</p>
			<div class="not-prose my-6">
				<div class="flex items-start gap-3 rounded-lg border border-tokyo-purple/30 bg-tokyo-purple/5 p-4">
					<Shield class="size-5 shrink-0 text-tokyo-purple" />
					<div>
						<p class="font-medium leading-5 text-tokyo-purple">Enterprise SLA</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Formal uptime SLAs with contractual guarantees and service credits will be
							available with the Enterprise tier. Details will be published when Enterprise
							launches.
						</p>
					</div>
				</div>
			</div>

			<h3 id="maintenance">7.2 Maintenance</h3>
			<p>
				We may perform scheduled maintenance with advance notice when possible.
				Emergency maintenance may occur without notice to address security or stability
				issues.
			</p>

			<h3 id="service-modifications">7.3 Service Modifications</h3>
			<p>
				We reserve the right to modify, suspend, or discontinue the Service at any time.
				We will provide reasonable notice for significant changes when possible.
			</p>
		</section>

		<section>
			<h2 id="data-backups">8. Data and Backups</h2>

			<h3 id="automatic-backups">8.1 Automatic Backups</h3>
			<p>
				Encrypted event data is automatically backed up to Cloudflare R2 storage with
				geographic replication.
			</p>

			<h3 id="data-retention">8.2 Data Retention</h3>
			<div class="not-prose my-6 overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border">
							<th class="px-4 py-3 text-left font-medium">Status</th>
							<th class="px-4 py-3 text-left font-medium">Retention</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Active subscribers</td>
							<td class="px-4 py-3 text-muted-foreground">Indefinitely while subscription is active</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Lapsed subscriptions</td>
							<td class="px-4 py-3 text-muted-foreground">30 days after subscription expires</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Audit logs <span class="ml-1 rounded bg-tokyo-blue/10 px-1.5 py-0.5 text-xs text-tokyo-blue">Cloud only</span></td>
							<td class="px-4 py-3 text-muted-foreground">7 days rolling window</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3 id="data-portability">8.3 Data Portability</h3>
			<p>
				Your encrypted data uses standard Nostr event formats and can be exported to any
				compatible relay.
			</p>
		</section>

		<section>
			<h2 id="privacy">9. Privacy</h2>
			<p>
				Your use of this Service is also governed by our
				<a href="/relay/privacy-policy">Privacy Policy</a>. We collect minimal data necessary to
				operate the service and combat abuse.
			</p>
		</section>

		<section>
			<h2 id="disclaimers">10. Disclaimers</h2>

			<h3 id="as-is-service">10.1 "As Is" Service</h3>
			<div class="not-prose my-6">
				<div class="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
					<AlertTriangle class="size-5 shrink-0 text-tokyo-orange" />
					<div>
						<p class="text-sm text-muted-foreground">
							THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
							KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
							MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
						</p>
					</div>
				</div>
			</div>

			<h3 id="no-guarantee">10.2 No Guarantee</h3>
			<p>
				We do not guarantee that the Service will be uninterrupted, error-free, or free
				of harmful components. While we implement security measures, no system is
				completely secure.
			</p>
		</section>

		<section>
			<h2 id="limitation-liability">11. Limitation of Liability</h2>
			<p>
				TO THE MAXIMUM EXTENT PERMITTED BY LAW, REDSHIFT AND ITS OPERATORS SHALL NOT BE
				LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
				DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR
				INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
			</p>
			<p>
				Our total liability for any claims arising from or relating to these Terms or
				the Service shall not exceed the amount you paid for the Service in the 12
				months preceding the claim.
			</p>
		</section>

		<section>
			<h2 id="termination">12. Termination</h2>

			<h3 id="termination-by-you">12.1 By You</h3>
			<p>
				You may cancel your subscription at any time through the Redshift web interface.
				Your access will continue until the end of your current billing period.
			</p>

			<h3 id="termination-by-us">12.2 By Us</h3>
			<p>
				We reserve the right to suspend or terminate your access to the Service at any
				time, with or without cause, and with or without notice. Reasons for termination
				may include:
			</p>
			<ul>
				<li>Violation of these Terms</li>
				<li>Non-payment or payment fraud</li>
				<li>Abuse of the relay infrastructure</li>
				<li>Legal requirements</li>
			</ul>

			<h3 id="effect-of-termination">12.3 Effect of Termination</h3>
			<p>
				Upon termination, your right to access the Service ceases immediately. We may
				retain encrypted backup data for a reasonable period to allow for appeals or
				re-subscription.
			</p>
		</section>

		<section>
			<h2 id="changes-to-terms">13. Changes to Terms</h2>
			<p>
				We may update these Terms from time to time. We will notify active subscribers
				of material changes via the email or Nostr pubkey associated with their account.
				Continued use of the Service after changes constitutes acceptance of the new
				Terms.
			</p>
		</section>

		<section>
			<h2 id="governing-law">14. Governing Law</h2>
			<p>
				These Terms shall be governed by and construed in accordance with the laws of
				the jurisdiction in which the relay operator resides, without regard to
				conflicts of law principles.
			</p>
		</section>

		<section>
			<h2 id="dispute-resolution">15. Dispute Resolution</h2>
			<p>
				Any disputes arising from these Terms or the Service shall first be addressed
				through good-faith negotiation. If resolution cannot be reached, disputes may be
				submitted to binding arbitration in accordance with applicable arbitration
				rules.
			</p>
		</section>

		<section>
			<h2 id="severability">16. Severability</h2>
			<p>
				If any provision of these Terms is found to be unenforceable, the remaining
				provisions shall continue in full force and effect.
			</p>
		</section>

		<section>
			<h2 id="contact">17. Contact</h2>
			<p>For questions about these Terms, contact us at:</p>
			<ul>
				<li><strong>Email:</strong> support@redshiftapp.com</li>
				<li><strong>Website:</strong> <a href="https://redshiftapp.com">https://redshiftapp.com</a></li>
			</ul>
		</section>

		<div class="not-prose mt-12 rounded-lg border border-border bg-card/50 p-6">
			<div class="flex items-start gap-3">
				<Scale class="size-5 shrink-0 text-muted-foreground" />
				<p class="text-sm text-muted-foreground">
					By using the Redshift relay, you acknowledge that you have read, understood, and
					agree to be bound by these Terms of Service.
				</p>
			</div>
		</div>
	</article>
</div>
