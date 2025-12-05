<script lang="ts">
import { Button } from '$lib/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '$lib/components/ui/dialog';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { Key, Globe, TriangleAlert, Link, Eye, EyeOff, LoaderCircle } from '@lucide/svelte';
import {
	connectWithNip07,
	connectWithNsec,
	hasNip07Extension,
	getAuthState,
	clearError,
} from '$lib/stores/auth.svelte';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

type AuthMethod = 'select' | 'nsec' | 'bunker';

let authMethod = $state<AuthMethod>('select');
let nsecInput = $state('');
let bunkerInput = $state('');
let showNsec = $state(false);
let isConnecting = $state(false);
let hasExtension = $state(false);

const auth = $derived(getAuthState());

// Check for extension on mount
$effect(() => {
	if (open) {
		hasExtension = hasNip07Extension();
		authMethod = 'select';
		nsecInput = '';
		bunkerInput = '';
		showNsec = false;
		clearError();
	}
});

// Close dialog on successful connection
$effect(() => {
	if (auth.isConnected && open) {
		onOpenChange(false);
	}
});

async function handleNip07Connect() {
	isConnecting = true;
	await connectWithNip07();
	isConnecting = false;
}

async function handleNsecConnect() {
	if (!nsecInput.trim()) return;

	isConnecting = true;
	const success = await connectWithNsec(nsecInput.trim());
	isConnecting = false;

	if (success) {
		nsecInput = '';
	}
}

async function handleBunkerConnect() {
	// TODO: Implement bunker connection
	// For now, show not implemented message
	alert('Bunker connection coming soon. Use nsec or NIP-07 extension for now.');
}

function goBack() {
	authMethod = 'select';
	clearError();
}
</script>

<Dialog bind:open {onOpenChange}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Key class="size-5" />
				Connect to Redshift
			</DialogTitle>
			<DialogDescription>
				Choose how to authenticate with your Nostr identity.
			</DialogDescription>
		</DialogHeader>

		{#if authMethod === 'select'}
			<!-- Method Selection -->
			<div class="space-y-3 py-4">
				<!-- NIP-07 Extension -->
				<button
					type="button"
					class="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleNip07Connect}
					disabled={!hasExtension || isConnecting}
				>
					<div class="flex size-10 items-center justify-center rounded-lg bg-tokyo-blue/10 text-tokyo-blue">
						<Globe class="size-5" />
					</div>
					<div class="flex-1">
						<p class="font-medium">Browser Extension</p>
						<p class="text-sm text-muted-foreground">
							{#if hasExtension}
								Use Alby, nos2x, or other NIP-07 extension
							{:else}
								No extension detected
							{/if}
						</p>
					</div>
					{#if isConnecting}
						<LoaderCircle class="size-5 animate-spin text-muted-foreground" />
					{/if}
				</button>

				<!-- nsec -->
				<button
					type="button"
					class="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted"
					onclick={() => (authMethod = 'nsec')}
				>
					<div class="flex size-10 items-center justify-center rounded-lg bg-tokyo-orange/10 text-tokyo-orange">
						<Key class="size-5" />
					</div>
					<div class="flex-1">
						<p class="font-medium">Private Key (nsec)</p>
						<p class="text-sm text-muted-foreground">Enter your nsec directly</p>
					</div>
				</button>

				<!-- Bunker -->
				<button
					type="button"
					class="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted"
					onclick={() => (authMethod = 'bunker')}
				>
					<div class="flex size-10 items-center justify-center rounded-lg bg-tokyo-purple/10 text-tokyo-purple">
						<Link class="size-5" />
					</div>
					<div class="flex-1">
						<p class="font-medium">Bunker URL (NIP-46)</p>
						<p class="text-sm text-muted-foreground">Connect via remote signer</p>
					</div>
				</button>
			</div>

			{#if !hasExtension}
				<p class="text-xs text-muted-foreground">
					Tip: Install a NIP-07 extension like <a href="https://getalby.com" target="_blank" class="text-tokyo-blue hover:underline">Alby</a> or <a href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp" target="_blank" class="text-tokyo-blue hover:underline">nos2x</a> for the best experience.
				</p>
			{/if}

		{:else if authMethod === 'nsec'}
			<!-- nsec Input -->
			<div class="space-y-4 py-4">
				<!-- Warning -->
				<div class="flex gap-3 rounded-lg border border-tokyo-orange/50 bg-tokyo-orange/10 p-3">
					<TriangleAlert class="size-5 shrink-0 text-tokyo-orange" />
					<div class="text-sm">
						<p class="font-medium text-tokyo-orange">Security Warning</p>
						<p class="text-foreground/80">
							Your private key (nsec) gives full access to your Nostr identity and all your secrets. 
							Never share it with anyone. Only enter it on trusted devices.
						</p>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="nsec">Private Key</Label>
					<div class="relative">
						<Input
							id="nsec"
							type={showNsec ? 'text' : 'password'}
							placeholder="nsec1..."
							bind:value={nsecInput}
							class="pr-10 font-mono"
						/>
						<button
							type="button"
							class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
							onclick={() => (showNsec = !showNsec)}
						>
							{#if showNsec}
								<EyeOff class="size-4" />
							{:else}
								<Eye class="size-4" />
							{/if}
						</button>
					</div>
					<p class="text-xs text-muted-foreground">
						Starts with nsec1... or enter hex format
					</p>
				</div>

				{#if auth.error}
					<p class="text-sm text-destructive">{auth.error}</p>
				{/if}

				<div class="flex gap-2">
					<Button variant="outline" onclick={goBack} class="flex-1">
						Back
					</Button>
					<Button 
						onclick={handleNsecConnect} 
						disabled={!nsecInput.trim() || isConnecting}
						class="flex-1"
					>
						{#if isConnecting}
							<LoaderCircle class="mr-2 size-4 animate-spin" />
							Connecting...
						{:else}
							Connect
						{/if}
					</Button>
				</div>
			</div>

		{:else if authMethod === 'bunker'}
			<!-- Bunker Input -->
			<div class="space-y-4 py-4">
				<div class="space-y-2">
					<Label for="bunker">Bunker URL</Label>
					<Input
						id="bunker"
						type="text"
						placeholder="bunker://..."
						bind:value={bunkerInput}
						class="font-mono text-sm"
					/>
					<p class="text-xs text-muted-foreground">
						Connect to a remote signer like nsecBunker
					</p>
				</div>

				{#if auth.error}
					<p class="text-sm text-destructive">{auth.error}</p>
				{/if}

				<div class="flex gap-2">
					<Button variant="outline" onclick={goBack} class="flex-1">
						Back
					</Button>
					<Button 
						onclick={handleBunkerConnect} 
						disabled={!bunkerInput.trim() || isConnecting}
						class="flex-1"
					>
						{#if isConnecting}
							<LoaderCircle class="mr-2 size-4 animate-spin" />
							Connecting...
						{:else}
							Connect
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>
