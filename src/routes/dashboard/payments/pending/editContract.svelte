<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let { data } = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data.form, {
		resetForm: false,
		invalidateAll: true
	});
	import { toast } from 'svelte-sonner';
	import type { EditContract } from './schema';
	import type { Item } from '$lib/global.svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.id = data?.id; // 1
	$form.transactionId = data?.transactionId;
	$form.paymentMethod = data?.paymentMethodId;
	$form.paymentAmount = data?.paymentAmount;
	$form.penalityAmount = data?.penalityAmount; // 4
	$form.fsNumber = data?.fsNumber;
	$form.invoiceNumber = data?.invoiceNumber;
	$form.requestAmount = data?.requestAmount;

	$form.month = data?.month + '_' + data?.year; // 2
	$form.date = data?.date.toLocaleDateString('en-CA'); // 3

	$form.withholdAmount = data?.withholdAmount; // 8
	$form.withholdInvoiceNumber = data?.withholdInvoiceNumber; // 9
	$form.beforeVat = data?.beforeVat; // 10
	$form.vat = data?.vat;
	$form.status = data?.status;

	let requestImage = data?.paymentRequestFile; //14
	let withholdImage = data?.withholdFile; // 15
	let receiptImage = data?.receiptFile; // 16
</script>

<DialogComp title="Edit Payment" variant="ghost">
	{#snippet trigger(props)}
		<Button size="icon" variant="ghost" title="Edit Payment" {...props}>
			<SquarePen />
		</Button>
	{/snippet}
	<form
		id="main"
		action="?/editContract"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<InputComp
			{form}
			{errors}
			label="Select Status for selected Contracts"
			type="select"
			name="status"
			items={[
				{ value: 'pending', name: 'Pending Approval' },
				{ value: 'approved', name: 'Approve Contract Payment' },
				{ value: 'rejected', name: 'Reject Contract Payment' }
			]}
		/>
		<input hidden bind:value={$form.id} name="id" />
		<input hidden bind:value={$form.transactionId} name="transactionId" />

		<InputComp
			label="FS Number"
			name="fsNumber"
			type="text"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter FS Number"
		/>
		<InputComp
			label="Invoice Number"
			name="invoiceNumber"
			type="text"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter Invoice Number"
		/>
		<InputComp
			label="Withhold Invoice Number"
			name="withholdInvoiceNumber"
			type="text"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter Withhold Invoice"
		/>

		<InputComp
			label="Requested Amount"
			name="requestAmount"
			type="number"
			{form}
			{errors}
			required
		/>
		<InputComp label="Before VAT Amount" name="beforeVat" type="number" {form} {errors} required />
		<InputComp label="VAT" name="vat" type="number" {form} {errors} required />

		<InputComp
			label="Withhold Amount"
			name="withholdAmount"
			type="number"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Penalty Amount"
			name="penalityAmount"
			type="number"
			{form}
			{errors}
			required
		/>
		<InputComp label="Payment Amount" name="paymentAmount" type="number" {form} {errors} required />
		<InputComp
			label="Bank Name"
			name="paymentMethod"
			type="combo"
			{form}
			{errors}
			required
			items={data?.paymentMethodList}
		/>

		<!-- 2. GOVERNMENT / LEGAL -->

		<div class="w-full">
			<InputComp type="hidden" label="Month" name="month" {form} {errors} required />
			<MonthYear bind:value={$form.month} />
			{$form.month}
		</div>

		<InputComp label="Payment Date" name="date" type="date" {form} {errors} required />

		<!-- 3. JOB DETAILS -->

		<InputComp
			label="Payment Request File"
			name="paymentRequestFile"
			type="file"
			{form}
			{errors}
			image={requestImage}
			required
		/>
		<InputComp
			label="Withhold File"
			name="withholdFile"
			image={withholdImage}
			type="file"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Bank Statement File"
			name="receiptFile"
			type="file"
			{form}
			image={receiptImage}
			{errors}
			required
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
