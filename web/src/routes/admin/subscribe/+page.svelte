<script lang="ts">
import { Motion } from 'svelte-motion';
import { page } from '$app/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
import { Button } from '$lib/components/ui/button';
import { Badge } from '$lib/components/ui/badge';
import SubscriptionStatus from '$lib/components/SubscriptionStatus.svelte';
import PaymentModal from '$lib/components/PaymentModal.svelte';
import {
	Cloud,
	Server,
	Shield,
	Clock,
	Zap,
	CheckCircle,
	HardDrive,
	HeartHandshake,
} from '@lucide/svelte';
import { getAuthState } from '$lib/stores/auth.svelte';
import {
	fetchSubscriptionStatus,
	hasActiveSubscription,
	getSubscriptionState,
} from '$lib/stores/subscription.svelte';
import { onMount } from 'svelte';

const auth = $derived(getAuthState());
const subscription = $derived(getSubscriptionState());
const active = $derived(hasActiveSubscription());

let showPaymentModal = $state(false);

// Check for success redirect from BTCPay
const paymentStatus = $derived($page.url.searchParams.get('status'));

onMount(() => {
	if (auth.isConnected) {
		fetchSubscriptionStatus(true);
	}
});

// Refresh on payment success redirect
$effect(() => {
	if (paymentStatus === 'success') {
		fetchSubscriptionStatus(true);
	}
});

function openPaymentModal() {
	showPaymentModal = true;
}

const features = [
	{
		icon: Server,
		title: 'Managed Relay',
		description: 'Dedicated Nostr relay infrastructure on Cloudflare edge',
		color: 'text-tokyo-blue',
		bg: 'bg-tokyo-blue/10',
	},
	{
		icon: HardDrive,
		title: 'Automatic Backups',
		description: 'Encrypted backups to Cloudflare R2 with geographic redundancy',
		color: 'text-tokyo-green',
		bg: 'bg-tokyo-green/10',
	},
	{
		icon: Shield,
		title: '99.5% SLA',
		description: 'Enterprise-grade uptime guarantee for your secrets',
		color: 'text-tokyo-purple',
		bg: 'bg-tokyo-purple/10',
	},
	{
		icon: Clock,
		title: 'Audit Logs',
		description: '7-day retention of all secret access events',
		color: 'text-tokyo-orange',
		bg: 'bg-tokyo-orange/10',
	},
	{
		icon: Zap,
		title: 'Priority Support',
		description: 'Direct support channel for Cloud subscribers',
		color: 'text-tokyo-cyan',
		bg: 'bg-tokyo-cyan/10',
	},
	{
		icon: HeartHandshake,
		title: 'Support Development',
		description: 'Help fund open-source Nostr infrastructure',
		color: 'text-tokyo-red',
		bg: 'bg-tokyo-red/10',
	},
];

const comparison = [
	{ feature: 'Unlimited projects', free: true, cloud: true },
	{ feature: 'Unlimited secrets', free: true, cloud: true },
	{ feature: 'CLI access', free: true, cloud: true },
	{ feature: 'Web admin', free: true, cloud: true },
	{ feature: 'End-to-end encryption', free: true, cloud: true },
	{ feature: 'Public relay storage', free: true, cloud: true },
	{ feature: 'Managed relay', free: false, cloud: true },
	{ feature: 'Automatic backups', free: false, cloud: true },
	{ feature: '99.5% SLA', free: false, cloud: true },
	{ feature: 'Audit logs', free: false, cloud: true },
	{ feature: 'Priority support', free: false, cloud: true },
];
</script>

