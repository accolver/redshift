<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import { CircleCheck } from '@lucide/svelte';
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
		<ProseHeading level={2} id="quick-install">Quick Install (Recommended)</ProseHeading>
		<p>
			The fastest way to install Redshift is using the install script. This works on macOS, Linux, and Windows (WSL):
		</p>

		<CodeBlock code="curl -fsSL https://redshiftapp.com/install | sh" language="bash" />

		<p>
			This will download the latest release and install it to <code>~/.redshift/bin</code>, then add it to your PATH.
		</p>

		<ProseHeading level={2} id="package-managers">Package Managers</ProseHeading>

		<ProseHeading level={3} id="npm-bun">npm / Bun</ProseHeading>
		<p>If you prefer using a JavaScript package manager:</p>
		<CodeBlock code={`# Using npm
npm install -g @redshift/cli

# Using bun
bun add -g @redshift/cli`} language="bash" />

		<ProseHeading level={3} id="homebrew">Homebrew (macOS)</ProseHeading>
		<p>Coming soon:</p>
		<CodeBlock code="brew install redshift" language="bash" />

		<ProseHeading level={2} id="manual-installation">Manual Installation</ProseHeading>
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
sudo mv redshift-* /usr/local/bin/redshift`} language="bash" />

		<ProseHeading level={2} id="verify-installation">Verify Installation</ProseHeading>
		<p>Confirm Redshift is installed correctly:</p>
		<CodeBlock code={`redshift --version
# Output: redshift v0.1.0`} language="bash" />

		<ProseHeading level={2} id="system-requirements">System Requirements</ProseHeading>
		<div class="not-prose my-6 space-y-3">
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>macOS 12+ (Monterey or later)</span>
			</div>
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Linux (glibc 2.17+, most modern distributions)</span>
			</div>
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Windows 10+ with WSL2</span>
			</div>
			<div class="flex items-center gap-3">
				<CircleCheck class="size-5 text-tokyo-green" />
				<span>Node.js 18+ (only for npm installation)</span>
			</div>
		</div>

		<ProseHeading level={2} id="next-steps">Next Steps</ProseHeading>
		<p>
			Now that Redshift is installed, continue to the <a href="/docs/quickstart">Quick Start guide</a> to create your first project and store some secrets.
		</p>
	</section>
</div>
