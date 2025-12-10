<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
import { Badge } from '$lib/components/ui/badge';
import { Switch } from '$lib/components/ui/switch';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import {
	Radio,
	Plus,
	Trash2,
	Cloud,
	Globe,
	RotateCcw,
	CheckCircle2,
	AlertCircle,
	Crown,
	Activity,
	ChevronRight,
} from '@lucide/svelte';
import {
	getRelaySettingsState,
	getEffectiveRelays,
	isCloudRelayAvailable,
	isUsingCloudRelay,
	addCustomRelay,
	removeCustomRelay,
	setUseCloudRelay,
	setUseDefaultRelays,
	resetRelaySettings,
	clearRelaySettingsError,
	isValidRelayUrl,
	REDSHIFT_CLOUD_RELAY,
} from '$lib/stores/relay-settings.svelte';
import { DEFAULT_RELAYS } from '$lib/stores/nostr.svelte';
import { getSubscriptionState, hasActiveSubscription } from '$lib/stores/subscription.svelte';
import { getAuthState } from '$lib/stores/auth.svelte';

let newRelayUrl = $state('');
let addRelayError = $state<string | null>(null);

const auth = $derived(getAuthState());
const relaySettings = $derived(getRelaySettingsState());
const subscription = $derived(getSubscriptionState());
const effectiveRelays = $derived(getEffectiveRelays());
const cloudAvailable = $derived(isCloudRelayAvailable());
const usingCloud = $derived(isUsingCloudRelay());

function handleAddRelay() {
	addRelayError = null;

	if (!newRelayUrl.trim()) {
		addRelayError = 'Please enter a relay URL';
		return;
	}

	if (!isValidRelayUrl(newRelayUrl)) {
		addRelayError = 'Invalid relay URL format';
		return;
	}

	const success = addCustomRelay(newRelayUrl);
	if (success) {
		newRelayUrl = '';
	} else {
		addRelayError = relaySettings.error || 'Failed to add relay';
		clearRelaySettingsError();
	}
}

function handleRemoveRelay(url: string) {
	removeCustomRelay(url);
}

function handleToggleCloudRelay(checked: boolean) {
	setUseCloudRelay(checked);
}

function handleToggleDefaultRelays(checked: boolean) {
	setUseDefaultRelays(checked);
}

function handleReset() {
	resetRelaySettings();
	newRelayUrl = '';
	addRelayError = null;
}
</script>

