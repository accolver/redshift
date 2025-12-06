<script lang="ts">
import { page } from '$app/stores';
import { Book, Key, Terminal, Shield, Globe, Zap, HelpCircle, ChevronRight } from '@lucide/svelte';

let { children } = $props();

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

	<!-- Mobile nav toggle would go here -->

	<!-- Main content -->
	<main class="flex-1">
		{@render children()}
	</main>
</div>
