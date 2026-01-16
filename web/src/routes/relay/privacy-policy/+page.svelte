<script lang="ts">
import Navbar from '$lib/components/Navbar.svelte';
import { Shield, Eye, EyeOff, Server, Lock, Globe, Mail } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Privacy Policy - Redshift Relay</title>
	<meta name="description" content="Privacy Policy for the Redshift managed relay service." />
</svelte:head>

<Navbar />

<div class="mx-auto max-w-4xl px-4 pt-24 pb-16">
	<!-- Header -->
	<header class="mb-12">
		<div class="mb-4 flex items-center gap-3">
			<div class="rounded-lg bg-tokyo-purple/10 p-2">
				<Shield class="size-6 text-tokyo-purple" />
			</div>
			<span class="text-sm font-medium text-tokyo-purple">Legal</span>
		</div>
		<h1 class="mb-4 text-4xl font-bold">Privacy Policy</h1>
		<p class="text-lg text-muted-foreground">
			Redshift Managed Relay Service
		</p>
		<div class="mt-4 flex gap-4 text-sm text-muted-foreground">
			<span><strong>Effective:</strong> January 2025</span>
			<span><strong>Last Updated:</strong> January 2025</span>
		</div>
	</header>

	<!-- Key Principle Banner -->
	<div class="mb-12 rounded-xl border border-tokyo-green/30 bg-tokyo-green/5 p-6">
		<div class="flex items-start gap-4">
			<Lock class="size-8 shrink-0 text-tokyo-green" />
			<div>
				<p class="font-semibold text-tokyo-green">Key Principle: We Cannot Access Your Secrets</p>
				<p class="mt-1 text-muted-foreground">
					All Redshift data is encrypted client-side using NIP-44 (XChaCha20-Poly1305) before it reaches our servers.
					We only store and transmit encrypted blobs. This is enforced cryptographically, not by policy.
				</p>
			</div>
		</div>
	</div>

	<!-- Content -->
	<article class="prose prose-invert max-w-none">
		<section>
			<h2 id="introduction">1. Introduction</h2>
			<p>
				This Privacy Policy describes how the Redshift relay service
				(<code>wss://relay.redshiftapp.com</code>) collects, uses, and protects your information.
				We are committed to user privacy and data sovereignty.
			</p>
		</section>

		<section>
			<h2 id="information-we-collect">2. Information We Collect</h2>

			<h3 id="information-we-can-see">2.1 Information We Can See</h3>
			<div class="not-prose my-6 overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border">
							<th class="px-4 py-3 text-left font-medium">Data Type</th>
							<th class="px-4 py-3 text-left font-medium">Purpose</th>
							<th class="px-4 py-3 text-left font-medium">Retention</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3 font-medium">IP Address</td>
							<td class="px-4 py-3 text-muted-foreground">Abuse prevention, security</td>
							<td class="px-4 py-3 text-muted-foreground">7 days (logs)</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3 font-medium">Nostr Public Key</td>
							<td class="px-4 py-3 text-muted-foreground">Authentication (NIP-42)</td>
							<td class="px-4 py-3 text-muted-foreground">Duration of subscription</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3 font-medium">Connection Metadata</td>
							<td class="px-4 py-3 text-muted-foreground">Rate limiting, debugging</td>
							<td class="px-4 py-3 text-muted-foreground">24 hours</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3 font-medium">Encrypted Events</td>
							<td class="px-4 py-3 text-muted-foreground">Service delivery</td>
							<td class="px-4 py-3 text-muted-foreground">Per retention policy</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3 font-medium">Event Timestamps</td>
							<td class="px-4 py-3 text-muted-foreground">Sync, ordering</td>
							<td class="px-4 py-3 text-muted-foreground">With events</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3 font-medium">Event Tags</td>
							<td class="px-4 py-3 text-muted-foreground">Filtering, routing</td>
							<td class="px-4 py-3 text-muted-foreground">With events</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3 id="information-we-cannot-see">2.2 Information We Cannot See</h3>
			<p>Due to <a href="https://github.com/nostr-protocol/nips/blob/master/59.md" target="_blank" rel="noopener">NIP-59</a> Gift Wrap encryption (using <a href="https://github.com/nostr-protocol/nips/blob/master/44.md" target="_blank" rel="noopener">NIP-44</a> XChaCha20-Poly1305), we <strong>cannot access</strong>:</p>

			<div class="not-prose my-6 grid gap-3 sm:grid-cols-2">
				<div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
					<EyeOff class="size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm">Secret names or identifiers</span>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
					<EyeOff class="size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm">Secret values or content</span>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
					<EyeOff class="size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm">Project names or structure</span>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
					<EyeOff class="size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm">Any plaintext metadata</span>
				</div>
				<div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
					<EyeOff class="size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm">Who you're sharing secrets with</span>
				</div>
			</div>

			<h3 id="payment-information">2.3 Payment Information</h3>
			<p>Bitcoin payments are processed through BTCPay Server. We record:</p>
			<ul>
				<li>BTCPay invoice ID (for subscription verification)</li>
				<li>Payment timestamp</li>
				<li>Subscription expiry date</li>
			</ul>
			<p>We do <strong>not</strong> store:</p>
			<ul>
				<li>Bitcoin addresses (beyond what's necessary for payment)</li>
				<li>Transaction details on our systems</li>
				<li>Any fiat payment information (we are Bitcoin-only)</li>
			</ul>
		</section>

		<section>
			<h2 id="how-we-use-information">3. How We Use Your Information</h2>
			<p>We use collected information solely to:</p>
			<ul>
				<li><strong>Provide the Service</strong> - Store and deliver your encrypted events</li>
				<li><strong>Authenticate</strong> - Verify your subscription status via NIP-42</li>
				<li><strong>Prevent Abuse</strong> - Rate limiting, spam prevention, security monitoring</li>
				<li><strong>Improve Service</strong> - Aggregate, anonymized metrics for capacity planning</li>
				<li><strong>Comply with Law</strong> - Respond to valid legal requests (see Section 6)</li>
			</ul>

			<div class="not-prose my-6">
				<div class="flex items-start gap-3 rounded-lg border border-tokyo-red/30 bg-tokyo-red/5 p-4">
					<Eye class="size-5 shrink-0 text-tokyo-red" />
					<div>
						<p class="font-medium leading-5 text-tokyo-red">We Do NOT</p>
						<ul class="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
							<li>Sell your data to third parties</li>
							<li>Use your data for advertising</li>
							<li>Profile your behavior for marketing</li>
							<li>Share data with affiliates for commercial purposes</li>
						</ul>
					</div>
				</div>
			</div>
		</section>

		<section>
			<h2 id="data-storage-security">4. Data Storage and Security</h2>

			<h3 id="infrastructure">4.1 Infrastructure</h3>
			<div class="not-prose my-6 grid gap-4 sm:grid-cols-3">
				<div class="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center">
					<Server class="size-6 text-tokyo-blue" />
					<span class="text-sm font-medium">Relay</span>
					<span class="text-xs text-muted-foreground">Cloudflare Workers</span>
				</div>
				<div class="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center">
					<Server class="size-6 text-tokyo-purple" />
					<span class="text-sm font-medium">Storage</span>
					<span class="text-xs text-muted-foreground">Cloudflare Durable Objects & R2</span>
				</div>
				<div class="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center">
					<Server class="size-6 text-tokyo-cyan" />
					<span class="text-sm font-medium">Backups</span>
					<span class="text-xs text-muted-foreground">Cloudflare R2 (geo-replicated)</span>
				</div>
			</div>

			<h3 id="security-measures">4.2 Security Measures</h3>
			<ul>
				<li>End-to-end encryption (NIP-59 Gift Wrap with NIP-44 XChaCha20-Poly1305)</li>
				<li>NIP-78 Kind 30078 events for application data storage</li>
				<li>NIP-42 authentication required for all operations</li>
				<li>Rate limiting to prevent abuse</li>
				<li>Automatic encrypted backups</li>
				<li>No plaintext secrets ever touch our servers</li>
			</ul>

			<h3 id="data-location">4.3 Data Location</h3>
			<p>
				Data may be processed and stored in multiple geographic regions through
				Cloudflare's global network. Primary regions include the United States and
				Europe.
			</p>
		</section>

		<section>
			<h2 id="data-retention">5. Data Retention</h2>
			<div class="not-prose my-6 overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border">
							<th class="px-4 py-3 text-left font-medium">Data Type</th>
							<th class="px-4 py-3 text-left font-medium">Active Subscriber</th>
							<th class="px-4 py-3 text-left font-medium">After Subscription Ends</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Encrypted events</td>
							<td class="px-4 py-3 text-muted-foreground">Indefinite</td>
							<td class="px-4 py-3 text-muted-foreground">30 days</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Audit logs <span class="ml-1 rounded bg-tokyo-blue/10 px-1.5 py-0.5 text-xs text-tokyo-blue">Cloud only</span></td>
							<td class="px-4 py-3 text-muted-foreground">7 days rolling</td>
							<td class="px-4 py-3 text-muted-foreground">Deleted immediately</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Access tokens</td>
							<td class="px-4 py-3 text-muted-foreground">30 days (refresh)</td>
							<td class="px-4 py-3 text-muted-foreground">Deleted on expiry</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Connection logs</td>
							<td class="px-4 py-3 text-muted-foreground">24 hours</td>
							<td class="px-4 py-3 text-muted-foreground">24 hours</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">IP address logs</td>
							<td class="px-4 py-3 text-muted-foreground">7 days</td>
							<td class="px-4 py-3 text-muted-foreground">7 days</td>
						</tr>
						<tr class="border-b border-border/50">
							<td class="px-4 py-3">Payment records</td>
							<td class="px-4 py-3 text-muted-foreground">2 years</td>
							<td class="px-4 py-3 text-muted-foreground">2 years (legal)</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section>
			<h2 id="data-sharing">6. Data Sharing</h2>
			<p>
				We do not sell, rent, or share your personal information with third parties
				except:
			</p>

			<h3 id="service-providers">6.1 Service Providers</h3>
			<p>We use the following service providers who may process data on our behalf:</p>
			<ul>
				<li><strong>Cloudflare</strong> - Infrastructure hosting (Workers, R2, Durable Objects)</li>
				<li><strong>BTCPay Server</strong> - Payment processing (self-hosted)</li>
				<li><strong>Voltage Cloud</strong> - Lightning payment infrastructure</li>
			</ul>
			<p>
				These providers are bound by their own privacy policies and data protection
				agreements.
			</p>

			<h3 id="legal-requirements">6.2 Legal Requirements</h3>
			<p>We may disclose information if required by law, court order, or government request. However:</p>
			<ul>
				<li>We will notify you unless legally prohibited</li>
				<li>We cannot provide plaintext secrets (we don't have them)</li>
				<li>We will challenge overbroad requests</li>
			</ul>
		</section>

		<section>
			<h2 id="your-rights">7. Your Rights</h2>

			<h3 id="access-portability">7.1 Access and Portability</h3>
			<p>You can:</p>
			<ul>
				<li>Export all your encrypted events using any Nostr client</li>
				<li>Request a copy of metadata we hold about your account</li>
				<li>View your subscription status and history</li>
			</ul>

			<h3 id="deletion">7.2 Deletion</h3>
			<p>You can:</p>
			<ul>
				<li>Delete specific events using NIP-09 deletion events</li>
				<li>Request account deletion (removes metadata, tokens)</li>
				<li>Note: Encrypted backups may persist per retention schedule</li>
			</ul>

			<h3 id="correction">7.3 Correction</h3>
			<p>Contact us to correct any inaccurate account metadata.</p>

			<h3 id="gdpr">7.4 For EU/EEA Residents (GDPR)</h3>
			<p>
				If you are in the European Union or European Economic Area, you have additional
				rights including:
			</p>
			<ul>
				<li>Right to access your personal data</li>
				<li>Right to rectification of inaccurate data</li>
				<li>Right to erasure ("right to be forgotten")</li>
				<li>Right to restrict processing</li>
				<li>Right to data portability</li>
				<li>Right to object to processing</li>
				<li>Right to withdraw consent</li>
			</ul>
			<p>To exercise these rights, contact us at the address below.</p>

			<h3 id="ccpa">7.5 For California Residents (CCPA)</h3>
			<p>California residents have the right to:</p>
			<ul>
				<li>Know what personal information is collected</li>
				<li>Know whether personal information is sold or disclosed</li>
				<li>Say no to the sale of personal information</li>
				<li>Access their personal information</li>
				<li>Request deletion of personal information</li>
				<li>Not be discriminated against for exercising these rights</li>
			</ul>
			<p><strong>We do not sell personal information.</strong></p>
		</section>

		<section>
			<h2 id="cookies-tracking">8. Cookies and Tracking</h2>
			<p>
				The relay service itself does not use cookies or tracking technologies. The
				relay operates over WebSocket protocol and uses NIP-42 for authentication.
			</p>
			<p>
				Our marketing website (redshiftapp.com) may use minimal analytics. See that
				site's privacy policy for details.
			</p>
		</section>

		<section>
			<h2 id="childrens-privacy">9. Children's Privacy</h2>
			<p>
				This Service is not intended for users under 18 years of age. We do not
				knowingly collect information from children. If we learn we have collected
				information from a child, we will delete it.
			</p>
		</section>

		<section>
			<h2 id="international-transfers">10. International Data Transfers</h2>
			<p>
				Your data may be transferred to and processed in countries other than your own.
				We use Cloudflare's global network, which has data processing agreements and
				standard contractual clauses for international transfers.
			</p>
		</section>

		<section>
			<h2 id="changes">11. Changes to This Policy</h2>
			<p>
				We may update this Privacy Policy from time to time. We will notify active
				subscribers of material changes. The "Last Updated" date at the top indicates
				when the policy was last revised.
			</p>
		</section>

		<section>
			<h2 id="contact">12. Contact Us</h2>
			<p>For privacy-related questions or to exercise your rights:</p>
			<ul>
				<li><strong>Email:</strong> privacy@redshiftapp.com</li>
				<li><strong>Website:</strong> <a href="https://redshiftapp.com">https://redshiftapp.com</a></li>
			</ul>
			<p>For urgent privacy concerns, please include "PRIVACY" in your subject line.</p>
		</section>

		<!-- Summary Box -->
		<div class="not-prose mt-12 rounded-xl border border-tokyo-green/30 bg-tokyo-green/5 p-6">
			<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-tokyo-green">
				<Shield class="size-5" />
				Our Privacy Commitment
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="flex items-start gap-2">
					<Lock class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm text-muted-foreground">
						<strong class="text-foreground">We can't read your secrets</strong> - All data is encrypted client-side
					</span>
				</div>
				<div class="flex items-start gap-2">
					<EyeOff class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm text-muted-foreground">
						<strong class="text-foreground">We don't track you</strong> - No cookies, no behavioral profiling
					</span>
				</div>
				<div class="flex items-start gap-2">
					<Shield class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm text-muted-foreground">
						<strong class="text-foreground">We don't sell data</strong> - Your information is not for sale
					</span>
				</div>
				<div class="flex items-start gap-2">
					<Server class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm text-muted-foreground">
						<strong class="text-foreground">We minimize collection</strong> - Only what's necessary to operate
					</span>
				</div>
				<div class="flex items-start gap-2">
					<Globe class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm text-muted-foreground">
						<strong class="text-foreground">You control your data</strong> - Export, delete, or leave anytime
					</span>
				</div>
				<div class="flex items-start gap-2">
					<Mail class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
					<span class="text-sm text-muted-foreground">
						<strong class="text-foreground">We're transparent</strong> - This policy tells you exactly what we do
					</span>
				</div>
			</div>
			<p class="mt-4 text-sm text-muted-foreground">
				Your sovereignty over your own data is not just our policy - it's cryptographically enforced.
			</p>
		</div>
	</article>
</div>
