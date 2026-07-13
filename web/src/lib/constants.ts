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
		price: null,
		priceLabel: 'Not launched',
		description: 'Deferred managed-relay hypothesis',
		available: false,
		features: [
			'No subscription or paid offer is available',
			'$5/month is an unapproved planning hypothesis',
			'Managed operations require external evidence',
			'No backup, retention, or uptime SLA is offered',
		],
		cta: 'Proposed',
		ctaLink: null,
		highlight: false,
	},
	teams: {
		name: 'Teams',
		price: null,
		priceLabel: 'Not launched',
		description: 'Deferred collaboration research',
		available: false,
		features: [
			'Future collaboration research',
			'Custody and revocation design pending',
			'Role and invitation model pending',
			'No availability date',
		],
		cta: 'Not launched',
		ctaLink: null,
		highlight: true,
	},
	enterprise: {
		name: 'Enterprise',
		price: null,
		priceLabel: 'Not launched',
		description: 'Deferred enterprise research',
		available: false,
		features: [
			'Future enterprise research',
			'Identity bridge design pending',
			'Compliance scope not yet defined',
			'No availability date',
		],
		cta: 'Not launched',
		ctaLink: null,
		highlight: false,
	},
} as const;

export type PricingTierKey = keyof typeof PRICING_TIERS;
