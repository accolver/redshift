<script lang="ts">
import { onMount } from 'svelte';
import { Button } from '$lib/components/ui/button';
import { Key, ChevronDown, LogOut } from '@lucide/svelte';
import {
	getAuthState,
	connectWithNip07,
	disconnect as authDisconnect,
	hasNip07Extension,
	restoreAuth,
} from '$lib/stores/auth.svelte';
import { subscribeToProjects, unsubscribeFromProjects } from '$lib/stores/projects.svelte';
import { connectAndSync, disconnect as nostrDisconnect } from '$lib/stores/nostr.svelte';
import { nip19 } from 'nostr-tools';

let dropdownOpen = $state(false);

let { children } = $props();
let isConnecting = $state(false);
let hasExtension = $state(false);

const auth = $derived(getAuthState());

// Subscribe to projects when authenticated
$effect(() => {
	if (auth.isConnected && auth.pubkey) {
		// Connect to relays and start syncing
		connectAndSync(auth.pubkey);
		// Subscribe to projects from EventStore
		subscribeToProjects();
	} else {
		// Cleanup when disconnected
		unsubscribeFromProjects();
		nostrDisconnect();
	}
});

onMount(() => {
	hasExtension = hasNip07Extension();

	// Try to restore from session storage first (for nsec), then auto-connect with NIP-07
	restoreAuth().then(async (restored) => {
		// If not restored and NIP-07 extension is available, auto-connect
		if (!restored && hasExtension) {
			isConnecting = true;
			await connectWithNip07();
			isConnecting = false;
		}
	});

	// Cleanup on unmount
	return () => {
		unsubscribeFromProjects();
		nostrDisconnect();
	};
});

async function handleConnect() {
	isConnecting = true;
	await connectWithNip07();
	isConnecting = false;
}

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
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
			<div class="flex items-center gap-8">
				<a href="/" class="flex items-center gap-2">
					<div class="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-tokyo-blue to-tokyo-purple">
						<Key class="size-3.5 text-white" />
					</div>
					<span class="text-lg font-semibold">Redshift</span>
				</a>
				<nav class="flex items-center gap-1">
					<a href="/admin" class="rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground">Dashboard</a>
					<a href="/admin/secrets" class="rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground">Secrets</a>
				</nav>
			</div>
			<div class="flex items-center gap-3">
				{#if auth.isConnected}
					<div class="relative">
						<button
							type="button"
							class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
							onclick={() => (dropdownOpen = !dropdownOpen)}
							onblur={() => setTimeout(() => (dropdownOpen = false), 150)}
						>
							<span class="text-sm">{getDisplayName(auth.pubkey!)}</span>
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
							<ChevronDown class="size-4 text-muted-foreground" />
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
					<Button size="sm" onclick={handleConnect} disabled={isConnecting || !hasExtension}>
						{isConnecting ? 'Connecting...' : 'Connect'}
					</Button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Admin Content - same max-width as header -->
	<main class="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
		{@render children()}
	</main>
</div>
