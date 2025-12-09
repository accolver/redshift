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
			'Unlimited projects & secrets',
			'Doppler-compatible CLI',
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
		price: 5,
		priceLabel: '$5/month',
		description: 'Managed relays & backup',
		available: false,
		features: [
			'Everything in Free',
			'Managed Nostr relays',
			'Automatic backups',
			'7-day audit logs',
			'99.5% uptime SLA',
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
			'Team secret sharing (MLS encryption)',
			'Bunker Orchestrator for key custody',
			'Role-based access control',
			'90-day audit logs',
			'SAML SSO (Okta, Azure, Google)',
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
			'SSO Bridge (OIDC → Nostr)',
			'SCIM user provisioning',
			'Unlimited audit logs',
			'On-premise deployment',
			'SOC2 Type II compliance',
			'99.95% SLA & dedicated support',
		],
		cta: 'Contact Us',
		ctaLink: 'mailto:enterprise@redshiftapp.com',
		highlight: false,
	},
} as const;

export type PricingTierKey = keyof typeof PRICING_TIERS;
