<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Trash } from '@lucide/svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import type { DeleteService as schema } from './schema';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	let {
		data,
		action = '/dashboard/customers?/addCustomer',
		id,
		canDelete = false
	}: {
		data: SuperValidated<schema>;
		action: string;
		id: number;
		/** Only a super admin gets the delete button. */
		canDelete?: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});
	import { toast } from 'svelte-sonner';

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	$form.id = id;

	let open = $state(false);
</script>

{#if canDelete}
	<DialogComp title="Delete" variant="destructive" bind:open>
		<h5 class="text-center">
			Are you sure you want to delete this expense type? It stops appearing anywhere, but existing
			expenses keep their type.
		</h5>
		<div class="flex flex-row items-end justify-center gap-4 pt-4">
			<form method="post" id="delete" action="?/delete" use:enhance>
				<Errors allErrors={$allErrors} />
				<input bind:value={$form.id} name="id" type="hidden" />
				<Button type="submit" class="mt-4" form="delete">
					{#if $delayed}
						<LoadingBtn name="Deleting" />
					{:else}
						<Trash /> Delete
					{/if}
				</Button>
			</form>

			<Button onclick={() => (open = false)} class="mt-4">Cancel</Button>
		</div>
	</DialogComp>
{/if}
