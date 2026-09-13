<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';

	/**
	 * A patient's name in the list, and whether they belong to another branch.
	 *
	 * The flag is the wording CLAUDE.md §15 asks for. A search crosses branches so the person at
	 * the window is found rather than registered twice; the badge is what stops the receptionist
	 * wondering why a stranger's chart appeared, and tells them the answer — treat them here.
	 */
	let {
		id,
		name,
		fileNo,
		fromOtherBranch = false,
		branch
	}: {
		id: number;
		name: string;
		fileNo: string | null;
		fromOtherBranch?: boolean;
		branch: string | null;
	} = $props();
</script>

<div class="flex flex-col items-start gap-0.5">
	<DataTableLinks {id} {name} entity="patient" />
	<div class="flex items-center gap-1 px-3 text-xs text-muted-foreground">
		{fileNo ? `File ${fileNo}` : 'No file number'}
		{#if fromOtherBranch}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Badge variant="outline" class="border-amber-500 text-amber-700 dark:text-amber-400">
							{branch ?? 'Other branch'}
						</Badge>
					</Tooltip.Trigger>
					<Tooltip.Content>
						This patient is not from this branch, but can be treated here.
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</div>
</div>
