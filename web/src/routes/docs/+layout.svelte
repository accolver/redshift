<script lang="ts">
import { page } from '$app/stores';
import {
	Book,
	Key,
	Terminal,
	Shield,
	Globe,
	Zap,
	HelpCircle,
	ChevronRight,
	Home,
	Menu,
} from '@lucide/svelte';
import * as Sheet from '$lib/components/ui/sheet';
import { Button } from '$lib/components/ui/button';
import { docsStore } from '$lib/stores/docs.svelte';

let { children } = $props();

let mobileNavOpen = $state(false);

// Navigation structure
const navSections = [
	{
		title: 'Getting Started',
		items: [
			{ href: '/docs', label: 'Introduction', icon: Book },
			{ href: '/docs/installation', label: 'Installation', icon: Terminal },
			{ href: '/docs/quickstart', label: 'Quick Start', icon: Zap },
		],
	},
	{
		title: 'Concepts',
		items: [
			{ href: '/docs/what-is-nostr', label: 'What is Nostr?', icon: Globe },
			{ href: '/docs/why-redshift', label: 'Why Redshift?', icon: HelpCircle },
		],
	},
	{
		title: 'Authentication',
		items: [
			{ href: '/docs/auth', label: 'Overview', icon: Key },
			{ href: '/docs/auth/extension', label: 'Browser Extension', icon: Globe },
			{ href: '/docs/auth/nsec', label: 'Private Key (nsec)', icon: Key },
			{ href: '/docs/auth/bunker', label: 'Bunker (NIP-46)', icon: Shield },
		],
	},
	{
		title: 'Reference',
		items: [
			{ href: '/docs/cli', label: 'CLI Commands', icon: Terminal },
			{ href: '/docs/web-admin', label: 'Web Admin', icon: Globe },
			{ href: '/docs/security', label: 'Security Model', icon: Shield },
		],
	},
];

const currentPath = $derived($page.url.pathname);

function isActive(href: string): boolean {
	if (href === '/docs') {
		return currentPath === '/docs';
	}
	return currentPath.startsWith(href);
}
</script>

<div class="flex min-h-screen">
	<!-- Sidebar -->
	<aside class="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-border bg-card/50 lg:block">
		<div class="p-6">
			<a href="/" class="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
				<Home class="size-4" />
				Home
			</a>
			<a href="/docs" class="flex items-center gap-2 text-lg font-semibold">
				<Book class="size-5 text-tokyo-blue" />
				Documentation
			</a>
		</div>
		<nav class="px-4 pb-8">
			{#each navSections as section}
				<div class="mb-6">
					<h3 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{section.title}
					</h3>
					<ul class="space-y-1">
						{#each section.items as item}
							<li>
								<a
									href={item.href}
									class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors {isActive(item.href)
										? 'bg-tokyo-blue/10 text-tokyo-blue font-medium'
										: 'text-foreground/70 hover:bg-muted hover:text-foreground'}"
								>
									<item.icon class="size-4" />
									{item.label}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
	</aside>

	<!-- Mobile nav header -->
	<div class="flex flex-1 flex-col">
		<header class="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
			<Sheet.Root bind:open={mobileNavOpen}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="icon" {...props}>
							<Menu class="size-5" />
							<span class="sr-only">Toggle navigation</span>
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Content side="left" class="w-72 overflow-y-auto">
					<Sheet.Header>
						<Sheet.Title>
							<a href="/docs" class="flex items-center gap-2" onclick={() => mobileNavOpen = false}>
								<Book class="size-5 text-tokyo-blue" />
								Documentation
							</a>
						</Sheet.Title>
					</Sheet.Header>
					<nav class="mt-4 px-4">
						<a
							href="/"
							class="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
							onclick={() => mobileNavOpen = false}
						>
							<Home class="size-4" />
							Home
						</a>
						{#each navSections as section}
							<div class="mb-6">
								<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									{section.title}
								</h3>
								<ul class="space-y-1">
									{#each section.items as item}
										<li>
											<a
												href={item.href}
												onclick={() => mobileNavOpen = false}
												class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors {isActive(item.href)
													? 'bg-tokyo-blue/10 text-tokyo-blue font-medium'
													: 'text-foreground/70 hover:bg-muted hover:text-foreground'}"
											>
												<item.icon class="size-4" />
												{item.label}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</nav>
				</Sheet.Content>
			</Sheet.Root>
			<a href="/docs" class="flex items-center gap-2 font-semibold">
				<Book class="size-5 text-tokyo-blue" />
				Docs
			</a>
			<!-- Floating title that appears when main title scrolls out of view -->
			{#if docsStore.currentTitle}
				<span
					class="floating-title -ml-1 truncate text-sm font-medium text-muted-foreground"
					class:visible={!docsStore.titleVisible}
				>
					{docsStore.currentTitle}
				</span>
			{/if}
		</header>

		<!-- Main content -->
		<main class="flex-1 overflow-x-hidden">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.floating-title {
		opacity: 0;
		transform: translateX(-1rem);
		transition: opacity 200ms ease, transform 200ms ease;
		pointer-events: none;
	}

	.floating-title.visible {
		opacity: 1;
		transform: translateX(0);
		pointer-events: auto;
	}
</style>