<svelte:head>
	<title>Settings - Redshift</title>
	<meta name="description" content="Configure Redshift relay settings and preferences." />
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold">Settings</h1>
		<p class="text-muted-foreground">Configure your Redshift relay connections and preferences.</p>
	</div>

	{#if !auth.isConnected}
		<Card>
			<CardContent class="py-8 text-center">
				<p class="text-muted-foreground">Please connect your Nostr identity to manage settings.</p>
			</CardContent>
		</Card>
	{:else}
		<!-- Redshift Cloud Relay Section -->
		<Card class="border-tokyo-blue/30">
			<CardHeader>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Cloud class="size-5 text-tokyo-blue" />
						<CardTitle>Redshift Cloud Relay</CardTitle>
					</div>
					{#if cloudAvailable}
						<Badge class="bg-tokyo-green/10 text-tokyo-green">
							<CheckCircle2 class="mr-1 size-3" />
							Available
						</Badge>
					{:else}
						<Badge variant="secondary">
							<Crown class="mr-1 size-3" />
							Cloud Subscription Required
						</Badge>
					{/if}
				</div>
				<CardDescription>
					{#if cloudAvailable}
						Your Cloud subscription includes access to the managed Redshift relay with automatic backups and 99.5% SLA.
					{:else}
						Upgrade to Cloud ($5/month) for access to the managed relay with automatic backups, audit logs, and 99.5% uptime SLA.
					{/if}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<div class="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4">
						<div class="flex items-center gap-3">
							<div class="flex size-10 items-center justify-center rounded-full bg-tokyo-blue/10">
								<Cloud class="size-5 text-tokyo-blue" />
							</div>
							<div>
								<p class="font-medium">{REDSHIFT_CLOUD_RELAY.replace('wss://', '')}</p>
								<p class="text-sm text-muted-foreground">
									{#if cloudAvailable}
										Managed relay with backups & SLA
									{:else}
										Requires Cloud subscription
									{/if}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-3">
							{#if usingCloud}
								<Badge variant="outline" class="border-tokyo-green/50 text-tokyo-green">Active</Badge>
							{/if}
							<Switch
								checked={relaySettings.config.useCloudRelay}
								onCheckedChange={handleToggleCloudRelay}
								disabled={!cloudAvailable}
							/>
						</div>
					</div>

					{#if !cloudAvailable}
						<Button href="/admin/subscribe" variant="outline" class="w-full border-tokyo-blue/50 text-tokyo-blue transition-colors hover:bg-tokyo-blue/10">
							<Crown class="mr-2 size-4" />
							Upgrade to Cloud
						</Button>
					{/if}
				</div>
			</CardContent>
		</Card>

		<!-- Custom Relays Section -->
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<Radio class="size-5" />
					<CardTitle>Custom Relays</CardTitle>
				</div>
				<CardDescription>
					Add your own Nostr relays for storing encrypted secrets.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<!-- Add new relay form -->
					<div class="flex gap-2">
						<div class="flex-1">
							<Label for="new-relay" class="sr-only">New Relay URL</Label>
							<Input
								id="new-relay"
								type="text"
								placeholder="wss://relay.example.com"
								bind:value={newRelayUrl}
								onkeydown={(e) => e.key === 'Enter' && handleAddRelay()}
								class={addRelayError ? 'border-destructive' : ''}
							/>
							{#if addRelayError}
								<p class="mt-1 text-sm text-destructive">{addRelayError}</p>
							{/if}
						</div>
						<Button onclick={handleAddRelay}>
							<Plus class="mr-2 size-4" />
							Add
						</Button>
					</div>

					<!-- Custom relay list -->
					{#if relaySettings.config.customRelays.length > 0}
						<div class="space-y-2">
							{#each relaySettings.config.customRelays as relay}
								<div class="flex items-center justify-between rounded-lg border border-border/50 bg-background p-3">
									<div class="flex items-center gap-3">
										<Radio class="size-4 text-muted-foreground" />
										<span class="text-sm">{relay.replace('wss://', '')}</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onclick={() => handleRemoveRelay(relay)}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="py-4 text-center text-sm text-muted-foreground">
							No custom relays added. Default public relays will be used.
						</p>
					{/if}
				</div>
			</CardContent>
		</Card>

		<!-- Default Relays Section -->
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Globe class="size-5" />
						<CardTitle>Default Public Relays</CardTitle>
					</div>
					<Switch
						checked={relaySettings.config.useDefaultRelays}
						onCheckedChange={handleToggleDefaultRelays}
					/>
				</div>
				<CardDescription>
					Include popular public relays as fallback for redundancy.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-2">
					{#each DEFAULT_RELAYS as relay}
						<div class="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 {!relaySettings.config.useDefaultRelays ? 'opacity-50' : ''}">
							<Radio class="size-4 text-muted-foreground" />
							<span class="text-sm text-muted-foreground">{relay.replace('wss://', '')}</span>
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>

		<!-- Effective Relays Summary -->
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<CheckCircle2 class="size-5 text-tokyo-green" />
					<CardTitle>Active Configuration</CardTitle>
				</div>
				<CardDescription>
					These relays will be used for storing and retrieving your encrypted secrets.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-2">
					{#each effectiveRelays as relay, i}
						<div class="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3">
							<span class="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
								{i + 1}
							</span>
							<span class="text-sm">{relay.replace('wss://', '')}</span>
							{#if relay === REDSHIFT_CLOUD_RELAY || relay === (subscription.status?.relayUrl)}
								<Badge variant="outline" class="ml-auto border-tokyo-blue/50 text-tokyo-blue">Cloud</Badge>
							{:else if DEFAULT_RELAYS.includes(relay)}
								<Badge variant="outline" class="ml-auto">Public</Badge>
							{:else}
								<Badge variant="outline" class="ml-auto border-tokyo-purple/50 text-tokyo-purple">Custom</Badge>
							{/if}
						</div>
					{/each}
				</div>

				{#if effectiveRelays.length === 0}
					<div class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
						<AlertCircle class="size-5 text-destructive" />
						<p class="text-sm text-destructive">No relays configured. Please enable default relays or add custom relays.</p>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Audit Logs Section -->
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<Activity class="size-5" />
					<CardTitle>Audit Logs</CardTitle>
				</div>
				<CardDescription>
					View a history of all actions performed on your secrets.
					{#if !cloudAvailable}
						Requires Cloud subscription.
					{/if}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<a
					href="/admin/settings/audit-logs"
					class="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
				>
					<div class="flex items-center gap-3">
						<Activity class="size-5 text-muted-foreground" />
						<div>
							<p class="font-medium">View Audit Logs</p>
							<p class="text-sm text-muted-foreground">
								{#if cloudAvailable}
									Track secret creation, updates, and deletions
								{:else}
									90-day retention for Cloud subscribers
								{/if}
							</p>
						</div>
					</div>
					<ChevronRight class="size-5 text-muted-foreground" />
				</a>
			</CardContent>
		</Card>

		<!-- Reset Button -->
		<div class="flex justify-end">
			<Button variant="outline" onclick={handleReset}>
				<RotateCcw class="mr-2 size-4" />
				Reset to Defaults
			</Button>
		</div>
	{/if}
</div>
