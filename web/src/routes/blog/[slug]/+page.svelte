<script lang="ts">
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import { Calendar, Clock, ArrowLeft, Link, Check } from '@lucide/svelte';

const { data } = $props();
const post = $derived(data.post);

let copied = $state(false);

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

async function copyLink() {
	await navigator.clipboard.writeText(window.location.href);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}

function shareOnX() {
	const text = encodeURIComponent(`${post.title}`);
	const url = encodeURIComponent(window.location.href);
	window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareOnLinkedIn() {
	const url = encodeURIComponent(window.location.href);
	window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
}

function shareOnHackerNews() {
	const title = encodeURIComponent(post.title);
	const url = encodeURIComponent(window.location.href);
	window.open(`https://news.ycombinator.com/submitlink?u=${url}&t=${title}`, '_blank');
}

function shareOnReddit() {
	const title = encodeURIComponent(post.title);
	const url = encodeURIComponent(window.location.href);
	window.open(`https://reddit.com/submit?url=${url}&title=${title}`, '_blank');
}
</script>

<svelte:head>
	<title>{post.title} - Redshift Blog</title>
	<meta name="description" content={post.description} />
	<meta property="og:title" content={post.title} />
	<meta property="og:description" content={post.description} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content="https://redshiftapp.com/blog/{post.slug}" />
	<meta property="article:published_time" content={post.date} />
	<meta property="article:author" content={post.author} />
	{#each post.tags as tag}
		<meta property="article:tag" content={tag} />
	{/each}
	<link rel="canonical" href="https://redshiftapp.com/blog/{post.slug}" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.title,
		description: post.description,
		datePublished: post.date,
		author: {
			"@type": "Organization",
			name: post.author
		},
		publisher: {
			"@type": "Organization",
			name: "Redshift",
			logo: {
				"@type": "ImageObject",
				url: "https://redshiftapp.com/favicon.svg"
			}
		},
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": `https://redshiftapp.com/blog/${post.slug}`
		}
	})}</script>`}
</svelte:head>

<article class="mx-auto max-w-3xl px-4 pt-24 pb-16">
	<!-- Back link -->
	<a
		href="/blog"
		class="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="size-4" />
		Back to Blog
	</a>

	<!-- Header -->
	<header class="mb-12">
		<!-- Tags -->
		<div class="mb-4 flex flex-wrap gap-2">
			{#each post.tags as tag}
				<Badge variant="outline" class="border-tokyo-blue/50 text-tokyo-blue">
					{tag}
				</Badge>
			{/each}
		</div>

		<!-- Title -->
		<h1 class="mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
			{post.title}
		</h1>

		<!-- Meta -->
		<div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
			<span class="flex items-center gap-1.5">
				<Calendar class="size-4" />
				{formatDate(post.date)}
			</span>
			<span class="flex items-center gap-1.5">
				<Clock class="size-4" />
				{post.readingTime}
			</span>
			<span class="text-foreground/50">|</span>
			<span>By {post.author}</span>
		</div>

		<!-- Share buttons -->
		<div class="mt-6 flex items-center gap-1">
			<span class="mr-2 text-sm text-muted-foreground">Share:</span>
			<button
				onclick={shareOnX}
				class="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Share on X"
				title="Share on X"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
				</svg>
			</button>
			<button
				onclick={shareOnLinkedIn}
				class="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Share on LinkedIn"
				title="Share on LinkedIn"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
				</svg>
			</button>
			<button
				onclick={shareOnHackerNews}
				class="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Share on Hacker News"
				title="Share on Hacker News"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M0 0v24h24V0H0zm12.8 13.4v5.2H11v-5.2L6.7 4.6h2.1l3.1 6.4 3.1-6.4h2.1l-4.3 8.8z" />
				</svg>
			</button>
			<button
				onclick={shareOnReddit}
				class="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Share on Reddit"
				title="Share on Reddit"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
				</svg>
			</button>
			<button
				onclick={copyLink}
				class="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Copy link"
				title="Copy link"
			>
				{#if copied}
					<Check class="size-4 text-tokyo-green" />
				{:else}
					<Link class="size-4" />
				{/if}
			</button>
		</div>
	</header>

	<!-- Content -->
	<div class="prose prose-lg max-w-none">
		{@html post.content}
	</div>

	<!-- CTA -->
	<div class="mt-16 rounded-xl border border-border/50 bg-card/50 p-8 text-center">
		<h2 class="mb-3 text-xl font-bold">Ready to try Redshift?</h2>
		<p class="mb-6 text-muted-foreground">
			Own your secrets with decentralized, censorship-resistant secret management.
		</p>
		<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
			<Button
				href="/admin"
				class="bg-gradient-to-r from-tokyo-blue to-tokyo-purple text-white transition-opacity hover:opacity-90"
			>
				Get Started Free
			</Button>
			<Button href="/docs" variant="outline">Read the Docs</Button>
		</div>
	</div>

	<!-- Back to blog -->
	<div class="mt-12 border-t border-border/50 pt-8">
		<a
			href="/blog"
			class="inline-flex items-center gap-2 text-tokyo-blue transition-colors hover:text-tokyo-blue/80"
		>
			<ArrowLeft class="size-4" />
			Back to all posts
		</a>
	</div>
</article>
