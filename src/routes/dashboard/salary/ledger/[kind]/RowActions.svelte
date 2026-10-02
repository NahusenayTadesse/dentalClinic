<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash-2';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';

	/**
	 * One adjustment's actions: change it, or — for a super admin — remove it. Neither is offered
	 * once it has been paid; the server refuses both anyway (`payrollLedgerWrites.ts`).
	 */
	let {
		id,
		paid,
		onedit,
		remove
	}: {
		id: number;
		paid: boolean;
		onedit: () => void;
		/** The remove form, or null for someone who may not remove. */
		remove: SuperValidated<Record<string, unknown>> | null;
	} = $props();
</script>

{#if paid}
	<span class="text-xs text-muted-foreground">Paid — closed</span>
{:else}
	<div class="flex justify-end gap-1">
		<Button size="sm" variant="ghost" onclick={onedit}><Pencil class="size-4" /> Edit</Button>
		{#if remove}
			<StepButton
				id="remove-{id}"
				action="?/remove"
				data={remove}
				label="Remove"
				icon={Trash}
				variant="ghost"
				values={{ id }}
				confirm={{
					title: 'Remove this entry?',
					description:
						'It will not be paid. The removal stays on the audit trail, and the entry can be recorded again.',
					action: 'Remove'
				}}
			/>
		{/if}
	</div>
{/if}
