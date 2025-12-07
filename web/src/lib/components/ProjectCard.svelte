<script lang="ts">
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
import { Folder, ChevronRight } from '@lucide/svelte';
import type { Project } from '$lib/types/nostr';

interface Props {
	project?: Project;
	placeholder?: boolean;
}

let { project, placeholder = false }: Props = $props();

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

const isPlaceholder = $derived(placeholder || !project);
const href = $derived(project ? `/admin/projects/${project.id}` : undefined);
</script>

{#if isPlaceholder}
	<Card class="border-dashed">
		<CardHeader class="pb-3">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground/40">
						<Folder class="size-5" />
					</div>
					<div>
						<CardTitle class="text-base text-muted-foreground">No projects yet</CardTitle>
						<CardDescription class="text-xs">
							Create your first project
						</CardDescription>
					</div>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<div class="flex items-center gap-4 text-sm text-muted-foreground">
				<span>0 environments</span>
			</div>
		</CardContent>
	</Card>
{:else if project}
	<a {href} class="block">
		<Card class="group cursor-pointer transition-colors hover:border-primary/50">
			<CardHeader class="pb-3">
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Folder class="size-5" />
						</div>
						<div>
							<CardTitle class="text-base">{project.displayName}</CardTitle>
							<CardDescription class="text-xs">
								{project.slug} · Created {formatDate(project.createdAt)}
							</CardDescription>
						</div>
					</div>
					<ChevronRight class="size-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
				</div>
			</CardHeader>
			<CardContent>
				<div class="flex items-center gap-4 text-sm text-muted-foreground">
					<span>{project.environments.length} environment{project.environments.length !== 1 ? 's' : ''}</span>
				</div>
			</CardContent>
		</Card>
	</a>
{/if}
