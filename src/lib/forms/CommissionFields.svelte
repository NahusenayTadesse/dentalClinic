<script lang="ts">
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { SuperForm } from 'sveltekit-superforms';

	/**
	 * Whether a salary earns commission, and at what rate — shared by registering an employee and
	 * changing their salary, which carried the same block twice.
	 *
	 * The rate is a percentage of the fees of the work the employee completes in the month, which
	 * the payroll run adds to their pay (`server/commission.ts`). Both copies used to appear only
	 * for a department flagged "office staff", a flag that decides who can hold a user account and
	 * has nothing to do with commission — so a dentist in a clinical department could never be given
	 * a rate at all.
	 */
	let {
		form,
		errors
	}: {
		/** The superForm stores, passed straight through to `InputComp`. */
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
	} = $props();
</script>

<InputComp
	label="Commission"
	name="officeCommission"
	{form}
	{errors}
	type="select"
	items={[
		{ value: false, name: 'No' },
		{ value: true, name: 'Yes' }
	]}
	required
	placeholder="Earns a share of the fees for work they complete"
/>

{#if $form.officeCommission}
	<InputComp
		label="Commission (% of the fees of work they complete)"
		name="percentage"
		{form}
		{errors}
		type="number"
		max="50"
		required
	/>
{/if}
