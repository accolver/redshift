<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Card, CardContent } from '$lib/components/ui/card';
import { LoaderCircle } from '@lucide/svelte';

interface Props {
	error: string | null;
	isLoading: boolean;
	onRetry: () => void;
}

let { error, isLoading, onRetry }: Props = $props();
</script>

{#if error}
	<Card class="border-destructive/50">
		<CardContent
			class="flex flex-col items-center justify-center gap-4 py-12 text-center"
			role="alert"
		>
			<p class="text-sm text-destructive">{error}</p>
			<Button variant="outline" size="sm" onclick={onRetry}>Retry loading projects</Button>
		</CardContent>
	</Card>
{:else if isLoading}
	<Card class="border-dashed">
		<CardContent
			class="flex flex-col items-center justify-center py-12 text-center"
			role="status"
		>
			<LoaderCircle class="mb-4 size-8 animate-spin text-muted-foreground" />
			<p class="text-sm text-muted-foreground">Loading projects from relays...</p>
		</CardContent>
	</Card>
{/if}
