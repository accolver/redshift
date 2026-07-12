<script lang="ts">
import { Clock3, GitCompareArrows, History, LoaderCircle, RotateCcw, TriangleAlert } from '@lucide/svelte';
import { tick } from 'svelte';
import { compareSecretHistoryVersions } from '$lib/crypto';
import InlineCode from '$lib/components/InlineCode.svelte';
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '$lib/components/ui/dialog';
import {
	getSecretHistoryState,
	restoreSecretHistoryVersion,
} from '$lib/stores/secrets.svelte';

let open = $state(false);
let compareFromId = $state<string | null>(null);
let compareToId = $state<string | null>(null);
let pendingRestoreId = $state<string | null>(null);
let pendingExpectedCurrentEventId = $state<string | null>(null);
let showOverwrite = $state(false);
let confirmationHeading = $state<HTMLElement | null>(null);
let conflictAlert = $state<HTMLElement | null>(null);

const historyState = $derived(getSecretHistoryState());
const pendingRestore = $derived(
	pendingRestoreId
		? historyState.observation.versions.find((version) => version.eventId === pendingRestoreId) ?? null
		: null,
);
const compareFrom = $derived(
	compareFromId
		? historyState.observation.versions.find((version) => version.eventId === compareFromId) ?? null
		: null,
);
const compareTo = $derived(
	compareToId
		? historyState.observation.versions.find((version) => version.eventId === compareToId) ?? null
		: null,
);
const comparison = $derived(
	compareFrom && compareTo ? compareSecretHistoryVersions(compareFrom, compareTo) : null,
);

function shortId(eventId: string) {
	return `${eventId.slice(0, 12)}…${eventId.slice(-6)}`;
}

function timestamp(createdAt: number) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(createdAt * 1000));
}

async function chooseRestore(eventId: string) {
	pendingRestoreId = eventId;
	pendingExpectedCurrentEventId = historyState.observation.versions[0]?.eventId ?? null;
	showOverwrite = false;
	await tick();
	confirmationHeading?.focus();
}

function cancelRestore() {
	pendingRestoreId = null;
	pendingExpectedCurrentEventId = null;
	showOverwrite = false;
}

async function confirmRestore(overwriteCurrent: boolean) {
	if (!pendingRestoreId) return;
	try {
		await restoreSecretHistoryVersion(
			pendingRestoreId,
			pendingExpectedCurrentEventId,
			overwriteCurrent,
		);
		pendingRestoreId = null;
		pendingExpectedCurrentEventId = null;
		showOverwrite = false;
	} catch {
		showOverwrite = getSecretHistoryState().conflict !== null;
		await tick();
		if (showOverwrite) conflictAlert?.focus();
	}
}

