<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Plus, Upload, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { insertExpenseSchema as expensesSchema } from './expenseSchema';
	import { superForm, fileProxy } from 'sveltekit-superforms/client';
	import RiskAcknowledgement from '$lib/formComponents/RiskAcknowledgement.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	let { data } = $props();

	let acknowledgeOverdraft = $state(false);

	const { form, errors, enhance, delayed, message, capture, restore } = superForm(data.form, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		},

		validators: zod4Client(expensesSchema)
	});

	let selectedBank = $derived(
		data?.banks?.find((bank: { value: number }) => bank.value === Number($form.bank))
	);

	/** Mirrors the server's check so the warning appears before submitting. */
	let overdraws = $derived(
		Number($form.total ?? 0) > 0 && selectedBank
			? Number(selectedBank.balance ?? 0) - Number($form.total ?? 0) < 0
			: false
	);

	const money = (value: number) =>
		value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
			<InputComp {form} {errors} type="combo" name="bank" label="Bank" items={data?.banks} />
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

			{#if selectedBank}
				<p class="-mt-1 text-xs text-muted-foreground">
					Recorded balance: {money(Number(selectedBank.balance ?? 0))}
				</p>
			{/if}

			<RiskAcknowledgement
				show={overdraws}
				name="acknowledgeOverdraft"
				bind:checked={acknowledgeOverdraft}
				title="This account does not have that much recorded"
				message="Recording it takes the balance to {money(
					Number(selectedBank?.balance ?? 0) - Number($form.total ?? 0)
				)}. These balances are a bookkeeping aid, not a live bank feed, so the expense is allowed; just make sure it is what you mean."
			/>
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
