<script lang="ts">
</script>

<svelte:head>
	<title>Web Admin - Redshift Docs</title>
	<meta name="description" content="Using the Redshift web admin interface to manage projects and secrets." />
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-4 text-4xl font-bold">Web Admin</h1>
	<p class="mb-8 text-lg text-muted-foreground">
		Manage your projects and secrets through a visual interface.
	</p>

	<section class="prose prose-invert max-w-none">
		<h2>Accessing the Web Admin</h2>
		<p>There are two ways to access the Redshift web admin:</p>

		<h3>Hosted Version</h3>
		<p>
			Visit <a href="https://redshiftapp.com/admin" target="_blank">redshiftapp.com/admin</a> to use the hosted web admin. This connects directly to Nostr relays from your browser - no data passes through our servers.
		</p>

		<h3>Local Version</h3>
		<p>
			Run the web admin locally using the CLI:
		</p>
		<pre><code>redshift serve --open</code></pre>
		<p>
			This starts a local server at <code>http://localhost:3000</code> with the same functionality.
		</p>

		<h2>Connecting</h2>
		<p>
			When you first open the web admin, you'll need to connect with your Nostr identity:
		</p>
		<ol>
			<li>Click the "Connect" button in the top right</li>
			<li>Choose your authentication method:
				<ul>
					<li><strong>Browser Extension</strong> - Uses Alby, nos2x, or similar (recommended)</li>
					<li><strong>Private Key</strong> - Enter your nsec directly</li>
					<li><strong>Bunker</strong> - Connect via NIP-46 remote signer</li>
				</ul>
			</li>
			<li>Approve the connection if prompted by your extension</li>
		</ol>

		<h2>Dashboard</h2>
		<p>
			After connecting, you'll see your dashboard showing all your projects. From here you can:
		</p>
		<ul>
			<li>View all projects at a glance</li>
			<li>See environment count per project</li>
			<li>Create new projects</li>
			<li>Access global search (⌘K / Ctrl+K)</li>
		</ul>

		<h2>Managing Projects</h2>
		
		<h3>Creating a Project</h3>
		<ol>
			<li>Click "New Project" on the dashboard</li>
			<li>Enter a project name (e.g., "my-api", "frontend")</li>
			<li>Click "Create"</li>
		</ol>
		<p>
			New projects automatically include a "Development" environment. You can add more environments like staging and production.
		</p>

		<h3>Project Settings</h3>
		<p>Click on a project to access its settings:</p>
		<ul>
			<li><strong>Rename</strong> - Change the project name</li>
			<li><strong>Add Environment</strong> - Create new environments</li>
			<li><strong>Delete</strong> - Remove the project and all its secrets</li>
		</ul>

		<h2>Managing Environments</h2>
		<p>
			Environments let you separate secrets for different stages (dev, staging, prod):
		</p>

		<h3>Adding an Environment</h3>
		<ol>
			<li>Open a project</li>
			<li>Click "Add Environment"</li>
			<li>Enter a slug (e.g., "staging") and display name (e.g., "Staging")</li>
			<li>Click "Add"</li>
		</ol>

		<h3>Switching Environments</h3>
		<p>
			Use the environment tabs at the top of the project page to switch between environments. Each environment has its own set of secrets.
		</p>

		<h2>Managing Secrets</h2>

		<h3>Adding Secrets</h3>
		<ol>
			<li>Open a project and select an environment</li>
			<li>Click "Add Secret" or use the inline form</li>
			<li>Enter the key name (automatically uppercased)</li>
			<li>Enter the value</li>
			<li>Click "Save" or press Enter</li>
		</ol>

		<h3>Editing Secrets</h3>
		<p>
			Click on any secret value to edit it inline. Press Enter to save or Escape to cancel.
		</p>

		<h3>Deleting Secrets</h3>
		<p>
			Click the trash icon next to a secret to delete it. This action requires confirmation.
		</p>

		<h3>Bulk Operations</h3>
		<p>
			Use the Import/Export buttons to work with multiple secrets:
		</p>
		<ul>
			<li><strong>Import</strong> - Paste a .env file or JSON to add multiple secrets at once</li>
			<li><strong>Export</strong> - Download secrets as .env or JSON format</li>
		</ul>

		<h2>Search</h2>
		<p>
			Press <kbd>⌘K</kbd> (Mac) or <kbd>Ctrl+K</kbd> (Windows/Linux) to open global search:
		</p>
		<ul>
			<li>Search across all projects and environments</li>
			<li>Find secrets by key name</li>
			<li>Quick navigation to any project or environment</li>
		</ul>

		<h2>Relay Status</h2>
		<p>
			The relay indicator in the header shows your connection status:
		</p>
		<ul>
			<li><span class="text-tokyo-green">●</span> <strong>Green</strong> - Connected to relays</li>
			<li><span class="text-tokyo-orange">●</span> <strong>Yellow</strong> - Connecting...</li>
			<li><span class="text-tokyo-red">●</span> <strong>Red</strong> - Connection error</li>
		</ul>
		<p>
			Click the indicator to see details about which relays are connected.
		</p>

		<h2>Security Notes</h2>
		<ul>
			<li><strong>Client-side encryption</strong> - All secrets are encrypted in your browser before being sent to relays</li>
			<li><strong>No server storage</strong> - The hosted version doesn't store any of your data</li>
			<li><strong>Session-based</strong> - For nsec auth, your key is encrypted and only stored for the browser session</li>
			<li><strong>Disconnect when done</strong> - Click your profile and "Disconnect" when finished</li>
		</ul>

		<h2>Keyboard Shortcuts</h2>
		<div class="not-prose my-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="px-4 py-3 text-left font-medium">Shortcut</th>
						<th class="px-4 py-3 text-left font-medium">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr>
						<td class="px-4 py-3"><kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd></td>
						<td class="px-4 py-3 text-muted-foreground">Open search</td>
					</tr>
					<tr>
						<td class="px-4 py-3"><kbd>Escape</kbd></td>
						<td class="px-4 py-3 text-muted-foreground">Close dialogs / Cancel editing</td>
					</tr>
					<tr>
						<td class="px-4 py-3"><kbd>Enter</kbd></td>
						<td class="px-4 py-3 text-muted-foreground">Save current edit</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</div>
