<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { RefreshCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	let {
		data,
		id,
		monthlyAmount,
		officers
	}: {
		data: SuperValidated<Infer<RenewContract>>;
		id: number;
		monthlyAmount: number | string;
		officers?: Item[];
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		invalidateAll: true
	});
	import { toast } from 'svelte-sonner';
	import type { RenewContract } from './schema';
	import type { Item } from '$lib/global.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.id = id;

	$form.renewalAmount = Number(monthlyAmount);
</script>

<DialogComp title="Renew Contract" variant="default" IconComp={RefreshCcw}>
	<form
		id="main"
		action="?/renewContract"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<input hidden bind:value={$form.id} name="id" />
		<InputComp
			label="Renewal Monthly Amount"
			name="renewalAmount"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter monthly Amount"
		/>
		<InputComp
			label="Contract Renewal Start Date"
			name="renewalStartDate"
			type="date"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter Renewal Start Date"
		/>
		<InputComp
			label="Contract Renewal End Date"
			name="renewalEndDate"
			type="date"
			{form}
			year={true}
			{errors}
			required
			placeholder="Enter Renewal End Date"
		/>

		<InputComp
			label="Contract Renewal Signing Date"
			name="renewalDate"
			type="date"
			{form}
			{errors}
			required
			placeholder="Enter renewal signing date"
		/>
		<InputComp
			label="Contract File"
			name="contractFile"
			type="file"
			{form}
			{errors}
			placeholder="Upload contract pdf or image"
		/>
		<InputComp
			label="Signing Officer"
			name="signingOfficer"
			type="combo"
			{form}
			{errors}
			items={officers}
			placeholder="Upload contract pdf or image"
		/>

		<Errors allErrors={$allErrors} />
		<Button type="submit" class="w-full" form="main" variant="default">
			{#if $delayed}
				<LoadingBtn name="Renewing Contract" />
			{:else}
				<RefreshCcw class="h-4 w-4" />
				Renew Contract
			{/if}
		</Button>
	</form>
</DialogComp>
