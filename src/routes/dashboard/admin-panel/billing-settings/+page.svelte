<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { billingSettings } from './schema';

	/** The clinic's billing settings: how big a discount needs a manager, and its tax standing. */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, billingSettings, {
		resetForm: false
	});
</script>

<svelte:head>
	<title>Billing Settings</title>
</svelte:head>

<FormCard title="Billing settings">
	<form method="post" use:enhance class="flex flex-col gap-4">
		<InputComp
			label="Discounts over this share of a bill need a manager (%)"
			name="discountApprovalPercent"
			type="number"
			step="0.5"
			min="0"
			max="100"
			{form}
			{errors}
			description="A bill discounted by more waits in Approvals → Discounts and Voids, and takes no payment until a manager agrees. 0 sends every discount; 100 sends none."
		/>
		<InputComp
			label="The clinic's TIN"
			name="tin"
			{form}
			{errors}
			required={false}
			placeholder="0012345678"
			description="Printed on every bill and receipt."
		/>
		<InputComp
			label="VAT"
			name="vatRegistered"
			type="checkboxSingle"
			placeholder="The clinic is registered for VAT"
			{form}
			{errors}
		/>
		{#if $form.vatRegistered}
			<InputComp
				label="VAT rate (%)"
				name="vatRate"
				type="number"
				step="0.5"
				min="0"
				max="100"
				{form}
				{errors}
			/>
			<InputComp
				label="Treatment"
				name="vatOnServices"
				type="checkboxSingle"
				placeholder="Charge VAT on treatment as well as on goods sold"
				{form}
				{errors}
				description="Off: only goods sold (a line marked VAT applies) carry VAT, since medical services are exempt as this system understands Ethiopian VAT law. Ask your accountant; a change applies to bills issued from now on."
			/>
		{/if}
		<Button type="submit">
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save{/if}
		</Button>
	</form>
</FormCard>
