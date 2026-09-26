<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Pen } from '@lucide/svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	// `Infer<>` needs the zod schema itself; importing the already inferred type
	// and wrapping it again leaves every `$form.x` untyped.
	import { inventoryAdjustmentFormSchema } from '$lib/ZodSchema';
	import { createForm } from '$lib/forms/createForm';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import type { Item } from '$lib/global.svelte';

	type PaymentMethodOption = { value: number; name: string | null; balance: string | null };

	let isOpen = $state(false);

	let {
		data,
		name = 'product',
		employees,
		paymentMethods = [],
		suppliers = [],
		tracksExpiry = false
	}: {
		data: SuperValidated<Infer<typeof inventoryAdjustmentFormSchema>>;
		name: string;
		employees?: Item[];
		/** Accounts a purchase can be paid from, with their recorded balances. */
		paymentMethods?: PaymentMethodOption[];
		/** Who a delivery can have come from. */
		suppliers?: Item[];
		/** The item carries an expiry date on every delivery; the date is then required. */
		tracksExpiry?: boolean;
	} = $props();

	// Seeded once from the load; the toast comes from `createForm` (CLAUDE.md §13).
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(
		data,
		inventoryAdjustmentFormSchema,
		{
			onUpdated({ form }) {
				if (form.message?.type === 'success') isOpen = false;
			}
		}
	);

	/** What this purchase costs. Only an `add` with a unit cost spends money. */
	let cost = $derived(
		$form.intent === 'add' ? Number($form.quantity ?? 0) * Number($form.costPerItem ?? 0) : 0
	);
</script>

<DialogComp title="Change Quantity of {name}" variant="default" IconComp={Pen} bind:open={isOpen}>
	<h5 class="text-center">Change {name} Quantity</h5>
	<div class="flex flex-col items-center justify-center gap-4 pt-4">
		<form
			method="post"
			action="?/adjust"
			use:enhance
			class="flex w-full flex-col gap-3"
			enctype="multipart/form-data"
		>
			<Errors allErrors={$allErrors} />
			<InputComp
				label="Add or Remove"
				name="intent"
				type="select"
				required={true}
				{form}
				{errors}
				items={[
					{ value: 'add', name: '+ Add' },
					{ value: 'remove', name: '- Remove' }
				]}
			/>

			<InputComp
				label="Quantity of Change"
				name="quantity"
				type="number"
				{form}
				{errors}
				placeholder="Enter Quantity"
				required={true}
			/>
			<InputComp
				label="Reason"
				name="reason"
				type="textarea"
				{form}
				{errors}
				placeholder="Enter Quantity"
				required={true}
			/>
			<InputComp
				label="Employee Responsible"
				name="employeeResponsible"
				type="combo"
				{form}
				{errors}
				placeholder="Enter Quantity"
				required={true}
				items={employees}
			/>

			{#if $form.intent === 'add'}
				<InputComp
					label="Cost per Unit"
					name="costPerItem"
					type="number"
					{form}
					{errors}
					placeholder="Enter Cost per Unit"
					required={true}
				/>

				<!-- The delivery itself: what lands on the lot this receipt creates. -->
				<InputComp
					label={tracksExpiry ? 'Expiry date' : 'Expiry date, if it has one'}
					name="expiryDate"
					type="date"
					{form}
					{errors}
					required={tracksExpiry}
					oldDays={false}
				/>
				<InputComp
					label="Lot or batch number"
					name="batchNumber"
					{form}
					{errors}
					placeholder="As printed on the box"
					required={false}
				/>
				{#if suppliers.length}
					<InputComp
						label="Supplier"
						name="supplierId"
						type="select"
						{form}
						{errors}
						items={suppliers}
						required={false}
					/>
				{/if}

				{#if cost > 0}
					<InputComp
						label="Paid From"
						name="paymentMethod"
						type="select"
						{form}
						{errors}
						required={true}
						items={paymentMethods.map((m) => ({
							value: m.value,
							name: m.name ?? 'Unnamed method'
						}))}
					/>
				{/if}

				<InputComp
					label="Reciept of Change"
					name="reciept"
					type="file"
					{form}
					{errors}
					required={false}
				/>
			{/if}

			<Button type="submit" variant="default" size="lg">
				{#if $delayed}
					<LoadingBtn name="Changing" />
				{:else}
					<Pen /> Change Quantity
				{/if}
			</Button>
		</form>
	</div>
</DialogComp>
