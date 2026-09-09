<script lang="ts">
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';

	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { addContract } from './schema';

	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let { data } = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data.form, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		},
		validators: zod4Client(addContract)
	});
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

<FormCard title="Add New Contract" className="w-full!">
	<form
		action="?/addContract"
		use:enhance
		method="post"
		id="edit"
		class="grid w-full grid-cols-1 gap-4 p-2 pt-8 lg:grid-cols-2"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Site To Be Contracted"
			name="site"
			type="combo"
			{form}
			{errors}
			required
			items={data?.siteList}
		/>

		<InputComp
			label="Service Contracted"
			name="service"
			type="combo"
			{form}
			{errors}
			required
			items={data?.serviceList}
		/>
		<InputComp
			label="Monthly Amount"
			name="monthlyAmount"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter monthly Amount"
		/>
		<InputComp
			label="Contract Start Date"
			name="startDate"
			type="date"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter start date"
		/>
		<InputComp
			label="Contract End Date"
			name="endDate"
			type="date"
			{form}
			year={true}
			{errors}
			required
			placeholder="Enter end date"
		/>
		<InputComp
			label="Contract Year"
			name="contractYear"
			type="number"
			{form}
			min="1900"
			max="2099"
			{errors}
			required
			placeholder="Enter end date"
		/>

		<InputComp
			label="Contract Signing Date"
			name="contractDate"
			type="date"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter signing date"
		/>

		<InputComp
			label="Office Commission"
			name="commissionConsidered"
			type="select"
			{form}
			{errors}
			required={true}
			items={[
				{ value: true, name: 'Yes, Calculate commission for Office Workers for this contract' },
				{
					value: false,
					name: 'No, Do not calculate commission for Office Workers for this contract'
				}
			]}
		/>

		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={isActives}
		/>

		<InputComp
			label="Signing Officer"
			name="signingOfficer"
			type="combo"
			{form}
			{errors}
			required
			items={data?.employeeList}
		/>
		<InputComp
			label="Contract File"
			name="contractFile"
			type="file"
			{form}
			{errors}
			required
			placeholder="Upload contract pdf or image"
		/>

		<Button type="submit" class="col-span-2 mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Contract" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Contract
			{/if}
		</Button>
	</form>
</FormCard>
