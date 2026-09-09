<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { EditContract } from './schema';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		id,
		service,
		contractDate,
		contractYear,
		startDate,
		endDate,
		contractFile,
		monthlyAmount,
		status,
		commissionConsidered,
		signingOfficer,
		serviceList,
		icon
	}: {
		data: SuperValidated<Infer<EditContract>>;
		id: number;
		service: number;
		contractDate: Date;
		contractYear: number | string;
		startDate: Date;
		endDate: Date;
		contractFile: string;
		monthlyAmount: number | string;
		commissionConsidered: boolean;
		signingOfficer?: number;
		serviceList: Item[];
		status: boolean;
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		invalidateAll: true
	});
	import { toast } from 'svelte-sonner';
	import type { EditContact } from './schema';
	import type { Item } from '$lib/global.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.id = id;
	$form.service = service;
	$form.contractDate = contractDate.toLocaleDateString('en-CA');
	$form.startDate = startDate.toLocaleDateString('en-CA');
	$form.endDate = endDate.toLocaleDateString('en-CA');
	$form.contractYear = Number(contractYear);
	$form.monthlyAmount = Number(monthlyAmount);
	$form.commissionConsidered = commissionConsidered;
	$form.signingOfficer = signingOfficer ?? null;
	$form.status = status;
</script>

<DialogComp
	title="Edit {contractYear} Contract"
	variant="ghost"
	triggerClass="justify-self-start p-0!"
>
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{contractYear}
			{/if}
		</Button>
	{/snippet}
	<form
		id="main"
		action="?/editContract"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<input hidden bind:value={$form.id} name="id" />
		<InputComp
			label="Service Contracted"
			name="service"
			type="combo"
			{form}
			{errors}
			required
			items={serviceList}
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
			required
			placeholder="Enter signing date"
		/>
		<InputComp
			label="Contract File"
			name="contractFile"
			type="file"
			{form}
			{errors}
			required
			image={contractFile}
			placeholder="Upload contract pdf or image"
		/>

		<InputComp
			label="Office Commission"
			name="commissionConsidered"
			type="select"
			{form}
			{errors}
			required={true}
			items={[
				{
					value: true,
					name: 'Yes, Calculate commission for Office Workers for this contract'
				},
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

		<Errors allErrors={$allErrors} />
		<Button type="submit" class="w-full" form="main" variant="default">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" />
				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
