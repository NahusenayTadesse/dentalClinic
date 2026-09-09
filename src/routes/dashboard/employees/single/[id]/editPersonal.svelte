<script lang="ts">
	import { type Item } from '$lib/global.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { type EditEmployment } from './schema';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	const maritalStatuses = ['single', 'married', 'widowed', 'divorced', 'other'].map((v) => ({
		value: v,
		name: v.charAt(0).toUpperCase() + v.slice(1)
	}));
	const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
		value: v,
		name: v
	}));
	let {
		data,
		tinNo,
		martialStatus,
		bloodType
	}: {
		data: SuperValidated<Infer<EditEmployment>>;
		tinNo: string;
		martialStatus: string;
		bloodType?: string;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
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

	$form.tinNo = tinNo;
	$form.martialStatus = martialStatus;
	$form.bloodType = bloodType || '';
</script>

<DialogComp title="Edit" variant="default" class="" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editPersonal"
		class="flex w-full! min-w-full flex-col items-center justify-center gap-2"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<InputComp label="Tin Number" name="tinNo" type="text" {form} {errors} />

		<InputComp
			label="Martial Status   "
			name="martialStatus"
			type="select"
			{form}
			{errors}
			required
			items={maritalStatuses}
		/>
		<InputComp
			label="Blood Type"
			name="bloodType"
			type="select"
			{form}
			{errors}
			required={false}
			items={bloodTypes}
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
