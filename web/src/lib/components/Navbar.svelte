<script lang="ts">
import { page } from '$app/stores';
import { Button } from '$lib/components/ui/button';

const navLinks = [
	{ href: '/docs', label: 'Docs' },
	{ href: '/pricing', label: 'Pricing' },
	{ href: 'https://github.com/accolver/redshift', label: 'GitHub', external: true },
];

function isActive(href: string) {
	return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
}
</script>

<nav class="glass fixed left-0 right-0 top-0 z-50 border-b border-border/50">
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
		<a href="/" class="flex items-center gap-2">
			<img src="/favicon.svg" alt="Redshift" class="size-8" />
			<span class="text-lg font-semibold">Redshift</span>
		</a>
		<div class="hidden items-center gap-8 md:flex">
			{#each navLinks as link}
				<a
					href={link.href}
					class="text-sm transition-colors hover:text-foreground {isActive(link.href) ? 'text-foreground' : 'text-foreground/70'}"
					target={link.external ? '_blank' : undefined}
					rel={link.external ? 'noopener noreferrer' : undefined}
				>
					{link.label}
				</a>
			{/each}
		</div>
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="sm" href="/admin">Sign in</Button>
			<Button size="sm" href="/admin" class="bg-tokyo-blue hover:bg-tokyo-blue/90">
				Get Started
			</Button>
		</div>
	</div>
</nav>
