<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
import { Badge } from '$lib/components/ui/badge';
import {
	Activity,
	Plus,
	Pencil,
	Trash2,
	Eye,
	CreditCard,
	XCircle,
	RefreshCw,
	Clock,
	Filter,
	Crown,
	AlertCircle,
} from '@lucide/svelte';
import {
	getAuditState,
	fetchAuditEvents,
	clearAuditState,
	getAuditActionLabel,
	formatAuditTime,
	getActionColor,
} from '$lib/stores/audit.svelte';
import { getAuthState } from '$lib/stores/auth.svelte';
import { hasActiveSubscription } from '$lib/stores/subscription.svelte';
import type { AuditAction, AuditEvent } from '@redshift/cloud';

// Filter state
let selectedAction = $state<AuditAction | 'all'>('all');
let searchQuery = $state('');

const auth = $derived(getAuthState());
const auditState = $derived(getAuditState());
const isSubscribed = $derived(hasActiveSubscription());

// Filtered events
const filteredEvents = $derived(() => {
	let events = auditState.events;

	// Filter by action type
	if (selectedAction !== 'all') {
		events = events.filter((e) => e.action === selectedAction);
	}

	// Filter by search query (target or description)
	if (searchQuery.trim()) {
		const query = searchQuery.toLowerCase();
		events = events.filter(
			(e) =>
				e.target.toLowerCase().includes(query) ||
				e.details?.description?.toLowerCase().includes(query),
		);
	}

	return events;
});

// Action type options for filter
const actionOptions: { value: AuditAction | 'all'; label: string }[] = [
	{ value: 'all', label: 'All Actions' },
	{ value: 'secret:create', label: 'Secret Created' },
	{ value: 'secret:update', label: 'Secret Updated' },
	{ value: 'secret:delete', label: 'Secret Deleted' },
	{ value: 'secret:read', label: 'Secret Read' },
	{ value: 'subscription:start', label: 'Subscription Started' },
	{ value: 'subscription:renew', label: 'Subscription Renewed' },
	{ value: 'subscription:cancel', label: 'Subscription Cancelled' },
];

function getActionIcon(action: AuditAction) {
	switch (action) {
		case 'secret:create':
			return Plus;
		case 'secret:update':
			return Pencil;
		case 'secret:delete':
			return Trash2;
		case 'secret:read':
			return Eye;
		case 'subscription:start':
		case 'subscription:renew':
			return CreditCard;
		case 'subscription:cancel':
			return XCircle;
		default:
			return Activity;
	}
}

function handleRefresh() {
	fetchAuditEvents();
}

onMount(() => {
	if (isSubscribed) {
		fetchAuditEvents();
	}
});

onDestroy(() => {
	clearAuditState();
});
</script>

<svelte:head>
	<title>Audit Logs - Redshift</title>
	<meta name="description" content="View your Redshift Cloud audit logs." />
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Audit Logs</h1>
			<p class="text-muted-foreground">Track all actions on your secrets and subscription.</p>
		</div>
		{#if isSubscribed}
			<Button variant="outline" onclick={handleRefresh} disabled={auditState.loading}>
				<RefreshCw class="mr-2 size-4 {auditState.loading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
		{/if}
	</div>

	{#if !auth.isConnected}
		<Card>
			<CardContent class="py-8 text-center">
				<p class="text-muted-foreground">Please connect your Nostr identity to view audit logs.</p>
			</CardContent>
		</Card>
	{:else if !isSubscribed}
		<!-- Upgrade prompt for non-subscribers -->
		<Card class="border-tokyo-blue/30">
			<CardContent class="py-12 text-center">
				<Crown class="mx-auto mb-4 size-12 text-tokyo-blue/50" />
				<h2 class="mb-2 text-xl font-semibold">Cloud Feature</h2>
				<p class="mb-6 text-muted-foreground">
					Audit logs are available for Cloud subscribers. Track all actions on your secrets
					with 7-day retention.
				</p>
				<Button href="/admin/subscribe" class="bg-tokyo-blue hover:bg-tokyo-blue/90">
					<Crown class="mr-2 size-4" />
					Upgrade to Cloud
				</Button>
			</CardContent>
		</Card>
	{:else}
		<!-- Retention notice -->
		<div class="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
			<Clock class="size-4 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">
				Audit logs are retained for 90 days. Events older than 90 days are automatically deleted.
			</p>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<Filter class="size-4 text-muted-foreground" />
				<select
					bind:value={selectedAction}
					class="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					{#each actionOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			<input
				type="text"
				placeholder="Search by project or description..."
				bind:value={searchQuery}
				class="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
			/>
		</div>

		<!-- Error state -->
		{#if auditState.error}
			<div class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
				<AlertCircle class="size-5 text-destructive" />
				<p class="text-sm text-destructive">{auditState.error}</p>
			</div>
		{/if}

		<!-- Loading state -->
		{#if auditState.loading && auditState.events.length === 0}
			<Card>
				<CardContent class="py-12 text-center">
					<RefreshCw class="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
					<p class="text-muted-foreground">Loading audit logs...</p>
				</CardContent>
			</Card>
		{:else if filteredEvents().length === 0}
			<!-- Empty state -->
			<Card>
				<CardContent class="py-12 text-center">
					<Activity class="mx-auto mb-4 size-12 text-muted-foreground/50" />
					<h3 class="mb-2 font-semibold">No audit events found</h3>
					<p class="text-sm text-muted-foreground">
						{#if selectedAction !== 'all' || searchQuery}
							Try adjusting your filters or search query.
						{:else}
							Actions on your secrets will appear here.
						{/if}
					</p>
				</CardContent>
			</Card>
		{:else}
			<!-- Audit log list -->
			<Card>
				<CardHeader>
					<CardTitle>Activity</CardTitle>
					<CardDescription>
						{filteredEvents().length} event{filteredEvents().length === 1 ? '' : 's'}
						{#if selectedAction !== 'all'}
							matching filter
						{/if}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-1">
						{#each filteredEvents() as event}
							{@const Icon = getActionIcon(event.action)}
							<div class="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50">
								<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
									<Icon class="size-5 {getActionColor(event.action)}" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="font-medium">{getAuditActionLabel(event.action)}</span>
										<Badge variant="outline" class="text-xs">
											{event.target}
										</Badge>
									</div>
									{#if event.details?.description}
										<p class="mt-0.5 text-sm text-muted-foreground">
											{event.details.description}
										</p>
									{/if}
									<p class="mt-1 text-xs text-muted-foreground">
										{formatAuditTime(event.timestamp)}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		{/if}
	{/if}
</div>
