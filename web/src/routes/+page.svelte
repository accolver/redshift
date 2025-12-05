<script lang="ts">
import { onMount } from 'svelte';
import { Button } from '$lib/components/ui/button';
import { Shield, Terminal, Globe, Key, Zap, Lock, ArrowRight, Copy, Check } from '@lucide/svelte';

let scrollY = $state(0);
let copied = $state(false);
let mounted = $state(false);

onMount(() => {
	mounted = true;
});

function handleScroll() {
	scrollY = window.scrollY;
}

async function copyInstallCommand() {
	await navigator.clipboard.writeText('curl -fsSL https://redshift.dev/install | sh');
	copied = true;
	setTimeout(() => (copied = false), 2000);
}

// Parallax calculations - only for background elements, not the hero content
const gridOffset = $derived(scrollY * 0.05);
const orbOffset1 = $derived(scrollY * 0.1);
const orbOffset2 = $derived(scrollY * 0.08);
</script>

<svelte:window onscroll={handleScroll} />

<svelte:head>
	<title>Redshift - Decentralized Secret Management</title>
	<meta
		name="description"
		content="Sovereign, censorship-resistant secret management using Nostr protocol. Own your secrets."
	/>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-background">
	<!-- Animated background grid -->
	<div
		class="pointer-events-none fixed inset-0 bg-grid opacity-40"
		style="transform: translateY({gridOffset}px)"
	></div>

	<!-- Gradient orbs - these stay visible throughout -->
	<div class="pointer-events-none fixed inset-0 overflow-hidden" style="z-index: 1;">
		<div
			class="absolute -left-32 -top-32 size-96 rounded-full bg-tokyo-blue/20 blur-[128px]"
			style="transform: translateY({orbOffset1}px)"
		></div>
		<div
			class="absolute -right-32 top-1/3 size-96 rounded-full bg-tokyo-purple/20 blur-[128px]"
			style="transform: translateY({orbOffset2}px)"
		></div>
		<div
			class="absolute -bottom-32 left-1/3 size-96 rounded-full bg-tokyo-cyan/10 blur-[128px]"
		></div>
	</div>

	<!-- Navigation -->
	<nav class="glass fixed left-0 right-0 top-0 z-50 border-b border-border/50">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
			<a href="/" class="flex items-center gap-2">
				<div
					class="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-tokyo-blue to-tokyo-purple"
				>
					<Key class="size-4 text-white" />
				</div>
				<span class="text-lg font-semibold">Redshift</span>
			</a>
			<div class="hidden items-center gap-8 md:flex">
				<a href="/docs" class="text-sm text-foreground/70 transition-colors hover:text-foreground"
					>Docs</a
				>
				<a
					href="/tutorial"
					class="text-sm text-foreground/70 transition-colors hover:text-foreground">Tutorial</a
				>
				<a
					href="https://github.com/redshift-secrets/redshift"
					class="text-sm text-foreground/70 transition-colors hover:text-foreground"
					target="_blank">GitHub</a
				>
			</div>
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="sm" href="/admin">Sign in</Button>
				<Button size="sm" href="/admin" class="bg-tokyo-blue hover:bg-tokyo-blue/90">
					Get Started
				</Button>
			</div>
		</div>
	</nav>

	<!-- Hero Section -->
	<section
		class="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-16 pb-32"
	>
		<div
			class="relative z-10 mx-auto max-w-4xl text-center"
			class:opacity-0={!mounted}
			class:translate-y-4={!mounted}
			class:opacity-100={mounted}
			class:translate-y-0={mounted}
			style="transition: opacity 0.8s ease, transform 0.8s ease"
		>
			<!-- Badge -->
			<div class="mb-12 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-sm backdrop-blur-sm">
				<span class="flex size-2 animate-pulse rounded-full bg-tokyo-green"></span>
				<span class="text-foreground/70">Now available in beta</span>
			</div>

			<h1
				class="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
			>
				<span class="gradient-text">Own your secrets.</span>
				<br />
				<span class="text-foreground">No compromises.</span>
			</h1>

			<p class="mx-auto mb-10 max-w-2xl text-lg text-foreground/70 sm:text-xl">
				Redshift is a decentralized secret manager built on Nostr. Client-side encryption, no
				vendor lock-in, censorship-resistant by design.
			</p>

			<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
				<Button
					size="lg"
					href="/admin"
					class="group h-12 gap-2 bg-gradient-to-r from-tokyo-blue to-tokyo-purple px-8 text-white hover:opacity-90"
				>
					Start Building
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</Button>
				<Button
					variant="outline"
					size="lg"
					href="/docs"
					class="h-12 border-border/50 bg-card/50 px-8 backdrop-blur-sm hover:bg-card"
				>
					Read the Docs
				</Button>
			</div>
		</div>

		<!-- Terminal Preview -->
		<div
			class="relative z-10 mx-auto mt-20 w-full max-w-3xl"
			class:opacity-0={!mounted}
			class:translate-y-8={!mounted}
			class:opacity-100={mounted}
			class:translate-y-0={mounted}
			style="transition: opacity 1s ease 0.3s, transform 1s ease 0.3s"
		>
			<div class="rounded-xl border border-border/50 bg-card/80 shadow-2xl backdrop-blur-sm">
				<!-- Terminal header -->
				<div class="flex items-center gap-2 border-b border-border/50 px-4 py-3">
					<div class="flex gap-1.5">
						<div class="size-3 rounded-full bg-tokyo-red/80"></div>
						<div class="size-3 rounded-full bg-tokyo-orange/80"></div>
						<div class="size-3 rounded-full bg-tokyo-green/80"></div>
					</div>
					<span class="ml-2 text-xs text-muted-foreground">terminal</span>
				</div>
				<!-- Terminal content -->
				<div class="p-6 font-mono text-sm">
					<div class="space-y-3">
						<div>
							<span class="text-tokyo-green">$</span>
							<span class="text-muted-foreground"> redshift login</span>
						</div>
						<div class="text-muted-foreground/70">
							<span class="text-tokyo-cyan">?</span> Select authentication method
						</div>
						<div class="pl-4 text-tokyo-blue">
							<span class="text-tokyo-green">></span> NIP-07 Browser Extension (recommended)
						</div>
						<div class="pl-4 text-muted-foreground/50">Enter nsec manually</div>
						<div class="pl-4 text-muted-foreground/50">Use bunker URL</div>
						<div class="mt-4">
							<span class="text-tokyo-green">✓</span>
							<span class="text-foreground"> Connected as npub1abc...xyz</span>
						</div>
						<div class="mt-4">
							<span class="text-tokyo-green">$</span>
							<span class="text-muted-foreground"> redshift run -- npm start</span>
						</div>
						<div class="text-muted-foreground/70">
							<span class="text-tokyo-cyan">info</span> Fetching secrets for
							<span class="text-tokyo-purple">my-app/production</span>...
						</div>
						<div>
							<span class="text-tokyo-green">✓</span>
							<span class="text-foreground"> Injected 12 secrets</span>
						</div>
						<div class="text-tokyo-blue">
							> Server running at http://localhost:3000<span class="animate-pulse">_</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Scroll indicator -->
		<div class="absolute bottom-8 left-1/2 -translate-x-1/2">
			<div class="flex animate-bounce flex-col items-center gap-2 text-muted-foreground/50">
				<span class="text-xs">Scroll to explore</span>
				<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
				</svg>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="relative z-20 pt-48 pb-32 px-6">
		<!-- Diagonal slant top with gradient fade -->
		<div 
			class="absolute inset-x-0 -top-16 h-48" 
			style="background: linear-gradient(to bottom, transparent 0%, var(--background) 70%); clip-path: polygon(0 40%, 100% 0%, 100% 100%, 0% 100%);"
		></div>
		<div class="absolute inset-x-0 top-32 bottom-0 bg-background"></div>
		<div class="relative mx-auto max-w-6xl">
			<div class="mb-16 text-center">
				<h2 class="mb-4 text-3xl font-bold sm:text-4xl">
					Built for developers who
					<span class="gradient-text">value sovereignty</span>
				</h2>
				<p class="mx-auto max-w-2xl text-foreground/60">
					Redshift combines the ease of traditional secret managers with the security and freedom of
					decentralized infrastructure.
				</p>
			</div>

			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<!-- Feature 1 -->
				<div
					class="group relative rounded-xl border border-border/50 bg-card/80 p-6 transition-all duration-300 hover:border-tokyo-blue/50 hover:bg-card"
				>
					<div
						class="mb-4 flex size-12 items-center justify-center rounded-lg bg-tokyo-blue/10 text-tokyo-blue transition-colors group-hover:bg-tokyo-blue/20"
					>
						<Shield class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Client-Side Encryption</h3>
					<p class="text-sm text-foreground/60">
						Your secrets never leave your device unencrypted. We use NIP-59 Gift Wrap for
						state-of-the-art encryption.
					</p>
				</div>

				<!-- Feature 2 -->
				<div
					class="group relative rounded-xl border border-border/50 bg-card/80 p-6 transition-all duration-300 hover:border-tokyo-purple/50 hover:bg-card"
				>
					<div
						class="mb-4 flex size-12 items-center justify-center rounded-lg bg-tokyo-purple/10 text-tokyo-purple transition-colors group-hover:bg-tokyo-purple/20"
					>
						<Terminal class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Doppler Compatible CLI</h3>
					<p class="text-sm text-foreground/60">
						Familiar commands like <code class="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/80">redshift run</code>.
						Drop-in replacement for your existing workflow.
					</p>
				</div>

				<!-- Feature 3 -->
				<div
					class="group relative rounded-xl border border-border/50 bg-card/80 p-6 transition-all duration-300 hover:border-tokyo-cyan/50 hover:bg-card"
				>
					<div
						class="mb-4 flex size-12 items-center justify-center rounded-lg bg-tokyo-cyan/10 text-tokyo-cyan transition-colors group-hover:bg-tokyo-cyan/20"
					>
						<Globe class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Censorship Resistant</h3>
					<p class="text-sm text-foreground/60">
						Built on Nostr protocol. Your secrets are distributed across relays - no single point of
						failure.
					</p>
				</div>

				<!-- Feature 4 -->
				<div
					class="group relative rounded-xl border border-border/50 bg-card/80 p-6 transition-all duration-300 hover:border-tokyo-green/50 hover:bg-card"
				>
					<div
						class="mb-4 flex size-12 items-center justify-center rounded-lg bg-tokyo-green/10 text-tokyo-green transition-colors group-hover:bg-tokyo-green/20"
					>
						<Key class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Your Keys, Your Data</h3>
					<p class="text-sm text-foreground/60">
						Use your existing Nostr identity. Export anytime. No vendor lock-in, no account
						required.
					</p>
				</div>

				<!-- Feature 5 -->
				<div
					class="group relative rounded-xl border border-border/50 bg-card/80 p-6 transition-all duration-300 hover:border-tokyo-orange/50 hover:bg-card"
				>
					<div
						class="mb-4 flex size-12 items-center justify-center rounded-lg bg-tokyo-orange/10 text-tokyo-orange transition-colors group-hover:bg-tokyo-orange/20"
					>
						<Zap class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Lightning Fast</h3>
					<p class="text-sm text-foreground/60">
						Single binary distribution. No runtime dependencies. Start managing secrets in under 30
						seconds.
					</p>
				</div>

				<!-- Feature 6 -->
				<div
					class="group relative rounded-xl border border-border/50 bg-card/80 p-6 transition-all duration-300 hover:border-tokyo-red/50 hover:bg-card"
				>
					<div
						class="mb-4 flex size-12 items-center justify-center rounded-lg bg-tokyo-red/10 text-tokyo-red transition-colors group-hover:bg-tokyo-red/20"
					>
						<Lock class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Free Forever</h3>
					<p class="text-sm text-foreground/60">
						Core functionality is completely free for individuals. Unlimited projects, unlimited
						secrets.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Code Example Section -->
	<section class="relative z-20 bg-background px-6 py-32">
		<div class="relative mx-auto max-w-6xl">
			<div class="grid items-center gap-12 lg:grid-cols-2">
				<div>
					<h2 class="mb-4 text-3xl font-bold sm:text-4xl">
						Get started in
						<span class="gradient-text">seconds</span>
					</h2>
					<p class="mb-8 text-foreground/60">
						Install the CLI, authenticate with your Nostr identity, and start managing secrets
						immediately. No sign-up required.
					</p>

					<div class="space-y-4">
						<div class="flex items-start gap-4">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-tokyo-blue/20 text-sm font-medium text-tokyo-blue"
							>
								1
							</div>
							<div>
								<p class="font-medium">Install the CLI</p>
								<p class="text-sm text-foreground/60">One command, all platforms supported.</p>
							</div>
						</div>
						<div class="flex items-start gap-4">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-tokyo-purple/20 text-sm font-medium text-tokyo-purple"
							>
								2
							</div>
							<div>
								<p class="font-medium">Authenticate</p>
								<p class="text-sm text-foreground/60">
									Use NIP-07 extension or enter your nsec directly.
								</p>
							</div>
						</div>
						<div class="flex items-start gap-4">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-tokyo-cyan/20 text-sm font-medium text-tokyo-cyan"
							>
								3
							</div>
							<div>
								<p class="font-medium">Manage secrets</p>
								<p class="text-sm text-foreground/60">
									Set, get, and inject secrets into your apps.
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Install command card -->
				<div>
					<div class="rounded-xl border border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
						<div class="flex items-center justify-between border-b border-border/50 px-4 py-3">
							<span class="text-sm text-muted-foreground">Quick install</span>
							<button
								onclick={copyInstallCommand}
								class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								{#if copied}
									<Check class="size-3.5 text-tokyo-green" />
									<span>Copied!</span>
								{:else}
									<Copy class="size-3.5" />
									<span>Copy</span>
								{/if}
							</button>
						</div>
						<div class="p-6">
							<code class="font-mono text-sm">
								<span class="text-tokyo-green">$</span>
								<span class="text-foreground"> curl -fsSL https://redshift.dev/install | sh</span>
							</code>
						</div>
					</div>

					<div class="mt-6 flex items-center justify-center gap-8 text-sm text-foreground/50">
						<span>macOS</span>
						<span>Linux</span>
						<span>Windows (WSL)</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="relative z-20 bg-background px-6 py-32">
		<div class="relative mx-auto max-w-4xl text-center">
			<h2 class="mb-4 text-3xl font-bold sm:text-4xl lg:text-5xl">
				Ready to own your secrets?
			</h2>
			<p class="mx-auto mb-10 max-w-2xl text-lg text-foreground/60">
				Join developers who trust Redshift for sovereign secret management. Free forever for
				individuals.
			</p>
			<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
				<Button
					size="lg"
					href="/admin"
					class="group h-14 gap-2 bg-gradient-to-r from-tokyo-blue to-tokyo-purple px-10 text-lg text-white hover:opacity-90"
				>
					Get Started Free
					<ArrowRight class="size-5 transition-transform group-hover:translate-x-1" />
				</Button>
				<Button
					variant="outline"
					size="lg"
					href="/tutorial"
					class="h-14 border-border/50 bg-card/50 px-10 text-lg backdrop-blur-sm hover:bg-card"
				>
					View Tutorial
				</Button>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-border/50 px-6 py-12">
		<div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
			<div class="flex items-center gap-2">
				<div
					class="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-tokyo-blue to-tokyo-purple"
				>
					<Key class="size-4 text-white" />
				</div>
				<span class="font-semibold">Redshift</span>
			</div>
			<div class="flex gap-8 text-sm text-foreground/60">
				<a href="/docs" class="transition-colors hover:text-foreground">Documentation</a>
				<a href="/tutorial" class="transition-colors hover:text-foreground">Tutorial</a>
				<a
					href="https://github.com/redshift-secrets/redshift"
					target="_blank"
					class="transition-colors hover:text-foreground">GitHub</a
				>
			</div>
			<p class="text-sm text-foreground/50">
				Built with Nostr. Open source.
			</p>
		</div>
	</footer>
</div>
