<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import ProcedurePicker from '$lib/components/ProcedurePicker.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { addCharge, addWork, type AddCharge, type AddWork } from '../schema';

	/**
	 * What can be added to a draft bill: more completed work, or a charge that is not charted work.
	 * Two dialogs the bill page opens from its buttons; out of the page because it had grown past
	 * its size limit (CLAUDE.md §6) and these are one concern.
	 */
	let {
		workOpen = $bindable(false),
		chargeOpen = $bindable(false),
		workForm,
		chargeForm,
		unbilled,
		vatRegistered,
		draft
	}: {
		workOpen?: boolean;
		chargeOpen?: boolean;
		workForm: SuperValidated<AddWork>;
		chargeForm: SuperValidated<AddCharge>;
		unbilled: { id: number; service: string | null; where: string; price: number }[];
		vatRegistered: boolean;
		draft: boolean;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.bill);
</script>

<FormDialog
	title={w.addWorkTitle}
	action="?/addWork"
	data={workForm}
	schema={addWork}
	bind:open={workOpen}
	hideTrigger
	resetOnSuccess
	submitLabel={w.addToBill}
	disabled={!draft}
>
	{#snippet fields({ form })}
		<ProcedurePicker {form} work={unbilled} legend={t.m.billing.tab.completedWork}>
			{#snippet empty()}{w.nothingElse}{/snippet}
		</ProcedurePicker>
	{/snippet}
</FormDialog>

<FormDialog
	title={w.addCharge}
	description={w.chargeDescription}
	action="?/addCharge"
	data={chargeForm}
	schema={addCharge}
	bind:open={chargeOpen}
	hideTrigger
	resetOnSuccess
	submitLabel={w.addChargeSubmit}
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label={w.whatFor}
			name="description"
			{form}
			{errors}
			placeholder={w.whatForPlaceholder}
		/>
		<InputComp label={w.quantity} name="quantity" type="number" step="1" min="1" {form} {errors} />
		<InputComp
			label={w.priceEach}
			name="unitPrice"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
		{#if vatRegistered}
			<InputComp
				label={w.chargeTaxable}
				name="taxable"
				type="checkboxSingle"
				placeholder={w.chargeTaxableHint}
				{form}
				{errors}
			/>
		{/if}
	{/snippet}
</FormDialog>
