<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Pen, Percent, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { salaryChangeSchema as schema } from './schema';
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
			validators: zod4Client(schema),
			resetForm: false
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	let current = data?.salaryDetail?.baseSalary;

	$form.amount = Number(data?.salaryDetail?.baseSalary);
	$form.housingAllowance = Number(data?.salaryDetail?.housingAllowance);
	$form.transportationAllowance = Number(data?.salaryDetail?.transportationAllowance);
	$form.nonTaxAllowance = Number(data?.salaryDetail?.nonTaxAllowance);
	$form.positionAllowance = Number(data?.salaryDetail?.positionAllowance);
	let percentage = $state(0);
	let amount = $state(0);

	let byPercent = $state(true);

	//   let newPercetage =
	function onclick() {
		byPercent = !byPercent;
		$form.amount = String(current);
	}

	function oninput() {
		if (byPercent) $form.amount = (percentage / 100) * Number(current) + Number(current);
		else $form.amount = amount + Number(current);
	}

	import { toast } from 'svelte-sonner';
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
	<title>Change Salary or Site</title>
</svelte:head>

<FormCard title="Change Salary, Site, Position or Department for {data.salaryDetail.name}">
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
				Current Salary <bold class="font-bold!"
					>ETB {Number(data.salaryDetail.baseSalary).toFixed(2)}</bold
				>
			</h4>
			<h5>
				Calculating New Salary By <bold class="font-bold! text-red-500">
					{byPercent ? 'Percentage' : 'Amount'}</bold
				>
			</h5>

			<InputComp
				{form}
				{errors}
				name="site"
				label="Site"
				type="combo"
				items={data?.sites}
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

			{#if data?.departments.find((d) => d.value === $form.department)?.commission}
				<InputComp
					label="Office Commission"
					name="officeCommission"
					{form}
					{errors}
					type="select"
					items={[
						{ value: false, name: 'No' },
						{ value: true, name: 'Yes' }
					]}
					required
					placeholder="This Employee Recieves Office Commission"
				/>

				{#if $form.officeCommission}
					<InputComp
						label="Commission Percentage"
						name="percentage"
						{form}
						{errors}
						max="50"
						type="number"
						required
					/>
				{/if}
			{/if}

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
