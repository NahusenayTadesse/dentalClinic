<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { CheckCheck, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { FinalizePayroll } from './schema';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		id,
		employees
	}: {
		data: SuperValidated<FinalizePayroll>;
		id: number;
		employees: Item[];
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		dataType: 'json'
	});

	let open = $state(false);

	$form.id = id;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import type { Item } from '$lib/global.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
				open = false;
			}
		}
	});
</script>

<DialogComp title="Finalize Payroll" variant="default" IconComp={CheckCheck} bind:open>
	<form
		action="?/finalize"
		use:enhance
		method="post"
		id="finalize"
		class="flex w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />
		<input hidden name="id" value={$form.id} />
		<h3>You are about to finalize this payroll run</h3>

		<InputComp
			label="Finalized By"
			name="finalizedBy"
			type="combo"
			items={employees}
			{form}
			{errors}
			required
		/>

		<Button type="submit" class="mt-4" form="finalize">
			{#if $delayed}
				<LoadingBtn name="Finalizing" />
			{:else}
				<Save class="h-4 w-4" />

				Finalize Payroll
			{/if}
		</Button>
	</form>
</DialogComp>
