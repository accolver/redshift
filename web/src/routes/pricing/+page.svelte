<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
import { Badge } from '$lib/components/ui/badge';
import Navbar from '$lib/components/Navbar.svelte';
import { PRICING_TIERS } from '$lib/constants';
import { Check, Github, Heart } from '@lucide/svelte';

const tiers = Object.values(PRICING_TIERS);

// Only show "Most Popular" highlight if the tier is available
function shouldHighlight(tier: typeof tiers[number]) {
	return tier.highlight && tier.available;
}
</script>

<svelte:head>
	<title>Pricing - Redshift</title>
	<meta name="description" content="Redshift pricing plans. Free and open source for individuals, with paid tiers coming soon for teams and enterprises." />
</svelte:head>

<Navbar />

<div class="mx-auto max-w-6xl px-4 pt-24 pb-16">
	<!-- Header -->
	<div class="mb-16 text-center">
		<Badge variant="outline" class="mb-4 border-tokyo-green/50 text-tokyo-green">
			<Heart class="mr-1 size-3" />
			Free & Open Source
		</Badge>
		<h1 class="mb-4 text-4xl font-bold sm:text-5xl">
			Simple, <span class="gradient-text">transparent</span> pricing
		</h1>
		<p class="mx-auto max-w-2xl text-lg text-muted-foreground">
			Redshift is free and open source for individual developers. 
			Paid tiers for teams and enterprises are coming soon.
		</p>
	</div>

	<!-- Open Source Banner -->
	<div class="mb-12 rounded-xl border border-tokyo-purple/30 bg-tokyo-purple/5 p-6 text-center">
		<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
			<Github class="size-8 text-tokyo-purple" />
			<div class="text-left">
				<p class="font-semibold">100% Open Source</p>
				<p class="text-sm text-muted-foreground">
					Redshift is MIT licensed. Self-host it, fork it, or contribute to it.
				</p>
			</div>
			<Button 
				variant="outline" 
				href="https://github.com/accolver/redshift" 
				target="_blank"
				class="border-tokyo-purple/50 transition-colors hover:bg-tokyo-purple/10"
			>
				View on GitHub
			</Button>
		</div>
	</div>

	<!-- Pricing Cards -->
	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each tiers as tier}
			<Card 
				class="relative flex flex-col {shouldHighlight(tier) ? 'border-tokyo-blue ring-2 ring-tokyo-blue/20' : 'border-border/50'}"
			>
				{#if shouldHighlight(tier)}
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<Badge class="bg-tokyo-blue text-white">Most Popular</Badge>
					</div>
				{/if}
				
				{#if !tier.available}
					<div class="absolute right-4 top-4">
						<Badge variant="secondary" class="bg-tokyo-orange/10 text-tokyo-orange">
							Coming Soon
						</Badge>
					</div>
				{/if}

				<CardHeader class="pb-4">
					<CardTitle class="text-xl">{tier.name}</CardTitle>
					<CardDescription>{tier.description}</CardDescription>
				</CardHeader>

				<CardContent class="flex flex-1 flex-col">
					<div class="mb-6">
						{#if tier.price === 0}
							<span class="text-4xl font-bold">Free</span>
							<span class="text-muted-foreground"> forever</span>
						{:else if tier.price === null}
							<span class="text-4xl font-bold">Custom</span>
						{:else}
							<span class="text-4xl font-bold">${tier.price}</span>
							<span class="text-muted-foreground">
								{tier.name === 'Teams' ? '/user/mo' : '/month'}
							</span>
						{/if}
					</div>

					<ul class="mb-8 flex-1 space-y-3">
						{#each tier.features as feature}
							<li class="flex items-start gap-2 text-sm">
								<Check class="mt-0.5 size-4 shrink-0 text-tokyo-green" />
								<span class="text-foreground/80">{feature}</span>
							</li>
						{/each}
					</ul>

					{#if tier.available}
						<Button 
							href={tier.ctaLink} 
							class="w-full bg-tokyo-blue transition-colors hover:bg-tokyo-blue/90"
						>
							{tier.cta}
						</Button>
					{:else if tier.ctaLink}
						<Button 
							href={tier.ctaLink}
							variant="outline" 
							class="w-full"
						>
							{tier.cta}
						</Button>
					{:else}
						<Button 
							variant="outline" 
							class="w-full cursor-not-allowed opacity-60"
							disabled
						>
							{tier.cta}
						</Button>
					{/if}
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- FAQ / Additional Info -->
	<div class="mt-20">
		<h2 class="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>
		<div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
			<div class="rounded-lg border border-border/50 bg-card/50 p-6">
				<h3 class="mb-2 font-semibold">Is Redshift really free?</h3>
				<p class="text-sm text-muted-foreground">
					Yes! The core functionality is completely free for individual developers. 
					You can create unlimited projects, secrets, and environments. 
					We believe in open source and self-sovereignty.
				</p>
			</div>
			<div class="rounded-lg border border-border/50 bg-card/50 p-6">
				<h3 class="mb-2 font-semibold">What's coming in paid tiers?</h3>
				<p class="text-sm text-muted-foreground">
					Cloud adds managed relays and backups. Teams adds MLS group encryption, 
					Bunker Orchestrator for key custody, and SAML SSO. Enterprise adds 
					OIDC→Nostr SSO Bridge, SCIM provisioning, and SOC2 compliance.
				</p>
			</div>
			<div class="rounded-lg border border-border/50 bg-card/50 p-6">
				<h3 class="mb-2 font-semibold">Can I self-host everything?</h3>
				<p class="text-sm text-muted-foreground">
					Absolutely. Redshift is MIT licensed. You can run your own Nostr relays, 
					host the web admin yourself, and have complete control over your infrastructure.
				</p>
			</div>
			<div class="rounded-lg border border-border/50 bg-card/50 p-6">
				<h3 class="mb-2 font-semibold">How is this different from Doppler?</h3>
				<p class="text-sm text-muted-foreground">
					Doppler is centralized - they hold your secrets. With Redshift, your secrets are 
					encrypted client-side and stored on decentralized Nostr relays. You own your keys, you own your data.
				</p>
			</div>
		</div>
	</div>

	<!-- CTA -->
	<div class="mt-20 text-center">
		<h2 class="mb-4 text-2xl font-bold">Ready to own your secrets?</h2>
		<p class="mb-8 text-muted-foreground">
			Get started for free in under 5 minutes. No credit card required.
		</p>
		<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
			<Button 
				href="/admin" 
				size="lg"
				class="bg-gradient-to-r from-tokyo-blue to-tokyo-purple text-white transition-opacity hover:opacity-90"
			>
				Get Started Free
			</Button>
			<Button 
				href="/docs/quickstart" 
				variant="outline" 
				size="lg"
			>
				Read the Quickstart
			</Button>
		</div>
	</div>
</div>
