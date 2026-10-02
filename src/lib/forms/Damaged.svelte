<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { PackageX as Minus } from '@lucide/svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { damagedFormSchema } from '$lib/ZodSchema';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import type { Item } from '$lib/global.svelte';

	let isOpen = $state(false);

	let {
		data,
		name = 'item',
		employees
	}: {
		data: SuperValidated<Infer<typeof damagedFormSchema>>;
		name: string;
		employees?: Item[];
	} = $props();

	// Seeded once from the load; the toast comes from `createForm` (CLAUDE.md §13).
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, damagedFormSchema, {
		onUpdated({ form }) {
			if (form.message?.type === 'success') isOpen = false;
		}
	});
</script>

<DialogComp title="{name} Damaged" variant="destructive" IconComp={Minus} bind:open={isOpen}>
	<div class="flex flex-col items-center justify-center gap-4 pt-4">
		<form method="post" action="?/damaged" use:enhance class="flex w-full flex-col gap-3">
			<InputComp
				label="Damaged Quantity"
				name="quantity"
				type="number"
				{form}
				{errors}
				placeholder="Enter number of items damaged"
				required={true}
			/>
			<InputComp
				label="Reason"
				name="reason"
				type="textarea"
				{form}
				{errors}
				placeholder="Enter explanation for the damage"
				required={true}
			/>
			<InputComp
				label="Employee responsible, if it is to be deducted"
				name="damagedBy"
				type="combo"
				{form}
				{errors}
				placeholder="Choose an employee"
				required={false}
				items={employees}
			/>

			<InputComp
				label="Deductable"
				name="deductable"
				type="checkboxSingle"
				placeholder="Yes, deduct the cost from Employee"
				{form}
				{errors}
				required={false}
			/>
			<Errors allErrors={$allErrors} />
			<Button type="submit" variant="destructive" size="lg">
				{#if $delayed}
					<LoadingBtn name="Entering Damaged Item" />
				{:else}
					<Minus /> Enter Damaged Item
				{/if}
			</Button>
		</form>
	</div>
</DialogComp>
