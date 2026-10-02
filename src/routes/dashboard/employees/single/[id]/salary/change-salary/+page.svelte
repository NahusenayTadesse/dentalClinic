<script lang="ts">
	import CommissionFields from '$lib/forms/CommissionFields.svelte';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import { Pen, Percent, Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { salaryChangeSchema as schema } from './schema';
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { formatETB } from '$lib/global.svelte';
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors, capture, restore } = createForm(
		data.form,
		schema,
		{
			taintedMessage: confirmLeave,
			resetForm: false
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	// What they are paid now; the new amount is worked out from it.
	const current = $derived(data.currentSalary);
	let percentage = $state(0);
	let amount = $state(0);

	let byPercent = $state(true);

	//   let newPercetage =
	function onclick() {
		byPercent = !byPercent;
		$form.amount = Number(current);
	}

	function oninput() {
		if (byPercent) $form.amount = (percentage / 100) * Number(current) + Number(current);
		else $form.amount = amount + Number(current);
	}
</script>

<svelte:head>
	<title>Change Salary or Branch</title>
</svelte:head>

<FormCard title="Change Salary, Branch, Position or Department for {data.name}">
	<div class="flex flex-col gap-4">
		<div class="flex flex-row gap-2">
			<Button variant={byPercent ? 'default' : 'outline'} {onclick}
				><Percent /> Increase By Percentage</Button
			>
			<Button variant={!byPercent ? 'default' : 'outline'} {onclick}
				><Plus /> Increase By Amount</Button
			>
		</div>

		<div class="flex flex-col gap-4">
			{#if byPercent}
				<Label>Increase By Percentage</Label>

				<Input type="number" {oninput} bind:value={percentage}></Input>
			{:else}
				<Label>Increase By Amount</Label>

				<Input type="number" {oninput} step="100" bind:value={amount}></Input>
			{/if}
		</div>
		<!-- Amount field with built-in calculator -->

		<form use:enhance action="?/changeSalary" id="main" class="flex flex-col gap-4" method="post">
			<Errors allErrors={$allErrors} />

			<h4>
				Current Salary <bold class="font-bold!">{formatETB(data.currentSalary)}</bold>
			</h4>
			<h5>
				Calculating New Salary By <bold class="font-bold! text-red-500">
					{byPercent ? 'Percentage' : 'Amount'}</bold
				>
			</h5>

			<InputComp
				{form}
				{errors}
				name="branch"
				label="Branch"
				type="combo"
				items={data?.branches}
				placeholder="Enter the amount"
				required
			/>

			<InputComp
				{form}
				{errors}
				name="department"
				label="Department"
				type="combo"
				items={data?.departments}
				placeholder="Enter the amount"
				required
			/>
			<InputComp
				{form}
				{errors}
				name="position"
				label="Position"
				type="combo"
				items={$form.department
					? data.positions.filter((p) => p.departmentId === Number($form.department))
					: [{ value: '', name: 'Select a Department First' }]}
				placeholder="Enter the amount"
				required
			/>

			<CommissionFields {form} {errors} />

			<InputComp
				{form}
				{errors}
				name="changeReason"
				label="Change Reason"
				type="textarea"
				placeholder="Enter the reason for this change"
			/>

			<InputComp
				{form}
				{errors}
				name="amount"
				label="New Salary Amount"
				type="number"
				placeholder="Enter the amount"
				required
			/>

			<InputComp
				{form}
				{errors}
				name="housingAllowance"
				label="New Housing Allowance"
				type="number"
				placeholder="Enter the amount"
				required
			/>

			<InputComp
				{form}
				{errors}
				name="transportationAllowance"
				label="New Transportation Allowance"
				type="number"
				placeholder="Enter the amount"
				required
			/>

			<InputComp
				{form}
				{errors}
				name="positionAllowance"
				label="New Position Allowance"
				type="number"
				placeholder="Enter the amount"
				required
			/>
			<InputComp
				{form}
				{errors}
				name="nonTaxAllowance"
				label="New Non Tax Allowance:"
				type="number"
				placeholder="Enter the amount"
				required
			/>

			<InputComp
				{form}
				{errors}
				name="date"
				label="Start Date of New Salary:"
				type="date"
				required
			/>

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Updating Salary" />
				{:else}
					<Pen class="h-4 w-4" />
					Change Salary
				{/if}
			</Button>
		</form>
	</div>
</FormCard>
