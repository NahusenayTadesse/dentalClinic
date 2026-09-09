<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import DatePicker2 from '$lib/formComponents/DatePicker2.svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { deductionSchema as schema } from './deductions';
	import { superForm, fileProxy } from 'sveltekit-superforms/client';
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

	import InputComp from '$lib/formComponents/InputComp.svelte';

	export const snapshot: Snapshot = { capture, restore };

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
	<title>Add New Deduction</title>
</svelte:head>

{#snippet fe(
	label = '',
	name = '',
	type = '',
	placeholder = '',
	required = false,
	min = '',

	max = ''
)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name}>{label}</Label>
		<Input
			{type}
			{name}
			{placeholder}
			{required}
			{min}
			{max}
			bind:value={$form[name]}
			aria-invalid={$errors[name] ? 'true' : undefined}
		/>
		{#if $errors[name]}
			<span class="text-red-500">{$errors[name]}</span>
		{/if}
	</div>
{/snippet}

{#snippet date(name, title)}
	<Label for={name} class="capitalize">{title}</Label>

	<DatePicker2 bind:data={$form[name]} oldDays={true} />
	<input type="hidden" {name} bind:value={$form[name]} />
	{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
{/snippet}

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add a Deduction on {data.salaryDetail.name}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form
			use:enhance
			action="?/addDeduction"
			id="main"
			class="flex flex-col gap-4"
			method="post"
			enctype="multipart/form-data"
		>
			<Errors allErrors={$allErrors} />

			<InputComp {form} {errors} name="deductionDate" type="date" label="Deduction Date" required />
			<InputComp
				{form}
				{errors}
				name="type"
				type="select"
				label="Deduction Type"
				items={[
					{ value: 'Savings', name: 'Savings' },
					{ value: 'Penality', name: 'Penality' },
					{ value: 'Loan', name: 'Loan' }
				]}
				required
			/>

			<InputComp
				{form}
				{errors}
				name="amount"
				type="number"
				label="Amount Deducted"
				items={[
					{ value: 'Savings', name: 'Savings' },
					{ value: 'Penality', name: 'Penality' },
					{ value: 'Loan', name: 'Loan' }
				]}
				required
				placeholder="Enter the total amount of the deduction"
			/>
			<InputComp
				{form}
				{errors}
				name="description"
				type="textarea"
				label="Deduction Description(Optional)"
				placeholder="Enter added product description"
			/>

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Deductions" />
				{:else}
					<Plus class="h-4 w-4" />
					Add Deductions
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
