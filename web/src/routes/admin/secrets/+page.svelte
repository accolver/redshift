<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';

	// Placeholder secrets for demo
	let secrets = $state<Array<{ key: string; value: string; isVisible: boolean }>>([
		{ key: 'DATABASE_URL', value: 'postgres://user:***@localhost/db', isVisible: false },
		{ key: 'API_KEY', value: 'sk-***', isVisible: false },
		{ key: 'JWT_SECRET', value: '***', isVisible: false }
	]);

	let newKey = $state('');
	let newValue = $state('');

	function addSecret() {
		if (newKey && newValue) {
			secrets = [...secrets, { key: newKey, value: newValue, isVisible: false }];
			newKey = '';
			newValue = '';
		}
	}

	function toggleVisibility(index: number) {
		secrets[index].isVisible = !secrets[index].isVisible;
	}

	function deleteSecret(index: number) {
		secrets = secrets.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>Secrets - Redshift Admin</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8">
	<div>
		<h1 class="text-3xl font-bold">Secrets</h1>
		<p class="text-muted-foreground">Manage environment secrets for your project</p>
	</div>

	<!-- Add Secret Form -->
	<Card>
		<CardHeader>
			<CardTitle>Add Secret</CardTitle>
		</CardHeader>
		<CardContent>
			<form class="flex gap-4" onsubmit={(e) => { e.preventDefault(); addSecret(); }}>
				<Input bind:value={newKey} placeholder="KEY_NAME" class="flex-1" />
				<Input bind:value={newValue} type="password" placeholder="Value" class="flex-1" />
				<Button type="submit">Add</Button>
			</form>
		</CardContent>
	</Card>

	<!-- Secrets Table -->
	<Card>
		<CardHeader>
			<CardTitle>Environment Secrets</CardTitle>
		</CardHeader>
		<CardContent>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead class="w-[200px]">Key</TableHead>
						<TableHead>Value</TableHead>
						<TableHead class="w-[150px] text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each secrets as secret, index}
						<TableRow>
							<TableCell class="font-mono font-medium">{secret.key}</TableCell>
							<TableCell class="font-mono text-muted-foreground">
								{secret.isVisible ? secret.value : '••••••••'}
							</TableCell>
							<TableCell class="text-right">
								<div class="flex justify-end gap-2">
									<Button variant="ghost" size="sm" onclick={() => toggleVisibility(index)}>
										{secret.isVisible ? 'Hide' : 'Show'}
									</Button>
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive"
										onclick={() => deleteSecret(index)}
									>
										Delete
									</Button>
								</div>
							</TableCell>
						</TableRow>
					{/each}
					{#if secrets.length === 0}
						<TableRow>
							<TableCell colspan={3} class="py-8 text-center text-muted-foreground">
								No secrets yet. Add your first secret above.
							</TableCell>
						</TableRow>
					{/if}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
</div>
