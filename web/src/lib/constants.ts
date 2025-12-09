/**
 * Redshift Nostr event kind (NIP-78 application-specific data)
 */
export const REDSHIFT_KIND = 30078;

/**
 * Generate the d-tag for a secrets event
 * Format: <project_id>|<environment_slug>
 */
export function getSecretsDTag(projectId: string, environmentSlug: string): string {
	return `${projectId}|${environmentSlug}`;
}

/**
 * Generate the d-tag for a project event
 * Format: <project_id>
 */
export function getProjectDTag(projectId: string): string {
	return projectId;
}

/**
 * Parse a d-tag to extract project and environment info
 */
export function parseDTag(dTag: string): { projectId: string; environmentSlug?: string } {
	const parts = dTag.split('|');
	return {
		projectId: parts[0],
		environmentSlug: parts[1],
	};
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
			'Unlimited projects',
			'Unlimited secrets',
			'Unlimited environments',
			'CLI access',
			'Web admin dashboard',
			'Client-side encryption',
			'Use any Nostr relay',
		],
		cta: 'Get Started',
		ctaLink: '/admin',
		highlight: false,
	},
	cloud: {
		name: 'Cloud',
		price: 5,
		priceLabel: '$5/month',
		description: 'Managed relays & backup',
		available: false,
		features: [
			'Everything in Free',
			'Managed Nostr relays',
			'Automatic backups',
			'99.9% uptime SLA',
			'Priority support',
		],
		cta: 'Coming Soon',
		ctaLink: null,
		highlight: false,
	},
	teams: {
		name: 'Teams',
		price: 20,
		priceLabel: '$20/user/month',
		description: 'For startups & small teams',
		available: false,
		features: [
			'Everything in Cloud',
			'Team secret sharing (NIP-EE)',
			'Role-based access control',
			'Audit logs',
			'Up to 50 team members',
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
			'Everything in Teams',
			'SSO/OIDC integration',
			'Self-hosted Bunker Orchestrator',
			'SOC2 Type II compliance',
			'Dedicated support',
			'Custom SLA',
		],
		cta: 'Contact Us',
		ctaLink: 'mailto:enterprise@redshiftapp.com',
		highlight: false,
	},
} as const;

export type PricingTierKey = keyof typeof PRICING_TIERS;
