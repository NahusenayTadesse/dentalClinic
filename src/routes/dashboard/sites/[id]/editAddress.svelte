<script lang="ts">
	import { type Item } from '$lib/global.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { type EditAddress } from './schema';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';

	type Address = {
		id: number | null;
		subcityId?: number | null;
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
		data: SuperValidated<Infer<EditAddress>>;
		address: Address;
		subcityList: Item[];
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false, // Resets form to initial 'data' after successful submit
		invalidateAll: true
	});
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
	$form.id = address.id;
	$form.subcity = address?.subcityId;
	$form.street = address?.street;
	$form.buildingNumber = address?.buildingNumber;
	$form.kebele = address?.kebele;
	$form.floor = address?.floor;
	$form.houseNumber = address?.houseNumber;
	$form.status = address?.status;
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
		<InputComp
			label="Subcity"
			name="subcity"
			type="combo"
			{form}
			{errors}
			required
			items={subcityList}
		/>
		<InputComp label="Street" name="street" type="text" {form} {errors} required />
		<InputComp label="Kebele" name="kebele" type="text" {form} {errors} required />
		<InputComp
			label="Building Name or Number"
			name="buildingNumber"
			type="text"
			{form}
			{errors}
			required
		/>
		<InputComp label="Floor" name="floor" type="number" {form} {errors} required />
		<InputComp label="House Number" name="houseNumber" type="text" {form} {errors} required />
		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
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
