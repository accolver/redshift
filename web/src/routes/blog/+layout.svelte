<script lang="ts">
import Navbar from '$lib/components/Navbar.svelte';

let { children } = $props();
</script>

<Navbar />

<div class="min-h-screen bg-background">
	{@render children()}
</div>

<!-- Footer -->
<footer class="border-t border-border/50 bg-background px-6 py-12">
	<div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
		<div class="flex items-center gap-2">
			<img src="/favicon.svg" alt="Redshift" class="size-8" />
			<span class="font-semibold">Redshift</span>
		</div>
		<div class="flex gap-8 text-sm text-foreground/60">
			<a href="/docs" class="transition-colors hover:text-foreground">Documentation</a>
			<a href="/pricing" class="transition-colors hover:text-foreground">Pricing</a>
			<a href="/blog" class="transition-colors hover:text-foreground">Blog</a>
			<a
				href="https://github.com/accolver/redshift"
				target="_blank"
				class="transition-colors hover:text-foreground">GitHub</a
			>
		</div>
		<p class="text-sm text-foreground/50">Built with Nostr. Open source.</p>
	</div>
</footer>
