<script lang="ts">
import CodeBlock from '$lib/components/CodeBlock.svelte';
import InlineCode from '$lib/components/InlineCode.svelte';
import ProseHeading from '$lib/components/ProseHeading.svelte';
import DocsPage from '$lib/components/DocsPage.svelte';

</script>

<svelte:head>
	<title>AI Agent Skills - Redshift Docs</title>
	<meta name="description" content="Use Redshift with AI coding agents for natural-language secret management." />
</svelte:head>

<DocsPage title="AI Agent Skills" description="Use Redshift with AI coding agents for natural-language secret management.">
	<p>
		The Redshift CLI ships with an Agent Skill — a structured instruction file that teaches AI coding agents how to use the Redshift CLI on your behalf. The skill follows the open <a href="https://github.com/anthropics/agent-skills" target="_blank" rel="noopener">Agent Skills standard</a> and works with Claude Code, OpenCode, Claude Agent SDK, and claude.ai.
	</p>

	<ProseHeading level={2} id="what-the-skill-covers">What the Skill Covers</ProseHeading>
	<p>The skill covers the full Redshift CLI surface:</p>

	<div class="not-prose my-6 overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border">
					<th class="px-4 py-3 text-left font-medium">Command</th>
					<th class="px-4 py-3 text-left font-medium">Description</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				<tr>
					<td class="px-4 py-3 font-mono">redshift login</td>
					<td class="px-4 py-3 text-muted-foreground">Authenticate with Nostr identity (nsec, bunker, NostrConnect)</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift logout</td>
					<td class="px-4 py-3 text-muted-foreground">Clear stored credentials</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift me</td>
					<td class="px-4 py-3 text-muted-foreground">Display current identity</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift setup</td>
					<td class="px-4 py-3 text-muted-foreground">Configure project and environment</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift secrets</td>
					<td class="px-4 py-3 text-muted-foreground">List, get, set, delete, upload, and download secrets</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift run</td>
					<td class="px-4 py-3 text-muted-foreground">Run commands with secrets injected as environment variables</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift configure</td>
					<td class="px-4 py-3 text-muted-foreground">View and modify CLI configuration</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift serve</td>
					<td class="px-4 py-3 text-muted-foreground">Start the local web admin UI</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">redshift upgrade</td>
					<td class="px-4 py-3 text-muted-foreground">Self-update the CLI binary</td>
				</tr>
			</tbody>
		</table>
	</div>

	<ProseHeading level={2} id="prerequisites">Prerequisites</ProseHeading>
	<p>
		Before using the skill, ensure the Redshift CLI is installed and you're authenticated:
	</p>
	<CodeBlock code={`# Install Redshift CLI
curl -fsSL https://redshiftapp.com/install | sh

# Authenticate
redshift login`} language="bash" />

	<ProseHeading level={2} id="installation">Installation</ProseHeading>

	<ProseHeading level={3} id="claude-code">Claude Code</ProseHeading>
	<p>
		The skill is in the Redshift repository. To use it in your project:
	</p>
	<CodeBlock code={`# Copy into your project's .claude/skills/ directory
mkdir -p .claude/skills
cp -r path/to/redshift/skills/redshift .claude/skills/`} language="bash" />
	<p>Or add it globally:</p>
	<CodeBlock code={`mkdir -p ~/.claude/skills
cp -r path/to/redshift/skills/redshift ~/.claude/skills/`} language="bash" />
	<p>
		Claude Code discovers skills automatically. Test it by asking Claude Code: "Show me my secrets for the dev environment."
	</p>

	<ProseHeading level={3} id="opencode">OpenCode</ProseHeading>
	<p>Copy the skill into your project or global config:</p>
	<CodeBlock code={`# Project-level
mkdir -p .opencode/skills
cp -r path/to/redshift/skills/redshift .opencode/skills/

# Global
mkdir -p ~/.config/opencode/skills
cp -r path/to/redshift/skills/redshift ~/.config/opencode/skills/`} language="bash" />

	<ProseHeading level={3} id="claude-agent-sdk">Claude Agent SDK</ProseHeading>
	<p>
		Include the <InlineCode>skills/redshift/</InlineCode> directory in your <InlineCode>.claude/skills/</InlineCode> directory and add <InlineCode>"Skill"</InlineCode> to your <InlineCode>allowed_tools</InlineCode> configuration.
	</p>

	<ProseHeading level={3} id="claude-ai">claude.ai</ProseHeading>
	<p>
		Zip the <InlineCode>skills/redshift/</InlineCode> directory and upload it via Settings &gt; Features.
	</p>

	<ProseHeading level={2} id="what-you-can-do">What You Can Do</ProseHeading>
	<p>
		Once the skill is installed, you can ask your AI agent things like:
	</p>
	<ul>
		<li>"Set my Stripe key for production"</li>
		<li>"Show me all secrets for the staging environment"</li>
		<li>"Delete the old API key from my backend project"</li>
		<li>"Download my dev secrets as a .env file"</li>
		<li>"Run my app with secrets injected"</li>
		<li>"What project am I authenticated as?"</li>
	</ul>

	<ProseHeading level={2} id="ci-cd">CI/CD Usage</ProseHeading>
	<p>
		For non-interactive environments, set these environment variables instead of running <InlineCode>redshift login</InlineCode>:
	</p>

	<div class="not-prose my-6 overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border">
					<th class="px-4 py-3 text-left font-medium">Variable</th>
					<th class="px-4 py-3 text-left font-medium">Description</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				<tr>
					<td class="px-4 py-3 font-mono">REDSHIFT_NSEC</td>
					<td class="px-4 py-3 text-muted-foreground">Private key (bypasses interactive login)</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">REDSHIFT_BUNKER</td>
					<td class="px-4 py-3 text-muted-foreground">NIP-46 bunker URL (alternative to nsec)</td>
				</tr>
				<tr>
					<td class="px-4 py-3 font-mono">REDSHIFT_CONFIG_DIR</td>
					<td class="px-4 py-3 text-muted-foreground">Override config directory</td>
				</tr>
			</tbody>
		</table>
	</div>
	<p>
		Store these in your CI platform's secret management (e.g., GitHub Actions secrets) — never hardcode them.
	</p>

	<ProseHeading level={2} id="security">Security Notes</ProseHeading>
	<ul>
		<li>The AI agent should ask for confirmation before running commands with <InlineCode>redshift run</InlineCode></li>
		<li>All encryption remains client-side — secrets never leave your device unencrypted</li>
		<li>Private keys are stored in your system keychain, not in plaintext config files</li>
		<li>The skill does not require or request any elevated system privileges</li>
	</ul>

	<ProseHeading level={2} id="source">Source and Updates</ProseHeading>
	<p>
		The skill source lives in the <a href="https://github.com/accolver/redshift/tree/main/skills/redshift" target="_blank" rel="noopener">Redshift repository</a>. To update, pull the latest version and copy the <InlineCode>skills/redshift/</InlineCode> directory to your skill location.
	</p>
</DocsPage>
