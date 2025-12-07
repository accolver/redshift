<script lang="ts">
import { onMount, untrack } from 'svelte';
import { Button } from '$lib/components/ui/button';
import { ChevronDown, LogOut, Radio, Search, LoaderCircle } from '@lucide/svelte';
import {
	getAuthState,
	connectWithNip07,
	disconnect as authDisconnect,
	hasNip07Extension,
	restoreAuth,
} from '$lib/stores/auth.svelte';
import { getProjectsState, subscribeToProjects, unsubscribeFromProjects } from '$lib/stores/projects.svelte';
import {
	connectAndSync,
	disconnect as nostrDisconnect,
	getRelayState,
	DEFAULT_RELAYS,
} from '$lib/stores/nostr.svelte';
import { nip19 } from 'nostr-tools';
import GlobalSearch from '$lib/components/GlobalSearch.svelte';
import LoginDialog from '$lib/components/LoginDialog.svelte';

let dropdownOpen = $state(false);
let relayDropdownOpen = $state(false);
let searchOpen = $state(false);
let loginDialogOpen = $state(false);

let { children } = $props();
let hasExtension = $state(false);

// Track if we're still trying to restore auth (initial page load)
let isRestoringAuth = $state(true);

const auth = $derived(getAuthState());
const relayState = $derived(getRelayState());

// Detect platform for keyboard shortcut display
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

// Global keyboard shortcut for search
function handleGlobalKeydown(e: KeyboardEvent) {
	// Cmd+K (Mac) or Ctrl+K (Windows/Linux)
	if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
		e.preventDefault();
		if (auth.isConnected) {
			searchOpen = true;
		}
	}
}

// Get relay status color and label
const relayStatusInfo = $derived(() => {
	switch (relayState.status) {
		case 'connected':
			return { color: 'bg-green-500', label: 'Connected', textColor: 'text-green-500' };
		case 'connecting':
			return {
				color: 'bg-yellow-500 animate-pulse',
				label: 'Connecting',
				textColor: 'text-yellow-500',
			};
		case 'error':
			return { color: 'bg-red-500', label: 'Error', textColor: 'text-red-500' };
		default:
			return {
				color: 'bg-muted-foreground/40',
				label: 'Disconnected',
				textColor: 'text-muted-foreground',
			};
	}
});

// Track the pubkey we've connected with to avoid re-subscribing
let lastConnectedPubkey: string | null = null;

// Subscribe to projects when authenticated
// Only track auth.isConnected and auth.pubkey, not the comparison variable
$effect(() => {
	const isConnected = auth.isConnected;
	const pubkey = auth.pubkey;

	if (isConnected && pubkey) {
		// Read lastConnectedPubkey without tracking to avoid self-referential loop
		const lastPubkey = untrack(() => lastConnectedPubkey);
		if (lastPubkey !== pubkey) {
			lastConnectedPubkey = pubkey;
			// Connect to relays and start syncing
			connectAndSync(pubkey);
			// Subscribe to projects from EventStore
			subscribeToProjects();
		}
	} else {
		// Cleanup when disconnected
		const lastPubkey = untrack(() => lastConnectedPubkey);
		if (lastPubkey !== null) {
			lastConnectedPubkey = null;
			unsubscribeFromProjects();
			nostrDisconnect();
		}
	}
});

onMount(() => {
	hasExtension = hasNip07Extension();

	// Try to restore from session storage first (for nsec), then auto-connect with NIP-07
	restoreAuth().then(async (restored) => {
		// If not restored and NIP-07 extension is available, auto-connect
		if (!restored && hasExtension) {
			await connectWithNip07();
		}
		// Mark auth restoration as complete
		isRestoringAuth = false;
	});

	// Add global keyboard shortcut listener
	window.addEventListener('keydown', handleGlobalKeydown);

	// Cleanup on unmount
	return () => {
		window.removeEventListener('keydown', handleGlobalKeydown);
		unsubscribeFromProjects();
		nostrDisconnect();
	};
});

function formatPubkey(pubkey: string): string {
	try {
		const npub = nip19.npubEncode(pubkey);
		return `${npub.slice(0, 8)}...${npub.slice(-6)}`;
	} catch {
		return `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`;
	}
}

