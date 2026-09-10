<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Pen } from '@lucide/svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	// `Infer<>` needs the zod schema itself; importing the already inferred type
	// and wrapping it again leaves every `$form.x` untyped.
	import type { inventoryAdjustmentFormSchema } from '$lib/ZodSchema';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { toast } from 'svelte-sonner';
	import type { Item } from '$lib/global.svelte';

	type PaymentMethodOption = { value: number; name: string | null; balance: string | null };

	let isOpen = $state(false);

	let {
		data,
		name = 'product',
		employees,
		paymentMethods = []
	}: {
		data: SuperValidated<Infer<typeof inventoryAdjustmentFormSchema>>;
		name: string;
		employees?: Item[];
		/** Accounts a purchase can be paid from, with their recorded balances. */
		paymentMethods?: PaymentMethodOption[];
	} = $props();

	const { form, errors, enhance, delayed, message } = superForm(data, {});

	/** What this purchase costs. Only an `add` with a unit cost spends money. */
	let cost = $derived(
		$form.intent === 'add' ? Number($form.quantity ?? 0) * Number($form.costPerItem ?? 0) : 0
	);

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

				{#if cost > 0}
					<InputComp
						label="Paid From"
						name="paymentMethod"
						type="select"
						{form}
						{errors}
						required={true}
						items={paymentMethods}
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