function handleOpenChange(next: boolean) {
	open = next;
	if (!next) {
		pendingRestoreId = null;
		pendingExpectedCurrentEventId = null;
		showOverwrite = false;
	}
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
	<DialogTrigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="transition-colors">
				<History class="size-4" />
				History
			</Button>
		{/snippet}
	</DialogTrigger>
	<DialogContent class="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Clock3 class="size-5 text-tokyo-cyan" />
				Authenticated secret history
			</DialogTitle>
			<DialogDescription>
				Bounded owner-authenticated state observed from responding relays. Relay retention can be incomplete.
			</DialogDescription>
		</DialogHeader>

		{#if historyState.isLoading}
			<div class="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
				<LoaderCircle class="size-4 animate-spin" />
				Loading authenticated history…
			</div>
		{:else if historyState.error}
			<div role="alert" class="flex gap-2 rounded-md border border-tokyo-red/40 bg-tokyo-red/10 p-4 text-sm text-tokyo-red">
				<TriangleAlert class="mt-0.5 size-4 shrink-0" />
				{historyState.error}
			</div>
		{:else if historyState.observation.versions.length === 0}
			<div class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
				No authenticated observed versions exist for this environment.
			</div>
		{:else}
			{#if historyState.observation.truncated}
				<div role="status" class="rounded-md border border-tokyo-orange/40 bg-tokyo-orange/10 px-3 py-2 text-sm text-tokyo-orange">
					This observed history is truncated by a fixed safety bound.
				</div>
			{/if}

			<div class="space-y-2">
				{#each historyState.observation.versions as version (version.eventId)}
					<div class="rounded-md border border-border bg-card p-3 transition-colors hover:border-tokyo-blue/40">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0 space-y-1.5">
								<div class="flex flex-wrap items-center gap-2">
									{#if version.current}<Badge>Current</Badge>{/if}
									{#if version.tombstone}
										<Badge variant="destructive">Tombstone</Badge>
									{:else}
										<Badge variant="secondary">{Object.keys(version.secrets).length} keys</Badge>
									{/if}
								</div>
								<p class="text-sm text-foreground">{timestamp(version.createdAt)}</p>
								<p class="text-xs text-muted-foreground">
									Event <InlineCode class="text-xs">{shortId(version.eventId)}</InlineCode>
								</p>
							</div>
							<div class="flex flex-wrap gap-1.5">
								<Button
									variant={compareFromId === version.eventId ? 'default' : 'outline'}
									size="sm"
									class="transition-colors"
									onclick={() => (compareFromId = version.eventId)}
									aria-label={`Compare from ${version.eventId}`}
								>From</Button>
								<Button
									variant={compareToId === version.eventId ? 'default' : 'outline'}
									size="sm"
									class="transition-colors"
									onclick={() => (compareToId = version.eventId)}
									aria-label={`Compare to ${version.eventId}`}
								>To</Button>
								<Button
									variant="outline"
									size="sm"
									class="transition-colors"
									disabled={version.current || historyState.isRestoring}
									onclick={() => chooseRestore(version.eventId)}
									aria-label={`Restore ${version.eventId}`}
								>
									<RotateCcw class="size-3.5" /> Restore
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if comparison}
				<section class="rounded-md border border-tokyo-purple/40 bg-tokyo-purple/10 p-4" aria-label="Version comparison">
					<h3 class="mb-2 flex items-center gap-2 text-sm font-semibold">
						<GitCompareArrows class="size-4 text-tokyo-purple" /> Key-only comparison
					</h3>
					<div class="grid gap-1 text-sm sm:grid-cols-2">
						<p>Added: {comparison.added.join(', ') || 'None'}</p>
						<p>Removed: {comparison.removed.join(', ') || 'None'}</p>
						<p>Changed: {comparison.changed.join(', ') || 'None'}</p>
						<p>Unchanged: {comparison.unchanged.join(', ') || 'None'}</p>
					</div>
					<p class="mt-2 text-xs text-muted-foreground">Secret values are never rendered in comparison output.</p>
				</section>
			{/if}

			{#if pendingRestore}
				<section class="rounded-md border border-tokyo-orange/50 bg-tokyo-orange/10 p-4" aria-label="Restore confirmation">
					<h3 bind:this={confirmationHeading} tabindex="-1" class="text-sm font-semibold text-tokyo-orange">Confirm history restore</h3>
					{#if pendingRestore.tombstone}
						<p class="mt-2 text-sm">This will publish a newer logical tombstone. Historical relay ciphertext is not erased.</p>
					{:else}
						<p class="mt-2 text-sm">This will replace the complete current bundle with the selected historical bundle. Keys are not merged.</p>
					{/if}
					<p class="mt-1 text-xs text-muted-foreground">Redshift refreshes authenticated current state before publishing, but Nostr does not provide compare-and-swap.</p>
					{#if historyState.restoreError && !showOverwrite}
						<p role="alert" class="mt-2 text-sm text-tokyo-red">{historyState.restoreError}</p>
					{/if}
					{#if showOverwrite}
						<div bind:this={conflictAlert} role="alert" tabindex="-1" class="mt-3 rounded border border-tokyo-red/40 bg-tokyo-red/10 p-3 text-sm">
							A newer current version was observed. Review history before explicitly overwriting it.
						</div>
					{/if}
					<div class="mt-4 flex flex-wrap justify-end gap-2">
						<Button variant="ghost" class="transition-colors" onclick={cancelRestore}>Cancel</Button>
						{#if showOverwrite}
							<Button variant="destructive" class="transition-colors" disabled={historyState.isRestoring} onclick={() => confirmRestore(true)}>
								Overwrite newer current
							</Button>
						{:else}
							<Button class="transition-colors" disabled={historyState.isRestoring} onclick={() => confirmRestore(false)}>
								{historyState.isRestoring ? 'Restoring…' : 'Confirm restore'}
							</Button>
						{/if}
					</div>
				</section>
			{/if}
		{/if}
	</DialogContent>
</Dialog>
