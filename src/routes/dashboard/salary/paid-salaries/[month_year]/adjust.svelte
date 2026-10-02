<script lang="ts">
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { adjustableFields, type Adjust } from './schema';

	const fieldLabels: Record<(typeof adjustableFields)[number], string> = {
		basicSalary: 'Basic Salary',
		overtimeAmount: 'Overtime',
		deductions: 'Deduction',
		commissionAmount: 'Commission',
		bonusAmount: 'Bonus',
		allowances: 'Allowances',
		transportAllowance: 'Transport Allowance',
		positionAllowance: 'Position Allowance',
		housingAllowance: 'Housing Allowance',
		nonTaxableAllowance: 'Non-Taxable Allowance'
	};

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	let {
		data,
		id,
		banks
	}: {
		data: SuperValidated<Adjust>;
		id: number[];
		banks: Item[];
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		dataType: 'json'
	});

	let open = $state(false);

	$form.id = id;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
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

<DialogComp
	title="Adjust Salary Record for {id.length} record(s)"
	variant="default"
	IconComp={SquarePen}
	bind:open
>
	<form
		action="?/adjust"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<input hidden name="id" value={$form.id} />
		<h3>You are about to edit {id.length} record(s)</h3>

		<InputComp
			label="Adjustment Type"
			name="adjustmentType"
			type="select"
			{form}
			{errors}
			items={[
				{ value: 'bonus', name: 'Bonus' },
				{ value: 'deduction', name: 'Deduction' }
			]}
			required
		/>

		<InputComp
			label="Adjustment Amount, Enter the Amount to be Added or Deducted on the Net Pay Directly"
			name="amount"
			type="number"
			{form}
			min="0"
			{errors}
		/>

		<h4 class="mt-2">
			Pay Component Adjustments — leave a field at 0 to leave that component unchanged; tax is
			recalculated automatically.
		</h4>
		{#each adjustableFields as field (field)}
			<InputComp label={fieldLabels[field]} name={field} type="number" {form} min="0" {errors} />
		{/each}

		<InputComp
			label="Adjustment Reason"
			name="reason"
			type="textarea"
			placeholder="Enter a reason for the adjustment"
			{form}
			{errors}
		/>
		<InputComp label="Banks" name="bank" type="combo" items={banks} {form} {errors} />

		<InputComp label="Bank Reciept" name="reciept" type="file" {form} {errors} />

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" />

				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
