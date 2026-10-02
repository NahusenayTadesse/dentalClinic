<script lang="ts">
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	import { Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { customerSchema as schema } from './schema';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, capture, restore } = createForm(
		data.form,
		schema,
		{
			taintedMessage: confirmLeave
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
</script>

<svelte:head>
	<title>Add a Payer</title>
</svelte:head>

<FormCard
	title="Add a payer"
	description="An employer or insurer that pays some patients' bills. A patient's payer is chosen on their registration; each bill can be sent to one."
>
	<form use:enhance action="?/addCustomer" id="main" class="flex flex-col gap-4" method="POST">
		<Errors allErrors={$allErrors} />

		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Payer's Name"
		/>
		<InputComp
			label="Email"
			name="email"
			type="email"
			{form}
			{errors}
			required={false}
			placeholder="Payer's Email"
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			required={true}
			placeholder="Payer's Phone"
		/>

		<InputComp
			label="Tin Number"
			name="tinNo"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Payer's Tin Number"
		/>

		<InputComp
			label="Subcity"
			name="subcity"
			type="combo"
			{form}
			{errors}
			required={true}
			placeholder="Payer's Subcity"
			items={data?.subcityList}
		/>

		<InputComp
			label="Sefer"
			name="street"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Payer's Sefer"
		/>
		<InputComp
			label="Kebele"
			name="kebele"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Payer's Kebele"
		/>
		<InputComp
			label="Building Name"
			name="buildingNumber"
			type="text"
			{form}
			{errors}
			required={false}
			placeholder="Payer's Building Name"
		/>

		<InputComp
			label="Floor"
			name="floor"
			type="number"
			{form}
			{errors}
			required={false}
			placeholder="Payer's Floor Number"
		/>

		<InputComp
			label="House or Office Number"
			name="houseNumber"
			type="number"
			{form}
			{errors}
			required={false}
			placeholder="Payer's House or Office Number"
		/>

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding the payer" />
			{:else}
				<Plus class="h-4 w-4" />

				Add the payer
			{/if}
		</Button>
	</form>
</FormCard>
