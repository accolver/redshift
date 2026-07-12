/**
 * Redshift Nostr event kind (NIP-78 application-specific data)
 */
export const REDSHIFT_KIND = 30078;

/**
 * Generate the d-tag for a project event
 * Format: <project_id>
 */
export function getProjectDTag(projectId: string): string {
	return projectId;
}

/**
 * Pricing tiers for Redshift
 */
export const PRICING_TIERS = {
	free: {
		name: 'Free',
		price: 0,
		priceLabel: 'Free forever',
		description: 'For individual developers',
		available: true,
		features: [
			'Unlimited projects & secrets',
			'Doppler-inspired CLI',
			'Web admin dashboard',
			'Client-side encryption (NIP-59)',
			'Use any Nostr relay',
			'No account required',
		],
		cta: 'Get Started',
		ctaLink: '/admin',
		highlight: false,
	},
	cloud: {
		name: 'Cloud',
		price: 12121,
		priceLabel: '12,121 sats',
		description: 'Managed relay access',
		available: true,
		features: [
			'Everything in Free',
			'Managed Nostr relay',
			'NIP-42 authenticated access',
			'Recipient-scoped encrypted storage',
			'One-time payment',
			'No backup or uptime SLA yet',
		],
		cta: 'Get Access',
		ctaLink: 'https://relay.redshiftapp.com',
		highlight: false,
	},
	teams: {
		name: 'Teams',
		price: 20,
		priceLabel: '$20/user/month',
		description: 'For startups & small teams',
		available: false,
		features: [
			'Future collaboration research',
			'Custody and revocation design pending',
			'Role and invitation model pending',
			'No availability date',
		],
		cta: 'Coming Soon',
		ctaLink: null,
		highlight: true,
	},
	enterprise: {
		name: 'Enterprise',
		price: null,
		priceLabel: 'Custom',
		description: 'For large organizations',
		available: false,
		features: [
			'Future enterprise research',
			'Identity bridge design pending',
			'Compliance scope not yet defined',
			'No availability date',
		],
		cta: 'Contact Us',
		ctaLink: 'mailto:enterprise@redshiftapp.com',
		highlight: false,
	},
} as const;

export type PricingTierKey = keyof typeof PRICING_TIERS;
