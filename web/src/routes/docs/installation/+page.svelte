<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import { CheckCircle } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Installation - Redshift Docs</title>
	<meta name="description" content="Install Redshift CLI on macOS, Linux, or Windows." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">Installation</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Get Redshift running on your machine in under a minute.
	</p>

	<section class="prose prose-invert max-w-none">
		<h2>Quick Install (Recommended)</h2>
		<p>
			The fastest way to install Redshift is using the install script. This works on macOS, Linux, and Windows (WSL):
		</p>

		<CodeBlock code="curl -fsSL https://redshiftapp.com/install | sh" />

		<p>
			This will download the latest release and install it to <code>~/.redshift/bin</code>, then add it to your PATH.
		</p>

		<h2>Package Managers</h2>

		<h3>npm / Bun</h3>
		<p>If you prefer using a JavaScript package manager:</p>
		<CodeBlock code={`# Using npm
npm install -g @redshift/cli

# Using bun
bun add -g @redshift/cli`} />

		<h3>Homebrew (macOS)</h3>
		<p>Coming soon:</p>
		<CodeBlock code="brew install redshift" />

		<h2>Manual Installation</h2>
		<p>
			Download the appropriate binary for your platform from the 
			<a href="https://github.com/accolver/redshift/releases" target="_blank" rel="noopener">GitHub releases page</a>:
		</p>

		<ul>
			<li><code>redshift-darwin-arm64</code> - macOS (Apple Silicon)</li>
			<li><code>redshift-darwin-x64</code> - macOS (Intel)</li>
			<li><code>redshift-linux-x64</code> - Linux (x64)</li>
			<li><code>redshift-linux-arm64</code> - Linux (ARM64)</li>
		</ul>

		<p>Then make it executable and move to your PATH:</p>
		<CodeBlock code={`chmod +x redshift-*
sudo mv redshift-* /usr/local/bin/redshift`} />

		<h2>Verify Installation</h2>
		<p>Confirm Redshift is installed correctly:</p>
		<CodeBlock code={`redshift --version
# Output: redshift v0.1.0`} />

		<h2>System Requirements</h2>
		<div class="not-prose my-6 space-y-3">
			<div class="flex items-center gap-3">
				<CheckCircle class="size-5 text-tokyo-green" />
				<span>macOS 12+ (Monterey or later)</span>
			</div>
			<div class="flex items-center gap-3">
				<CheckCircle class="size-5 text-tokyo-green" />
				<span>Linux (glibc 2.17+, most modern distributions)</span>
			</div>
			<div class="flex items-center gap-3">
				<CheckCircle class="size-5 text-tokyo-green" />
				<span>Windows 10+ with WSL2</span>
			</div>
			<div class="flex items-center gap-3">
				<CheckCircle class="size-5 text-tokyo-green" />
				<span>Node.js 18+ (only for npm installation)</span>
			</div>
		</div>

		<h2>Next Steps</h2>
		<p>
			Now that Redshift is installed, continue to the <a href="/docs/quickstart">Quick Start guide</a> to create your first project and store some secrets.
		</p>
	</section>
</div>
