<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	import type { SuperValidated } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import type { Item } from '$lib/global.svelte';
	import { editAccount, type EditAccount } from './schema';

	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		id,
		paymentMethods,
		paymentMethodId,
		accountDetail,
		name,
		status,
		icon
	}: {
		data: SuperValidated<EditAccount>;
		id: number;
		name: string;
		paymentMethods: Item[];
		paymentMethodId: number;
		accountDetail: string;
		status: boolean;
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editAccount, {
		resetForm: false,
		invalidateAll: true
	});

	let disabled = $state(false);
	let prevPaymentMethod = $state($form.paymentMethodId);

	$effect(() => {
		const current = $form.paymentMethodId;

		if (current !== prevPaymentMethod) {
			if (current === 8) {
				$form.accountDetail = 'No Account';
				disabled = true;
			} else {
				if (prevPaymentMethod === 8) {
					$form.accountDetail = '';
				}
				disabled = false;
			}
			prevPaymentMethod = current;
		}
	});

	$form.id = id;
	$form.paymentMethodId = paymentMethodId;
	$form.accountDetail = accountDetail;
	$form.status = status;
	prevPaymentMethod = paymentMethodId;
	disabled = paymentMethodId === 8;
</script>

<DialogComp title={icon ? 'Edit' : name} variant="ghost" IconComp={icon ? SquarePen : undefined}>
	<form
		id="main"
		action="?/editAccount"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
	>
		<input type="hidden" bind:value={$form.id} name="id" />
		<InputComp
			label="Bank"
			name="paymentMethodId"
			type="select"
			{form}
			{errors}
			required
			items={paymentMethods}
		/>
		<InputComp
			label="Account Detail"
			name="accountDetail"
			type="text"
			{form}
			{errors}
			required
			placeholder="Enter Account Details"
		/>
		<input type="hidden" name="accountDetail" bind:value={$form.accountDetail} />

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
