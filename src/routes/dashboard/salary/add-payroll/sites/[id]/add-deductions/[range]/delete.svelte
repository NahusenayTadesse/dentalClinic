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
		id
	}: {
		data: SuperValidated<Infer<Delete>>;
		id: number;
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

<AlertDialog.Root>
	<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
		<Trash /> Delete
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete this overtime entry
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
