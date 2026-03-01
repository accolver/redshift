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
		price: 12121,
		priceLabel: '12,121 sats',
		description: 'Managed relay access',
		available: true,
		features: [
			'Everything in Free',
			'Managed Nostr relay',
			'Automatic backups',
			'7-day audit logs',
			'99.5% uptime SLA',
			'One-time payment',
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
