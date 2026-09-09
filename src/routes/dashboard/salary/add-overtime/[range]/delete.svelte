<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	import { Trash } from '@lucide/svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Delete } from './schema';
	import { toast } from 'svelte-sonner';
	let {
		data,
		id,
		canDelete = false
	}: {
		data: SuperValidated<Infer<Delete>>;
		id: number;
		/** Only a super admin gets the delete button. */
		canDelete?: boolean;
	} = $props();
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {});

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
</script>

{#if canDelete}
	<AlertDialog.Root>
		<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
			<Trash /> Delete
		</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Are you sure?</AlertDialog.Title>
				<AlertDialog.Description>
					This overtime entry stops counting towards payroll and disappears from this list
				</AlertDialog.Description>
			</AlertDialog.Header>
			<form
				action="?/delete"
				use:enhance
				method="post"
				id="delete"
				class="flex w-full flex-col gap-4 p-4"
			>
				<InputComp type="hidden" label="" {form} {errors} name="id" />
				<AlertDialog.Footer>
					<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
					<AlertDialog.Action class={buttonVariants({ variant: 'destructive' })}>
						{#snippet child({ props })}
							<Button type="submit" form="delete" {...props}>
								{#if $delayed}
									<LoadingBtn name="Deleting Overtime" />
								{:else}
									<Trash /> Delete Overtime
								{/if}
							</Button>
						{/snippet}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
