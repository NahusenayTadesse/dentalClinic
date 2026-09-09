<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { customerSchema as schema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import Errors from '$lib/formComponents/Errors.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, capture, restore, message } = superForm(
		data.form,
		{
			taintedMessage: () => {
				return new Promise((resolve) => {
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
				});
			},
			validators: zod4Client(schema)
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	import { toast } from 'svelte-sonner';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
</script>

<svelte:head>
	<title>Add New Customer</title>
</svelte:head>

<FormCard title="Add New Customer" description="Add a new customer to the system">
	<form use:enhance action="?/addCustomer" id="main" class="flex flex-col gap-4" method="POST">
		<Errors allErrors={$allErrors} />

		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Name"
		/>
		<InputComp
			label="Email"
			name="email"
			type="email"
			{form}
			{errors}
			required={false}
			placeholder="Enter Customer Email"
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Phone"
		/>

		<InputComp
			label="Tin Number"
			name="tinNo"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Tin Number"
		/>

		<InputComp
			label="Subcity"
			name="subcity"
			type="combo"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Subcity"
			items={data?.subcityList}
		/>

		<InputComp
			label="Sefer"
			name="street"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Sefer"
		/>
		<InputComp
			label="Kebele"
			name="kebele"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Kebele"
		/>
		<InputComp
			label="Building Name"
			name="buildingNumber"
			type="text"
			{form}
			{errors}
			required={false}
			placeholder="Enter Customer Building Name"
		/>

		<InputComp
			label="Floor"
			name="floor"
			type="number"
			{form}
			{errors}
			required={false}
			placeholder="Enter Customer Floor Number"
		/>

		<InputComp
			label="House or Office Number"
			name="houseNumber"
			type="number"
			{form}
			{errors}
			required={false}
			placeholder="Enter Customer House or Office Number"
		/>

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding Customer" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Customer
			{/if}
		</Button>
	</form>
</FormCard>
