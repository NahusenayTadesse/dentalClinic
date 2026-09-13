<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import { type Item } from '$lib/global.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { editAddress, type EditAddress } from './schema';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';

	type Address = {
		id: number | null;
		subcityId?: number | null;
		otherSubcity?: string | null;
		street?: string | null;
		subcity?: string | null;
		kebele?: string | null;
		buildingNumber?: string | null;
		floor?: number | null;
		houseNumber?: number | null;
		status: boolean;
	};

	let {
		data,
		address,
		subcityList
	}: {
		data: SuperValidated<EditAddress>;
		address: Address;
		subcityList: Item[];
	} = $props();

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editAddress, {
		resetForm: false, // Resets form to initial 'data' after successful submit
		invalidateAll: true
	});
	// Optional like every line below it. Without the `?.` an employee with no address on file —
	// any imported or seeded record — turned the whole detail page into a 500.
	$form.id = address?.id;
	$form.subcity = address?.subcityId ? address.subcityId : undefined;
	$form.street = address?.street ? address.street : undefined;
	$form.buildingNumber = address?.buildingNumber ? address.buildingNumber : undefined;
	$form.kebele = address?.kebele ? address.kebele : undefined;
	$form.floor = address?.floor ? address.floor : undefined;
	$form.houseNumber = address?.houseNumber ? address.houseNumber : undefined;
	$form.status = address?.status ? address.status : undefined;
</script>

<DialogComp title="Edit" variant="default" class="" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editAddress"
		class="flex w-full! min-w-full flex-col items-center justify-center gap-2"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<input type="hidden" name="id" bind:value={$form.id} />
		<InputComp label="Subcity" name="subcity" type="combo" {form} {errors} items={subcityList} />
		<InputComp label="Other Subcity" name="otherSubcity" type="text" {form} {errors} />

		<InputComp label="Street" name="street" type="text" {form} {errors} />
		<InputComp label="Kebele" name="kebele" type="text" {form} {errors} />
		<InputComp label="Building Name or Number" name="buildingNumber" type="text" {form} {errors} />
		<InputComp label="Floor" name="floor" type="number" {form} {errors} />
		<InputComp label="House Number" name="houseNumber" type="text" {form} {errors} />
		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: 'Active' },
				{ value: false, name: 'Inactive' }
			]}
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
