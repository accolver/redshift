<script lang="ts">
import { Button } from '$lib/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '$lib/components/ui/dialog';
import { Zap, ExternalLink, LoaderCircle, CheckCircle, XCircle, Bitcoin } from '@lucide/svelte';
import {
	createSubscription,
	fetchSubscriptionStatus,
	getSubscriptionState,
	type CreateInvoiceResponse,
} from '$lib/stores/subscription.svelte';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

type PaymentState = 'idle' | 'creating' | 'pending' | 'success' | 'error';

let paymentState = $state<PaymentState>('idle');
let invoice = $state<CreateInvoiceResponse | null>(null);
let errorMessage = $state<string | null>(null);
let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

const subscription = $derived(getSubscriptionState());

// Reset state when dialog opens
$effect(() => {
	if (open) {
		paymentState = 'idle';
		invoice = null;
		errorMessage = null;
	} else {
		// Clean up polling when dialog closes
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}
});

// Poll for payment completion when invoice is pending
$effect(() => {
	if (paymentState === 'pending' && invoice) {
		// Poll every 5 seconds
		pollInterval = setInterval(async () => {
			const status = await fetchSubscriptionStatus(true);
			if (status?.active) {
				paymentState = 'success';
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}
			}
		}, 5000);

		// Stop polling after invoice expires
		const expiresIn = invoice.expiresAt - Date.now();
		if (expiresIn > 0) {
			setTimeout(() => {
				if (paymentState === 'pending') {
					paymentState = 'error';
					errorMessage = 'Invoice expired. Please try again.';
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
				}
			}, expiresIn);
		}
	}

	return () => {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	};
});

async function handleCreateInvoice() {
	paymentState = 'creating';
	errorMessage = null;

	const redirectUrl = `${window.location.origin}/admin/subscribe?status=success`;
	const result = await createSubscription(redirectUrl);

	if (result) {
		invoice = result;
		paymentState = 'pending';
	} else {
		paymentState = 'error';
		errorMessage = subscription.error ?? 'Failed to create invoice';
	}
}

function openCheckout() {
	if (invoice?.checkoutUrl) {
		window.open(invoice.checkoutUrl, '_blank');
	}
}

function handleClose() {
	onOpenChange(false);
}
</script>

<Dialog bind:open {onOpenChange}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Zap class="size-5 text-tokyo-blue" />
				Upgrade to Cloud
			</DialogTitle>
			<DialogDescription>
				Pay with Bitcoin (Lightning or on-chain) for instant activation.
			</DialogDescription>
		</DialogHeader>

		<div class="py-4">
			{#if paymentState === 'idle'}
				<!-- Initial state - show pricing -->
				<div class="space-y-4">
					<div class="rounded-lg border bg-muted/50 p-4 text-center">
						<div class="text-3xl font-bold">$5</div>
						<div class="text-sm text-muted-foreground">per month</div>
					</div>

					<div class="space-y-2 text-sm">
						<div class="flex items-center gap-2">
							<CheckCircle class="size-4 text-tokyo-green" />
							<span>Managed relay infrastructure</span>
						</div>
						<div class="flex items-center gap-2">
							<CheckCircle class="size-4 text-tokyo-green" />
							<span>Automatic encrypted backups (R2)</span>
						</div>
						<div class="flex items-center gap-2">
							<CheckCircle class="size-4 text-tokyo-green" />
							<span>99.5% uptime SLA</span>
						</div>
						<div class="flex items-center gap-2">
							<CheckCircle class="size-4 text-tokyo-green" />
							<span>7-day audit log retention</span>
						</div>
						<div class="flex items-center gap-2">
							<CheckCircle class="size-4 text-tokyo-green" />
							<span>Priority support</span>
						</div>
					</div>

					<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<Bitcoin class="size-4" />
						<span>Bitcoin only (Lightning preferred)</span>
					</div>
				</div>

			{:else if paymentState === 'creating'}
				<!-- Creating invoice -->
				<div class="flex flex-col items-center justify-center py-8">
					<LoaderCircle class="size-8 animate-spin text-tokyo-blue" />
					<p class="mt-4 text-sm text-muted-foreground">Creating invoice...</p>
				</div>

			{:else if paymentState === 'pending'}
				<!-- Invoice created, waiting for payment -->
				<div class="space-y-4">
					<div class="rounded-lg border border-tokyo-blue/50 bg-tokyo-blue/10 p-4 text-center">
						<p class="text-sm font-medium">Invoice created!</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Click below to pay with Bitcoin
						</p>
					</div>

					<Button onclick={openCheckout} class="w-full" size="lg">
						<ExternalLink class="mr-2 size-4" />
						Open Payment Page
					</Button>

					<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle class="size-4 animate-spin" />
						<span>Waiting for payment confirmation...</span>
					</div>

					<p class="text-center text-xs text-muted-foreground">
						Invoice expires in {Math.max(0, Math.floor((invoice!.expiresAt - Date.now()) / 60000))} minutes
					</p>
				</div>

			{:else if paymentState === 'success'}
				<!-- Payment successful -->
				<div class="flex flex-col items-center justify-center py-8">
					<div class="flex size-16 items-center justify-center rounded-full bg-tokyo-green/20">
						<CheckCircle class="size-8 text-tokyo-green" />
					</div>
					<p class="mt-4 text-lg font-medium">Payment Successful!</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Your Cloud subscription is now active.
					</p>
				</div>

			{:else if paymentState === 'error'}
				<!-- Error state -->
				<div class="flex flex-col items-center justify-center py-8">
					<div class="flex size-16 items-center justify-center rounded-full bg-destructive/20">
						<XCircle class="size-8 text-destructive" />
					</div>
					<p class="mt-4 text-lg font-medium">Payment Failed</p>
					<p class="mt-1 text-center text-sm text-muted-foreground">
						{errorMessage ?? 'Something went wrong. Please try again.'}
					</p>
				</div>
			{/if}
		</div>

		<DialogFooter>
			{#if paymentState === 'idle'}
				<Button variant="outline" onclick={handleClose}>
					Cancel
				</Button>
				<Button onclick={handleCreateInvoice}>
					<Zap class="mr-2 size-4" />
					Create Invoice
				</Button>
			{:else if paymentState === 'pending'}
				<Button variant="outline" onclick={handleClose}>
					Close
				</Button>
			{:else if paymentState === 'success'}
				<Button onclick={handleClose}>
					Done
				</Button>
			{:else if paymentState === 'error'}
				<Button variant="outline" onclick={handleClose}>
					Cancel
				</Button>
				<Button onclick={handleCreateInvoice}>
					Try Again
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>
