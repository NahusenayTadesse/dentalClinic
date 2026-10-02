<script lang="ts">
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { CheckCheck, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import type { FinalizePayroll } from './schema';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { finalizePayroll } from './schema';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	let {
		data,
		id,
		employees
	}: {
		data: SuperValidated<FinalizePayroll>;
		id: number;
		employees: Item[];
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, finalizePayroll, {
		onUpdated({ form: result }) {
			if (result.message?.type === 'success') open = false;
		},
		resetForm: false,
		dataType: 'json'
	});

	let open = $state(false);

	// Kept in step with the run being shown.
	$effect(() => {
		$form.id = id;
	});

	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import type { Item } from '$lib/global.svelte';
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
