<script lang="ts">
import { Copy, Check } from '@lucide/svelte';
import { onMount } from 'svelte';
import Prism from 'prismjs';
// Import additional languages
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';

interface Props {
	code: string;
	language?: 'bash' | 'json' | 'typescript' | 'javascript' | 'shell' | 'text';
	copyable?: boolean;
	filename?: string;
}

let { code, language = 'bash', copyable = true, filename }: Props = $props();

let copied = $state(false);
let highlightedCode = $state('');

// Map shell to bash for Prism
const prismLanguage = language === 'shell' ? 'bash' : language === 'text' ? 'plaintext' : language;

onMount(() => {
	// Highlight the code
	if (prismLanguage === 'plaintext') {
		highlightedCode = escapeHtml(code);
	} else {
		const grammar = Prism.languages[prismLanguage];
		if (grammar) {
			highlightedCode = Prism.highlight(code, grammar, prismLanguage);
		} else {
			highlightedCode = escapeHtml(code);
		}
	}
});

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

async function copyCode() {
	await navigator.clipboard.writeText(code);
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 2000);
}
</script>

<div class="code-block group relative my-4 max-w-full">
	{#if filename}
		<div class="flex items-center gap-2 rounded-t-lg border border-b-0 border-[#3b4261] bg-[#16161e] px-4 py-2 text-xs text-[#565f89]">
			<span class="font-mono">{filename}</span>
		</div>
	{/if}
	<div class="relative {filename ? 'rounded-b-lg rounded-t-none' : 'rounded-lg'}">
		<pre class="{filename ? 'rounded-b-lg rounded-t-none' : 'rounded-lg'} border border-[#3b4261] bg-[#1a1b26] p-4 text-sm leading-relaxed"><code class="language-{prismLanguage}">{#if highlightedCode}{@html highlightedCode}{:else}{code}{/if}</code></pre>
		{#if copyable}
			<button
				type="button"
				class="absolute right-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-md bg-[#1f2335]/80 text-[#565f89] opacity-0 transition-all hover:bg-[#1f2335] hover:text-[#c0caf5] group-hover:opacity-100"
				onclick={copyCode}
				title="Copy to clipboard"
			>
				{#if copied}
					<Check class="size-4 text-[#9ece6a]" />
				{:else}
					<Copy class="size-4" />
				{/if}
			</button>
		{/if}
	</div>
</div>

<style>
	/* Tokyo Night Storm theme for Prism.js */
	:global(.code-block code[class*="language-"]),
	:global(.code-block pre[class*="language-"]) {
		color: #c0caf5;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', Monaco, 'Andale Mono', monospace;
		font-size: 0.875rem;
		text-align: left;
		white-space: pre-wrap;
		word-spacing: normal;
		word-break: break-word;
		overflow-wrap: break-word;
		line-height: 1.6;
		tab-size: 2;
		hyphens: none;
	}

	/* Token colors - Tokyo Night Storm */
	:global(.code-block .token.comment),
	:global(.code-block .token.prolog),
	:global(.code-block .token.doctype),
	:global(.code-block .token.cdata) {
		color: #565f89;
		font-style: italic;
	}

	:global(.code-block .token.punctuation) {
		color: #9aa5ce;
	}

	:global(.code-block .token.namespace) {
		opacity: 0.7;
	}

	:global(.code-block .token.property),
	:global(.code-block .token.tag),
	:global(.code-block .token.constant),
	:global(.code-block .token.symbol),
	:global(.code-block .token.deleted) {
		color: #f7768e;
	}

	:global(.code-block .token.boolean),
	:global(.code-block .token.number) {
		color: #ff9e64;
	}

	:global(.code-block .token.selector),
	:global(.code-block .token.attr-name),
	:global(.code-block .token.string),
	:global(.code-block .token.char),
	:global(.code-block .token.builtin),
	:global(.code-block .token.inserted) {
		color: #9ece6a;
	}

	:global(.code-block .token.operator),
	:global(.code-block .token.entity),
	:global(.code-block .token.url),
	:global(.code-block .language-css .token.string),
	:global(.code-block .style .token.string) {
		color: #89ddff;
	}

	:global(.code-block .token.atrule),
	:global(.code-block .token.attr-value),
	:global(.code-block .token.keyword) {
		color: #bb9af7;
	}

	:global(.code-block .token.function),
	:global(.code-block .token.class-name) {
		color: #7aa2f7;
	}

	:global(.code-block .token.regex),
	:global(.code-block .token.important),
	:global(.code-block .token.variable) {
		color: #7dcfff;
	}

	:global(.code-block .token.important),
	:global(.code-block .token.bold) {
		font-weight: bold;
	}

	:global(.code-block .token.italic) {
		font-style: italic;
	}

	:global(.code-block .token.entity) {
		cursor: help;
	}

	/* Bash specific */
	:global(.code-block .token.function) {
		color: #7aa2f7;
	}

	:global(.code-block .token.shebang) {
		color: #565f89;
		font-style: italic;
	}

	/* Selection */
	:global(.code-block code[class*="language-"]::selection),
	:global(.code-block pre[class*="language-"]::selection),
	:global(.code-block code[class*="language-"] ::selection),
	:global(.code-block pre[class*="language-"] ::selection) {
		background: rgba(122, 162, 247, 0.3);
	}
</style>
