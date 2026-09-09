<script lang="ts">
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	const genders = [
		{ value: 'male', name: 'Male' },
		{ value: 'female', name: 'Female' }
	];

	let {
		data,
		name,
		phone,
		email,
		tinNo,
		status
	}: {
		data: SuperValidated<Infer<EditDetail>>;
		name?: string;
		phone?: string;
		email?: string;
		tinNo?: string;
		status?: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		invalidateAll: true
	});
	import { toast } from 'svelte-sonner';
	import type { EditDetail } from './schema';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	$form.name = name;
	$form.email = email;
	$form.tinNo = tinNo;
	$form.phone = phone;
	$form.status = status;
</script>

<DialogComp title="Edit" variant="default" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editDetail"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />

		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Name"
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Phone"
		/>
		<InputComp
			label="Email"
			name="email"
			type="email"
			{form}
			{errors}
			required={false}
			placeholder="Enter Customer Email"
		/>

		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Status"
			items={[
				{ value: true, name: 'Active' },
				{ value: false, name: 'InActive' }
			]}
		/>

		<InputComp
			label="Tin Number"
			name="tinNo"
			type="number"
			{form}
			{errors}
			required={true}
			placeholder="Enter Customer Tin Number"
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
