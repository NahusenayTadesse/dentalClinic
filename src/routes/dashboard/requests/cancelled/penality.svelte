<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus, Save, Send, SquarePenIcon } from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import type { AddRequest } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		ids,
		rejectedReason,
		requestedBy,
		employees,
		months,
		requestDate
	}: {
		data: SuperValidated<AddRequest>;
		/** Every request row on this invoice — reopened together. */
		ids: number[];
		employees: Item[];
		requestedBy: number | null;
		/** The periods this invoice bills, oldest first. */
		months: { month: string; year: number }[];
		rejectedReason?: string | null;
		requestDate: Date | string;
	} = $props();

	// The first row's id names the form: unique to one invoice, and free of the
	// characters an invoice number carries.
	const formId = $derived(`request-${ids[0]}`);

	// A multi-month invoice has no single period to edit — writing one month across
	// its rows would collapse them onto the same (site, month, year).
	const singleMonth = $derived(months.length === 1);
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import { idsField } from '../receipts';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.ids = idsField(ids);
	$form.rejectedReason = rejectedReason ?? '';
	$form.requestDate = new Date(requestDate).toLocaleDateString('en-CA');
	$form.month = singleMonth ? `${months[0].month}_${months[0].year}` : undefined;
	// Null only when the requesting employee row was removed; the field is required,
	// so the form surfaces it as an error rather than silently substituting someone.
	$form.requestedBy = requestedBy!;
</script>

<form
	use:enhance
	method="post"
	class="flex w-lg flex-col gap-2"
	action="?/request"
	id={formId}
	enctype="multipart/form-data"
>
	<Errors allErrors={$allErrors} />
	{#if $message}
		<p class="text-sm text-zinc-500">{@html $message.text}</p>
	{/if}
	<input bind:value={$form.ids} name="ids" type="hidden" />
	<InputComp
		{form}
		{errors}
		type="select"
		label="Status"
		name="status"
		items={[{ value: 'pending', name: 'Send to Pending' }]}
	/>

	<InputComp
		type="textarea"
		disabled
		label="Rejected Reason"
		name="rejectedReason"
		{form}
		{errors}
	/>

	<!-- <InputComp type="number" label="Penality" name="penality" {form} {errors} /> -->
	{#if singleMonth}
		<div>
			<InputComp type="hidden" label="Month" name="month" {form} {errors} required />
			<MonthYear bind:value={$form.month} />
		</div>
	{:else}
		<p class="text-sm text-zinc-500">
			Covers {months.length} months ({months.map((m) => `${m.month} ${m.year}`).join(', ')}). The
			period is not editable on a multi-month invoice.
		</p>
	{/if}
	<InputComp type="date" label="Request Date" name="requestDate" {form} {errors} />
	<InputComp type="combo" label="Requestor" name="requestedBy" {form} {errors} items={employees} />

	<Button type="submit" class="w-full" form={formId} variant="default">
		{#if $delayed}
			<LoadingBtn name="Sending to Pending" />
		{:else}
			<Send class="h-4 w-4" />
			Send to Pending
		{/if}
	</Button>
</form>
