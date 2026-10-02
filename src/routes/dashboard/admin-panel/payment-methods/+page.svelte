<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { paymentMethodColumns } from './columns';
	import {
		PAYMENT_KINDS,
		editPaymentMethod,
		paymentMethod,
		type EditPaymentMethod
	} from './schema';

	/**
	 * The ways a patient can pay. One add dialog, and one edit dialog for every row, opened from the
	 * name. "Kind" is what billing reads: cash needs the drawer open.
	 */
	let { data } = $props();

	let addOpen = $state(false);
	let editOpen = $state(false);
	let editSeed = $state<Partial<EditPaymentMethod>>({});

	const columns = $derived(
		paymentMethodColumns({
			onedit: (row) => {
				editSeed = { id: row.id, name: row.name, kind: row.kind };
				editOpen = true;
			},
			canDelete: Boolean(data.isSuperAdmin)
		})
	);
	const kinds = PAYMENT_KINDS.map((k) => ({ value: k.value, name: k.name }));
</script>

<svelte:head>
	<title>Payment Methods</title>
</svelte:head>

<div class="flex justify-end p-4">
	<Button onclick={() => (addOpen = true)}><Plus class="size-4" /> Add a payment method</Button>
</div>

<DataTable {columns} data={data.allPaymentMethods} search fileName="Payment Methods" />

<FormDialog
	title="Add a payment method"
	action="?/add"
	data={data.form}
	schema={paymentMethod}
	bind:open={addOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Add"
>
	{#snippet fields({ form, errors })}
		<InputComp label="Name" name="name" {form} {errors} placeholder="Cash, Telebirr, CBE…" />
		<InputComp label="Kind" name="kind" type="select" {form} {errors} items={kinds} />
	{/snippet}
</FormDialog>

<FormDialog
	title="Edit payment method"
	action="?/edit"
	data={data.editForm}
	schema={editPaymentMethod}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		<InputComp label="Name" name="name" {form} {errors} />
		<InputComp label="Kind" name="kind" type="select" {form} {errors} items={kinds} />
	{/snippet}
</FormDialog>
