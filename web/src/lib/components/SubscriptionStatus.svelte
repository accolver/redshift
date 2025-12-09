<script lang="ts">
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
import { Cloud, Calendar, Server, Zap, AlertTriangle, LoaderCircle } from '@lucide/svelte';
import {
	getSubscriptionState,
	fetchSubscriptionStatus,
	isExpiringSoon,
	getExpirationDate,
	hasActiveSubscription,
} from '$lib/stores/subscription.svelte';
import { onMount } from 'svelte';

interface Props {
	/** Callback when user wants to upgrade/renew */
	onUpgrade?: () => void;
	/** Show compact version */
	compact?: boolean;
}

let { onUpgrade, compact = false }: Props = $props();

const subscription = $derived(getSubscriptionState());
const active = $derived(hasActiveSubscription());
const expiringSoon = $derived(isExpiringSoon());
const expirationDate = $derived(getExpirationDate());

onMount(() => {
	fetchSubscriptionStatus();
});

function getTierLabel(tier: string | undefined): string {
	switch (tier) {
		case 'cloud':
			return 'Cloud';
		case 'teams':
			return 'Teams';
		case 'enterprise':
			return 'Enterprise';
		default:
			return 'Free';
	}
}

function getTierColor(tier: string | undefined): string {
	switch (tier) {
		case 'cloud':
			return 'bg-tokyo-blue/10 text-tokyo-blue border-tokyo-blue/30';
		case 'teams':
			return 'bg-tokyo-purple/10 text-tokyo-purple border-tokyo-purple/30';
		case 'enterprise':
			return 'bg-tokyo-orange/10 text-tokyo-orange border-tokyo-orange/30';
		default:
			return 'bg-muted text-muted-foreground';
	}
}
</script>

{#if compact}
	<!-- Compact version for navigation/sidebar -->
	<div class="flex items-center gap-2">
		{#if subscription.loading}
			<LoaderCircle class="size-4 animate-spin text-muted-foreground" />
		{:else if active}
			<Badge variant="outline" class={getTierColor(subscription.status?.tier)}>
				<Cloud class="mr-1 size-3" />
				{getTierLabel(subscription.status?.tier)}
			</Badge>
			{#if expiringSoon}
				<AlertTriangle class="size-4 text-tokyo-orange" />
			{/if}
		{:else}
			<Badge variant="outline" class="bg-muted text-muted-foreground">
				Free
			</Badge>
		{/if}
	</div>
{:else}
	<!-- Full card version -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Cloud class="size-5 text-tokyo-blue" />
					<CardTitle class="text-lg">Subscription</CardTitle>
				</div>
				<Badge variant="outline" class={getTierColor(subscription.status?.tier)}>
					{getTierLabel(subscription.status?.tier)}
				</Badge>
			</div>
			<CardDescription>
				{#if active}
					Your Cloud subscription is active
				{:else}
					Upgrade to Cloud for managed relays and backups
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if subscription.loading}
				<div class="flex items-center justify-center py-4">
					<LoaderCircle class="size-6 animate-spin text-muted-foreground" />
				</div>
			{:else if subscription.error}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
					{subscription.error}
				</div>
			{:else if active}
				<!-- Active subscription details -->
				<div class="space-y-3">
					<!-- Expiration -->
					<div class="flex items-center gap-3">
						<div class="flex size-8 items-center justify-center rounded-lg bg-muted">
							<Calendar class="size-4 text-muted-foreground" />
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium">
								{#if expiringSoon}
									<span class="text-tokyo-orange">Expires soon</span>
								{:else}
									Valid until
								{/if}
							</p>
							<p class="text-sm text-muted-foreground">
								{expirationDate}
								{#if subscription.status?.daysRemaining !== undefined}
									({subscription.status.daysRemaining} days remaining)
								{/if}
							</p>
						</div>
					</div>

					<!-- Relay URL -->
					{#if subscription.status?.relayUrl}
						<div class="flex items-center gap-3">
							<div class="flex size-8 items-center justify-center rounded-lg bg-muted">
								<Server class="size-4 text-muted-foreground" />
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium">Managed Relay</p>
								<p class="font-mono text-sm text-muted-foreground">
									{subscription.status.relayUrl}
								</p>
							</div>
						</div>
					{/if}

					{#if expiringSoon}
						<Button onclick={onUpgrade} class="w-full">
							<Zap class="mr-2 size-4" />
							Renew Subscription
						</Button>
					{/if}
				</div>
			{:else}
				<!-- No subscription - show upgrade prompt -->
				<div class="space-y-3">
					<div class="rounded-lg border border-dashed p-4 text-center">
						<Cloud class="mx-auto mb-2 size-8 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">
							Get managed relays, automatic backups, and 99.5% SLA
						</p>
					</div>

					<div class="space-y-2 text-sm">
						<div class="flex items-center gap-2">
							<Zap class="size-4 text-tokyo-green" />
							<span>Managed relay infrastructure</span>
						</div>
						<div class="flex items-center gap-2">
							<Zap class="size-4 text-tokyo-green" />
							<span>Automatic encrypted backups</span>
						</div>
						<div class="flex items-center gap-2">
							<Zap class="size-4 text-tokyo-green" />
							<span>99.5% uptime SLA</span>
						</div>
						<div class="flex items-center gap-2">
							<Zap class="size-4 text-tokyo-green" />
							<span>7-day audit log retention</span>
						</div>
					</div>

					<Button onclick={onUpgrade} class="w-full">
						<Zap class="mr-2 size-4" />
						Upgrade to Cloud — $5/month
					</Button>
				</div>
			{/if}

			<!-- Pending invoice notice -->
			{#if subscription.status?.pendingInvoice}
				<div class="rounded-lg border border-tokyo-orange/50 bg-tokyo-orange/10 p-3">
					<div class="flex items-center gap-2">
						<AlertTriangle class="size-4 text-tokyo-orange" />
						<span class="text-sm font-medium text-tokyo-orange">Payment pending</span>
					</div>
					<p class="mt-1 text-sm text-muted-foreground">
						You have an unpaid invoice. Complete payment to activate your subscription.
					</p>
					<Button
						variant="outline"
						size="sm"
						class="mt-2"
						onclick={() => window.open(subscription.status?.pendingInvoice?.checkoutUrl, '_blank')}
					>
						Complete Payment
					</Button>
				</div>
			{/if}
		</CardContent>
	</Card>
{/if}