<svelte:head>
	<title>Subscription - Redshift Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-8">
	<!-- Page header -->
	<Motion
		initial={{ opacity: 0, y: -10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.3 }}
		let:motion
	>
		<div use:motion>
			<div class="flex items-center gap-3">
				<Cloud class="size-8 text-tokyo-blue" />
				<div>
					<h1 class="text-3xl font-bold">Cloud Subscription</h1>
					<p class="text-muted-foreground">Managed infrastructure for your secrets</p>
				</div>
			</div>
		</div>
	</Motion>

	<!-- Payment success message -->
	{#if paymentStatus === 'success'}
		<Motion
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.3 }}
			let:motion
		>
			<div use:motion class="rounded-lg border border-tokyo-green/50 bg-tokyo-green/10 p-4">
				<div class="flex items-center gap-3">
					<CheckCircle class="size-5 text-tokyo-green" />
					<div>
						<p class="font-medium text-tokyo-green">Payment successful!</p>
						<p class="text-sm text-muted-foreground">
							Your Cloud subscription is now active. Thank you for your support!
						</p>
					</div>
				</div>
			</div>
		</Motion>
	{/if}

	<!-- Current subscription status -->
	{#if auth.isConnected}
		<Motion
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: 0.1 }}
			let:motion
		>
			<div use:motion>
				<SubscriptionStatus onUpgrade={openPaymentModal} />
			</div>
		</Motion>
	{/if}

	<!-- Pricing card (show if not subscribed) -->
	{#if !active}
		<Motion
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: 0.15 }}
			let:motion
		>
			<div use:motion>
			<Card class="border-tokyo-blue/30">
				<CardHeader class="text-center">
					<Badge variant="outline" class="mx-auto mb-2 w-fit bg-tokyo-blue/10 text-tokyo-blue">
						Most Popular
					</Badge>
					<CardTitle class="text-2xl">Cloud</CardTitle>
					<CardDescription>Everything you need for production secrets</CardDescription>
					<div class="pt-4">
						<span class="text-4xl font-bold">$5</span>
						<span class="text-muted-foreground">/month</span>
					</div>
				</CardHeader>
				<CardContent class="space-y-6">
					<!-- Feature grid -->
					<div class="grid gap-4 sm:grid-cols-2">
						{#each features as feature, i}
							<Motion
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.2, delay: 0.2 + i * 0.05 }}
								let:motion
							>
								<div use:motion class="flex items-start gap-3">
									<div class="flex size-8 shrink-0 items-center justify-center rounded-lg {feature.bg}">
										<feature.icon class="size-4 {feature.color}" />
									</div>
									<div>
										<p class="text-sm font-medium">{feature.title}</p>
										<p class="text-xs text-muted-foreground">{feature.description}</p>
									</div>
								</div>
							</Motion>
						{/each}
					</div>

					<Button onclick={openPaymentModal} class="w-full" size="lg" disabled={!auth.isConnected}>
						<Zap class="mr-2 size-4" />
						{#if auth.isConnected}
							Subscribe with Bitcoin
						{:else}
							Connect to Subscribe
						{/if}
					</Button>

					<p class="text-center text-xs text-muted-foreground">
						Pay with Lightning (instant) or on-chain Bitcoin. Cancel anytime.
					</p>
				</CardContent>
			</Card>
			</div>
		</Motion>
	{/if}

	<!-- Feature comparison table -->
	<Motion
		initial={{ opacity: 0, y: 10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.3, delay: 0.2 }}
		let:motion
	>
		<div use:motion>
		<Card>
			<CardHeader>
				<CardTitle class="text-lg">Plan Comparison</CardTitle>
				<CardDescription>See what's included in each plan</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b">
								<th class="py-3 text-left text-sm font-medium">Feature</th>
								<th class="py-3 text-center text-sm font-medium">Free</th>
								<th class="py-3 text-center text-sm font-medium">
									<span class="text-tokyo-blue">Cloud</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each comparison as row, i}
								<Motion
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.2, delay: 0.25 + i * 0.02 }}
									let:motion
								>
									<tr use:motion class="border-b last:border-0">
										<td class="py-3 text-sm">{row.feature}</td>
										<td class="py-3 text-center">
											{#if row.free}
												<CheckCircle class="mx-auto size-4 text-tokyo-green" />
											{:else}
												<span class="text-muted-foreground">—</span>
											{/if}
										</td>
										<td class="py-3 text-center">
											{#if row.cloud}
												<CheckCircle class="mx-auto size-4 text-tokyo-green" />
											{:else}
												<span class="text-muted-foreground">—</span>
											{/if}
										</td>
									</tr>
								</Motion>
							{/each}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
		</div>
	</Motion>

	<!-- FAQ -->
	<Motion
		initial={{ opacity: 0, y: 10 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.3, delay: 0.25 }}
		let:motion
	>
		<div use:motion>
		<Card>
			<CardHeader>
				<CardTitle class="text-lg">Frequently Asked Questions</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div>
					<p class="font-medium">Can I use the free tier forever?</p>
					<p class="text-sm text-muted-foreground">
						Yes! The free tier is fully functional and stores your encrypted secrets on public Nostr relays.
						Cloud adds managed infrastructure, backups, and SLA guarantees.
					</p>
				</div>
				<div>
					<p class="font-medium">What payment methods do you accept?</p>
					<p class="text-sm text-muted-foreground">
						Bitcoin only — Lightning Network (instant) or on-chain. We use BTCPay Server for
						non-custodial payment processing.
					</p>
				</div>
				<div>
					<p class="font-medium">Can I cancel anytime?</p>
					<p class="text-sm text-muted-foreground">
						Yes. Your subscription runs for 30 days from payment. After expiration, you'll
						automatically fall back to the free tier with public relay storage.
					</p>
				</div>
				<div>
					<p class="font-medium">What happens to my secrets if I cancel?</p>
					<p class="text-sm text-muted-foreground">
						Your secrets remain encrypted and accessible. They'll be stored on public relays instead
						of the managed relay. You can always re-subscribe to restore Cloud features.
					</p>
				</div>
			</CardContent>
		</Card>
		</div>
	</Motion>
</div>

<PaymentModal bind:open={showPaymentModal} onOpenChange={(v) => (showPaymentModal = v)} />
