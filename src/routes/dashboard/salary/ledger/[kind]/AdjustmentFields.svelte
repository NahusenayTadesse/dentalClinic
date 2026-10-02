<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import type { LedgerMeta } from '$lib/payrollLedger';

	/**
	 * The fields an adjustment asks for, by kind: overtime is a type and hours (priced on the
	 * server), the others an amount, and a deduction says what kind and why. Shared by the record
	 * and the change dialogs, which differ only in who it is for.
	 */
	let {
		meta,
		types,
		form,
		errors
	}: {
		meta: LedgerMeta;
		/** Overtime types, with their rate and limit in the name. */
		types: { value: string; name: string }[];
		form: ComponentProps<typeof InputComp>['form'];
		errors: ComponentProps<typeof InputComp>['errors'];
	} = $props();
</script>

<InputComp label="Date" name="date" type="date" {form} {errors} allowEmpty={false} />
{#if meta.priced === 'hours'}
	<InputComp label="Overtime type" name="typeId" type="select" items={types} {form} {errors} />
	<InputComp label="Hours" name="hours" type="number" min={0} step={0.5} {form} {errors} />
{:else}
	{#if meta.typeLabel}
		<InputComp
			label={meta.typeLabel}
			name="type"
			placeholder="Penalty · Advance repayment · Damage"
			{form}
			{errors}
		/>
	{/if}
	<InputComp label="Amount (birr)" name="amount" type="number" min={0} {form} {errors} />
{/if}
<InputComp
	label="Reason"
	name="reason"
	type="textarea"
	required={meta.effect === 'takes'}
	{form}
	{errors}
/>
