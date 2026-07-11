<script lang="ts">
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, X } from '@lucide/svelte';
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { retryPublication } from '$lib/stores/nostr.svelte';
import {
	getPublicationRecoveryState,
	removePublicationRecovery,
} from '$lib/stores/publication-recovery.svelte';

let detailsOpen = $state(false);
let recovery = $derived(getPublicationRecoveryState());
let belowQuorumCount = $derived(
	recovery.records.filter((record) => record.report.accepted.length < record.report.required).length,
);

async function handleRetry(eventId: string) {
	try {
		await retryPublication(eventId);
	} catch {
		// The recovery store exposes the user-safe error in the panel.
	}
}

function statusClass(state: 'accepted' | 'rejected' | 'unavailable') {
	if (state === 'accepted') return 'border-tokyo-green/40 bg-tokyo-green/10 text-tokyo-green';
	if (state === 'rejected') return 'border-tokyo-red/40 bg-tokyo-red/10 text-tokyo-red';
	return 'border-tokyo-orange/40 bg-tokyo-orange/10 text-tokyo-orange';
}
</script>

{#if recovery.error}
	<Card.Root class="border-destructive/30 bg-destructive/5" data-testid="publication-recovery-error">
		<Card.Content class="flex items-start gap-3 pt-6">
			<AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" />
			<p class="text-sm text-destructive" role="alert">{recovery.error}</p>
		</Card.Content>
	</Card.Root>
{/if}

{#if recovery.records.length > 0}
	<Card.Root class="border-tokyo-orange/30 bg-tokyo-orange/5" data-testid="publication-recovery-panel">
		<Card.Header class="gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex min-w-0 items-start gap-3">
				<AlertTriangle class="mt-0.5 size-5 shrink-0 text-tokyo-orange" />
				<div>
					<Card.Title class="text-base">
						{belowQuorumCount > 0 ? 'Relay publication needs recovery' : 'Saved with degraded relay redundancy'}
					</Card.Title>
					<Card.Description class="mt-1">
						{#if belowQuorumCount > 0}
							{belowQuorumCount} encrypted secret {belowQuorumCount === 1 ? 'event did' : 'events did'} not reach publication quorum.
						{:else}
							{recovery.records.length} encrypted secret {recovery.records.length === 1 ? 'event needs' : 'events need'} relay attention.
						{/if}
					</Card.Description>
				</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				class="transition-colors"
				onclick={() => (detailsOpen = !detailsOpen)}
				aria-expanded={detailsOpen}
			>
				Details
				{#if detailsOpen}<ChevronUp class="size-4" />{:else}<ChevronDown class="size-4" />{/if}
			</Button>
		</Card.Header>

		{#if detailsOpen}
			<Card.Content class="space-y-4 border-t border-tokyo-orange/20 pt-4">
				{#each recovery.records as record (record.event.id)}
					{@const unavailable = record.report.outcomes.filter(({ state }) => state === 'unavailable')}
					{@const retrying = recovery.retryingEventIds.has(record.event.id)}
					<div class="rounded-lg border border-border bg-background/70 p-4" data-event-id={record.event.id}>
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="font-medium">
									{record.context.project ?? 'Encrypted secret publication'}{record.context.environment ? ` / ${record.context.environment}` : ''}
								</p>
								<p class={record.report.accepted.length >= record.report.required ? 'text-xs text-tokyo-orange' : 'text-xs text-destructive'}>
									{record.report.accepted.length >= record.report.required
										? 'Quorum reached; redundancy degraded'
										: `Failed below quorum (${record.report.accepted.length}/${record.report.required} accepted)`}
								</p>
								<p class="truncate font-mono text-xs text-muted-foreground" title={record.event.id}>
									{record.event.id}
								</p>
							</div>
							<div class="flex flex-wrap gap-2">
								{#if unavailable.length > 0}
									<Button
										size="sm"
										class="transition-colors"
										disabled={retrying}
										onclick={() => void handleRetry(record.event.id)}
									>
										<RefreshCw class={retrying ? 'size-4 animate-spin' : 'size-4'} />
										{retrying ? 'Retrying…' : 'Retry unavailable relays'}
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									class="transition-colors"
									onclick={() => removePublicationRecovery(record.event.id)}
									title="Dismiss local notice only; relay data is unchanged"
								>
									<X class="size-4" /> Dismiss notice
								</Button>
							</div>
						</div>
						<div class="mt-3 space-y-2">
							{#each record.report.outcomes as outcome (outcome.target)}
								<div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
									<span class="min-w-0 truncate font-mono text-xs" title={outcome.target}>{outcome.target}</span>
									<div class="flex items-center gap-2">
										{#if outcome.state === 'accepted'}<CheckCircle2 class="size-4 text-tokyo-green" />{/if}
										<Badge variant="outline" class={statusClass(outcome.state)}>{outcome.state}</Badge>
									</div>
									{#if outcome.reason}<p class="w-full text-xs text-muted-foreground">{outcome.reason}</p>{/if}
								</div>
							{/each}
						</div>
						<p class="mt-3 text-xs text-muted-foreground">
							Retry republishes this existing encrypted event. It is not a backup and does not delete historical relay data.
						</p>
					</div>
				{/each}
			</Card.Content>
		{/if}
	</Card.Root>
{/if}
