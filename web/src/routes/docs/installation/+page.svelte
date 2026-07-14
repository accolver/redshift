<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';
import { CircleCheck } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Installation - Redshift Docs</title>
	<meta name="description" content="Install the verified Redshift CLI on supported Linux and macOS systems." />
</svelte:head>

<DocsPage title="Installation" description="Install the verified Redshift CLI.">
	<ProseHeading level={2} id="quick-install">Verified Install</ProseHeading>
	<p>
		The installer supports Linux and macOS on x64 and arm64. It requires the GitHub CLI,
		verifies GitHub attestations and checksums, smoke-tests the candidate, and installs atomically.
	</p>
	<CodeBlock code="curl -fsSL https://redshiftapp.com/install | sh" language="bash" />
	<p>
		The default destination is <InlineCode>~/.local/bin/redshift</InlineCode>. The installer
		prints PATH instructions when needed.
	</p>

	<ProseHeading level={2} id="package-managers">Package Managers</ProseHeading>
	<p class="text-tokyo-gray">
		npm, Bun, and Homebrew packages are not currently published. Use the verified installer or a
		verified GitHub release asset.
	</p>

	<ProseHeading level={2} id="build-from-source">Build from Source</ProseHeading>
	<p>
		Development builds require <a href="https://bun.sh" target="_blank" rel="noopener">Bun</a>.
	</p>
	<CodeBlock code={`git clone https://github.com/accolver/redshift.git
cd redshift
bun install --frozen-lockfile
bun run build
install -m 0755 dist/redshift ~/.local/bin/redshift`} language="bash" />

	<ProseHeading level={2} id="manual-installation">Verified Release Assets</ProseHeading>
	<p>
		The <a href="https://github.com/accolver/redshift/releases" target="_blank" rel="noopener">GitHub releases page</a>
		publishes binaries for these supported targets:
	</p>
	<ul>
		<li><InlineCode>redshift-darwin-arm64</InlineCode> - macOS (Apple Silicon)</li>
		<li><InlineCode>redshift-darwin-x64</InlineCode> - macOS (Intel)</li>
		<li><InlineCode>redshift-linux-x64</InlineCode> - Linux (x64)</li>
		<li><InlineCode>redshift-linux-arm64</InlineCode> - Linux (ARM64)</li>
	</ul>

	<ProseHeading level={2} id="verify-installation">Verify Installation</ProseHeading>
	<CodeBlock code={`redshift --version
# Certified release at time of writing: redshift v0.14.2`} language="bash" />

	<ProseHeading level={2} id="system-requirements">System Requirements</ProseHeading>
	<div class="not-prose my-6 space-y-3">
		<div class="flex items-center gap-3">
			<CircleCheck class="size-5 text-tokyo-green" />
			<span>Linux or macOS on x64 or arm64</span>
		</div>
		<div class="flex items-center gap-3">
			<CircleCheck class="size-5 text-tokyo-green" />
			<span>GitHub CLI authenticated sufficiently to verify public attestations</span>
		</div>
	</div>
	<p>Windows binaries are not currently published.</p>

	<ProseHeading level={2} id="next-steps">Next Steps</ProseHeading>
	<p>Continue to the <a href="/docs/quickstart">Quick Start guide</a>.</p>
</DocsPage>
