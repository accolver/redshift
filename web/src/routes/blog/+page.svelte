<script lang="ts">
import { getAllPosts, getAllTags } from '$lib/blog/posts';
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import { Calendar, Clock, ArrowRight, Rss, X } from '@lucide/svelte';

const allPosts = getAllPosts();
const tags = getAllTags();

let selectedTag = $state<string | null>(null);

const filteredPosts = $derived.by(() => {
	if (selectedTag === null) return allPosts;
	const tag = selectedTag;
	return allPosts.filter((post) => post.tags.includes(tag));
});

function selectTag(tag: string) {
	selectedTag = selectedTag === tag ? null : tag;
}

function clearFilter() {
	selectedTag = null;
}

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}
</script>

<svelte:head>
	<title>Blog - Redshift</title>
	<meta
		name="description"
		content="Insights on decentralized secret management, Nostr protocol, developer sovereignty, and building censorship-resistant infrastructure."
	/>
	<meta property="og:title" content="Redshift Blog" />
	<meta
		property="og:description"
		content="Insights on decentralized secret management, Nostr protocol, and developer sovereignty."
	/>
	<meta property="og:type" content="website" />
	<link rel="canonical" href="https://redshiftapp.com/blog" />
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "Blog",
		"name": "Redshift Blog",
		"description": "Insights on decentralized secret management, Nostr protocol, and developer sovereignty.",
		"url": "https://redshiftapp.com/blog",
		"publisher": {
			"@type": "Organization",
			"name": "Redshift",
			"logo": {
				"@type": "ImageObject",
				"url": "https://redshiftapp.com/favicon.svg"
			}
		}
	}
	</script>`}
</svelte:head>

<div class="mx-auto max-w-4xl px-4 pt-24 pb-16">
	<!-- Header -->
	<header class="mb-16 text-center">
		<Badge variant="outline" class="mb-4 border-tokyo-blue/50 text-tokyo-blue">
			<Rss class="mr-1 size-3" />
			Insights & Updates
		</Badge>
		<h1 class="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
			The <span class="gradient-text">Redshift</span> Blog
		</h1>
		<p class="mx-auto max-w-2xl text-lg text-muted-foreground">
			Insights on decentralized secret management, Nostr protocol, developer sovereignty, and
			building censorship-resistant infrastructure.
		</p>
	</header>

	<!-- Tags filter -->
	<div class="mb-8 flex flex-wrap items-center justify-center gap-2">
		{#each tags as tag}
			<button
				onclick={() => selectTag(tag)}
				class="cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors {selectedTag === tag
					? 'bg-tokyo-blue text-white'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
			>
				{tag}
			</button>
		{/each}
	</div>

	<!-- Results count / Clear filter -->
	<div class="mb-8 flex h-6 items-center justify-center gap-2 text-sm text-muted-foreground">
		{#if selectedTag}
			<span>
				Showing {filteredPosts.length} {filteredPosts.length === 1 ? 'article' : 'articles'} tagged with "<span class="text-tokyo-blue">{selectedTag}</span>"
			</span>
			<button
				onclick={clearFilter}
				class="flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
			>
				<X class="size-3" />
				Clear
			</button>
		{/if}
	</div>

	<!-- Posts list -->
	<div class="space-y-8">
		{#each filteredPosts as post}
			<article class="group relative rounded-xl border border-border/50 bg-card/50 transition-all hover:border-border hover:bg-card">
				<a href="/blog/{post.slug}" class="block cursor-pointer p-6">
					<!-- Tags (clickable, stop propagation to parent link) -->
					<div class="mb-3 flex flex-wrap gap-2">
						{#each post.tags as tag}
							<button
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									selectTag(tag);
								}}
								class="cursor-pointer rounded-full border border-border/50 px-2 py-0.5 text-xs transition-colors hover:border-tokyo-blue hover:text-tokyo-blue {selectedTag === tag
									? 'border-tokyo-blue bg-tokyo-blue/10 text-tokyo-blue'
									: ''}"
							>
								{tag}
							</button>
						{/each}
					</div>

					<!-- Title -->
					<h2
						class="mb-2 text-xl font-semibold transition-colors group-hover:text-tokyo-blue sm:text-2xl"
					>
						{post.title}
					</h2>

					<!-- Description -->
					<p class="mb-4 text-muted-foreground">
						{post.description}
					</p>

					<!-- Meta -->
					<div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						<span class="flex items-center gap-1">
							<Calendar class="size-4" />
							{formatDate(post.date)}
						</span>
						<span class="flex items-center gap-1">
							<Clock class="size-4" />
							{post.readingTime}
						</span>
						<span
							class="ml-auto flex items-center gap-1 text-tokyo-blue opacity-0 transition-opacity group-hover:opacity-100"
						>
							Read more
							<ArrowRight class="size-4" />
						</span>
					</div>
				</a>
			</article>
		{/each}
	</div>

	<!-- CTA -->
	<div class="mt-20 rounded-xl border border-border/50 bg-card/50 p-8 text-center">
		<h2 class="mb-3 text-2xl font-bold">Ready to own your secrets?</h2>
		<p class="mb-6 text-muted-foreground">
			Get started with Redshift in under 5 minutes. Free forever for individuals.
		</p>
		<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
			<Button
				href="/admin"
				class="bg-gradient-to-r from-tokyo-blue to-tokyo-purple text-white transition-opacity hover:opacity-90"
			>
				Get Started Free
			</Button>
			<Button href="/docs/quickstart" variant="outline">Read the Quickstart</Button>
		</div>
	</div>
</div>
