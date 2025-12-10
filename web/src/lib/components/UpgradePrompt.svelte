<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Cloud, X, Zap } from '@lucide/svelte';
import {
	getSubscriptionState,
	hasActiveSubscription,
	isExpiringSoon,
} from '$lib/stores/subscription.svelte';

interface Props {
	/** Callback when user wants to upgrade */
	onUpgrade?: () => void;
	/** Allow dismissing the prompt */
	dismissible?: boolean;
	/** Variant style */
	variant?: 'banner' | 'card' | 'inline';
}

let { onUpgrade, dismissible = true, variant = 'banner' }: Props = $props();

let dismissed = $state(false);

const subscription = $derived(getSubscriptionState());
const active = $derived(hasActiveSubscription());
const expiringSoon = $derived(isExpiringSoon());

// Don't show if dismissed or has active subscription (unless expiring)
const shouldShow = $derived(!dismissed && (!active || expiringSoon));

function handleDismiss() {
	dismissed = true;
}
</script>

{#if shouldShow}
	{#if variant === 'banner'}
		<!-- Full-width banner -->
		<div class="relative border-b border-tokyo-blue/30 bg-tokyo-blue/10 px-4 py-3">
			<div class="mx-auto flex max-w-7xl items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<Cloud class="size-5 text-tokyo-blue" />
					<p class="text-sm">
						{#if expiringSoon}
							<span class="font-medium">Your subscription expires soon!</span>
							<span class="text-muted-foreground"> Renew to keep your managed relay access.</span>
						{:else}
							<span class="font-medium">Upgrade to Cloud</span>
							<span class="text-muted-foreground"> for managed relays, backups, and 99.5% SLA.</span>
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Button size="sm" onclick={onUpgrade}>
						<Zap class="mr-1 size-3" />
						{expiringSoon ? 'Renew' : 'Upgrade'} — $5/mo
					</Button>
					{#if dismissible}
						<button
							type="button"
							class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onclick={handleDismiss}
							aria-label="Dismiss"
						>
							<X class="size-4" />
						</button>
					{/if}
				</div>
			</div>
		</div>

	{:else if variant === 'card'}
		<!-- Card style for sidebars -->
		<div class="relative rounded-lg border border-tokyo-blue/30 bg-tokyo-blue/10 p-4">
			{#if dismissible}
				<button
					type="button"
					class="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					onclick={handleDismiss}
					aria-label="Dismiss"
				>
					<X class="size-3" />
				</button>
			{/if}
			<div class="flex items-start gap-3">
				<div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tokyo-blue/20">
					<Cloud class="size-4 text-tokyo-blue" />
				</div>
				<div class="flex-1 space-y-2">
					<p class="text-sm font-medium">
						{#if expiringSoon}
							Subscription expiring
						{:else}
							Upgrade to Cloud
						{/if}
					</p>
					<p class="text-xs text-muted-foreground">
						{#if expiringSoon}
							Renew to keep managed relays and backups.
						{:else}
							Get managed relays, automatic backups, and 99.5% uptime SLA.
						{/if}
					</p>
					<Button size="sm" variant="secondary" onclick={onUpgrade} class="w-full">
						<Zap class="mr-1 size-3" />
						{expiringSoon ? 'Renew' : 'Upgrade'}
					</Button>
				</div>
			</div>
		</div>

	{:else if variant === 'inline'}
		<!-- Inline style for within content -->
		<div class="inline-flex items-center gap-2 rounded-full border border-tokyo-blue/30 bg-tokyo-blue/10 px-3 py-1 text-sm">
			<Cloud class="size-3 text-tokyo-blue" />
			<span class="text-muted-foreground">
				{#if expiringSoon}
					Subscription expiring
				{:else}
					Free tier
				{/if}
			</span>
			<button
				type="button"
				class="font-medium text-tokyo-blue transition-colors hover:underline"
				onclick={onUpgrade}
			>
				{expiringSoon ? 'Renew' : 'Upgrade'}
			</button>
			{#if dismissible}
				<button
					type="button"
					class="text-muted-foreground transition-colors hover:text-foreground"
					onclick={handleDismiss}
					aria-label="Dismiss"
				>
					<X class="size-3" />
				</button>
			{/if}
		</div>
	{/if}
{/if}
