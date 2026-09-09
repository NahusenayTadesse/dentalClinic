<script lang="ts">
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import Edit from './editContract.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Plus } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import type { Item } from '$lib/global.svelte';
	import { formatETB, formatEthiopianDate, formatEthiopianYear } from '$lib/global.svelte';
	import type { AddPayment, EditPayment } from './schema';
	import { columns } from './columns';
	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		form: editForm,
		addForm,
		bankList
	}: {
		data: any;
		form: SuperValidated<Infer<EditPayment>>;
		addForm: SuperValidated<Infer<AddPayment>>;
		bankList: Item[];
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(addForm, {
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
</script>

<DialogComp variant="default" title="Add Contract" IconComp={Plus}>
	<form
		action="?/addContract"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-2 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<InputComp
			label="Bank or Payment Method Used"
			name="service"
			type="combo"
			{form}
			{errors}
			required
			items={bankList}
		/>
		<InputComp
			label="Penality Amount"
			name="penalityAmount"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter Penality Amount"
		/>
		<InputComp
			label="Requested Amount"
			name="requestAmount"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter Penality Amount"
		/>
		<InputComp
			label="Before VAT Amount"
			name="beforeVat"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter Before VAT Amount"
		/>
		<InputComp label="VAT" name="vat" type="number" {form} {errors} required placeholder="VAT" />
		<InputComp
			label="Withhold Amount"
			name="withholdAmount"
			type="number"
			{form}
			{errors}
			required
			placeholder="Enter Withhold  Amount"
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
			label="Withhold Invoice Number"
			name="withholdInvoiceNumber"
			type="text"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter Withhold Invoice Number"
		/>

		<InputComp
			label="Payment Month"
			name="month"
			type="month"
			{form}
			{errors}
			year={true}
			required
			placeholder="Enter Invoice Number"
		/>

		<InputComp
			label="Payment Date"
			name="date"
			type="date"
			{form}
			{errors}
			required
			placeholder="Enter payment date"
		/>
		<InputComp
			label="Payment Request File"
			name="paymentRequestFile"
			type="file"
			{form}
			{errors}
			required
			placeholder="Upload the payment request pdf or image sent to client"
		/>
		<InputComp
			label="Withhold File"
			name="withholdFile"
			type="file"
			{form}
			{errors}
			required
			placeholder="Upload the withhold pdf or image recieved from client"
		/>
		<InputComp
			label="Bank Statement File"
			name="receiptFile"
			type="file"
			{form}
			{errors}
			required
			placeholder="Upload the bank statement pdf or image recieved from client"
		/>

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Contract" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Contract
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data}
	<DataTable {columns} {data} search={true} fileName="Contract" />
{/key}