function getDisplayName(pubkey: string): string {
	const profile = auth.profile;
	if (profile?.display_name) return profile.display_name;
	if (profile?.name) return profile.name;
	return formatPubkey(pubkey);
}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Admin Header - full width with inner container -->
	<header class="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm">
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
			<!-- Left: Logo + Nav + Search -->
			<div class="flex min-w-0 items-center gap-2 sm:gap-8">
				<a href="/" class="flex shrink-0 items-center gap-2">
					<img src="/favicon.svg" alt="Redshift" class="size-7" />
					<span class="hidden text-lg font-semibold sm:inline">Redshift</span>
				</a>
				<nav class="hidden items-center gap-1 sm:flex">
					<a href="/admin" class="rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground">Dashboard</a>
				</nav>
				<!-- Search Button -->
				{#if auth.isConnected}
					<button
						type="button"
						class="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-2 sm:px-3"
						onclick={() => (searchOpen = true)}
					>
						<Search class="size-4" />
						<kbd class="hidden rounded border border-border bg-background px-1.5 py-0.5 text-xs sm:inline">{isMac ? '⌘' : 'Ctrl'}K</kbd>
					</button>
				{/if}
			</div>

			<!-- Right: User Avatar + Relay Status -->
			<div class="flex shrink-0 items-center gap-1 sm:gap-3">
				<!-- User Avatar -->
				{#if auth.isConnected}
					<div class="relative">
						<button
							type="button"
							class="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted sm:gap-2 sm:px-2"
							onclick={() => (dropdownOpen = !dropdownOpen)}
							onblur={() => setTimeout(() => (dropdownOpen = false), 150)}
						>
							<span class="hidden text-sm sm:inline">{getDisplayName(auth.pubkey!)}</span>
							{#if auth.profile?.picture}
								<img
									src={auth.profile.picture}
									alt="Profile"
									class="size-7 rounded-full object-cover"
								/>
							{:else}
								<div class="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
									{(auth.profile?.name ?? auth.pubkey)?.[0]?.toUpperCase() ?? '?'}
								</div>
							{/if}
							<ChevronDown class="hidden size-4 text-muted-foreground sm:block" />
						</button>
						{#if dropdownOpen}
							<div class="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-md border border-border bg-card p-1 shadow-lg">
								<button
									type="button"
									class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
									onclick={() => {
										dropdownOpen = false;
										authDisconnect();
									}}
								>
									<LogOut class="size-4" />
									Disconnect
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<Button size="sm" onclick={() => (loginDialogOpen = true)}>
						Connect
					</Button>
				{/if}

				<!-- Relay Status Indicator -->
				{#if auth.isConnected}
					<div class="relative">
						<button
							type="button"
							class="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-2 sm:px-2"
							onclick={() => (relayDropdownOpen = !relayDropdownOpen)}
							onblur={() => setTimeout(() => (relayDropdownOpen = false), 150)}
							title="Relay status"
						>
							<Radio class="size-4" />
							<span class="flex size-2 rounded-full {relayStatusInfo().color}"></span>
						</button>
						{#if relayDropdownOpen}
							<div class="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-card p-3 shadow-lg">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-medium">Relay Status</span>
									<span class="text-xs {relayStatusInfo().textColor}">{relayStatusInfo().label}</span>
								</div>
								<div class="space-y-1.5">
									{#each DEFAULT_RELAYS as relay}
										<div class="flex items-center gap-2 text-xs">
											<span class="flex size-1.5 rounded-full {relayState.status === 'connected' ? 'bg-green-500' : 'bg-muted-foreground/40'}"></span>
											<span class="truncate text-muted-foreground">{relay.replace('wss://', '')}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</header>

	<!-- Admin Content - same max-width as header -->
	<main class="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-8">
		{@render children()}
	</main>
</div>

<!-- Global Search Dialog -->
<GlobalSearch bind:open={searchOpen} onOpenChange={(v) => (searchOpen = v)} />

<!-- Login Dialog -->
<LoginDialog bind:open={loginDialogOpen} onOpenChange={(v) => (loginDialogOpen = v)} />
