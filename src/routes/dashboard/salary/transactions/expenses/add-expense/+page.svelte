<script lang="ts">
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '@nahu/admin-kit/components/ui/textarea/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Plus, Upload, X } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { insertExpenseSchema as expensesSchema } from './expenseSchema';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, message, capture, restore } = createForm(
		data.form,
		expensesSchema,
		{
			taintedMessage: confirmLeave
		}
	);

	export const snapshot: Snapshot = { capture, restore };
</script>

<svelte:head>
	<title>Add New Other Expense</title>
</svelte:head>

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add an Other Expense</Card.Title>
		<Card.Description>Add a new other expense that is not a sale.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			use:enhance
			action="?/addExpense"
			id="main"
			class="flex flex-col gap-4"
			method="post"
			enctype="multipart/form-data"
		>
			<InputComp {form} {errors} type="date" name="expenseDate" label="Other Expense Date" />
			<InputComp
				{form}
				{errors}
				type="combo"
				name="paymentMethod"
				label="Payment Method"
				items={data?.paymentMethods}
			/>
			<InputComp
				{form}
				{errors}
				type="combo"
				name="type"
				label="Other Expense Type"
				items={data?.categories}
			/>
			<InputComp
				{form}
				{errors}
				type="textarea"
				name="description"
				label="Other Expense Description (optional)"
				placeholder="Enter added product description"
			/>
			<InputComp {form} {errors} type="number" name="total" label="Amount Fee" min="0" />

			<InputComp {form} {errors} type="file" name="reciept" label="Reciept" min="0" />

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Expense" />
				{:else}
					<Plus class="h-4 w-4" />
					Add Other Expense
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
