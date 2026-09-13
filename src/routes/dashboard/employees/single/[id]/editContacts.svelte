<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		id,
		contactType,
		contactDetail,
		status,
		icon
	}: {
		data: SuperValidated<EditContact>;
		id: number;
		contactType: string;
		contactDetail: string;
		status: boolean;
		icon: boolean;
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editContact, {
		resetForm: false,
		invalidateAll: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});
	import { editContact, type EditContact } from './schema';
	$form.id = id;
	$form.contactType = contactType;
	$form.contactDetail = contactDetail;
	$form.status = status;
</script>

<DialogComp
	bind:open
	title="Edit {contactDetail}"
	variant="ghost"
	triggerClass="justify-self-start p-0!"
>
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{contactType?.toUpperCase()}
			{/if}
		</Button>
	{/snippet}
	<form
		id="main"
		action="?/editContact"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
	>
		<input hidden bind:value={$form.id} name="id" />
		<InputComp
			label="Contact Type"
			name="contactType"
			type="select"
			{form}
			{errors}
			required
			items={[
				{ value: 'phone', name: 'Phone Number' },
				{ value: 'email', name: 'Email' },
				{ value: 'telegram', name: 'Telegram' },
				{ value: 'whatsapp', name: 'WhatsApp' },
				{ value: 'instagram', name: 'Instagram' }
			]}
		/>
		<InputComp
			label="Contact Detail"
			name="contactDetail"
			type={$form?.contactType === 'phone'
				? 'tel'
				: $form?.contactType === 'email'
					? 'email'
					: 'text'}
			{form}
			{errors}
			required
			placeholder={`Enter ${
				$form?.contactType
					? $form.contactType.charAt(0).toUpperCase() + $form.contactType.slice(1)
					: ''
			}`}
		/>

		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={isActives}
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
