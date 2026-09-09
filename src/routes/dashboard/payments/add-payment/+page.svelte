<script lang="ts">
	import { untrack } from 'svelte';
	import type { Snapshot } from '@sveltejs/kit';
	import { Plus, FilePlus, FileMinus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms/client';
	import { add } from './schema';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';

	let { data } = $props();

	const { form, errors, enhance, message, delayed, capture, restore, allErrors } = superForm(
		data.form,
		{
			taintedMessage: () => {
				return new Promise((resolve) => {
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
				});
			},
			onUpdated({ form }) {
				if (form.message) {
					if (form.message.type === 'error') {
						toast.error(form.message.text);
					} else {
						toast.success(form.message.text);
					}
				} else if (!form.valid) {
					toast.error('Please fix the highlighted errors before submitting.');
				}
			},
			validators: zod4Client(add),
			dataType: 'json',
			// onChange now does ONE job: pull the default requested amount off the
			// selected contract. Every derived money field is computed below.
			onChange(event) {
				if (!event.paths.includes('contract')) return;

				$form.requestAmount =
					Number(data?.contractList?.find((c) => c.value === $form.contract)?.monthlyAmount) || 0;
			}
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	/* ------------------------------------------------------------------
	 * Rates
	 * ------------------------------------------------------------------ */

	// Guard both rates: if the key is missing or a string, these were NaN
	// before and silently poisoned every downstream field.
	const vatRate = $derived(Number(data?.vats?.vat) || 0);
	const withholdRate = $derived(Number(data?.vats?.withHold) || 0);

	// Keep the VAT input in sync with the configured rate.
	$effect(() => {
		const rate = vatRate;
		untrack(() => {
			if ($form.vat !== rate) $form.vat = rate;
		});
	});

	/* ------------------------------------------------------------------
	 * Withholding toggle
	 * ------------------------------------------------------------------ */

	let withHold = $state(true);
	let FileIcon = $derived(withHold ? FileMinus : FilePlus);

	function toggleWithhold() {
		withHold = !withHold;
	}

	/* ------------------------------------------------------------------
	 * Derived amounts — single source of truth
	 * ------------------------------------------------------------------ */

	const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

	const requestAmount = $derived(Number($form.requestAmount) || 0);
	const penaltyAmount = $derived(Number($form.penaltyAmount) || 0);

	const withholdAmount = $derived(round2(withHold ? (requestAmount * withholdRate) / 100 : 0));

	// requestAmount is VAT-inclusive, so the base is gross / (1 + rate).
	const beforeVat = $derived(round2(vatRate ? requestAmount / (1 + vatRate / 100) : requestAmount));

	const paymentAmount = $derived(round2(requestAmount - penaltyAmount - withholdAmount));

	// Mirror the derived values back into the form store so they get submitted.
	// untrack + equality checks stop the store write from re-triggering the effect.
	$effect(() => {
		const w = withholdAmount;
		const b = beforeVat;
		const p = paymentAmount;

		untrack(() => {
			if ($form.withholdAmount !== w) $form.withholdAmount = w;
			if ($form.beforeVat !== b) $form.beforeVat = b;
			if ($form.paymentAmount !== p) $form.paymentAmount = p;
		});
	});

	const contractMonthly = $derived(
		Number(data?.contractList?.find((c) => c.value === $form.contract)?.monthlyAmount) || 0
	);
	const amountWasChanged = $derived(!!$form.contract && requestAmount !== contractMonthly);

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	const sectionStyle = `flex flex-col gap-4 my-4`;
	const rowStyle = `grid grid-cols-3 mt-4  gap-4`;
</script>

<svelte:head>
	<title>Add Collection</title>
</svelte:head>

<FormCard title="Add  Collection" className="lg:w-full!">
	<form
		use:enhance
		action="?/add"
		id="main"
		method="POST"
		enctype="multipart/form-data"
		class="grid-form"
	>
		<Errors allErrors={$allErrors} />

		<section class={sectionStyle}>
			<h4>Identification &amp; Service</h4>
			<InputComp
				label="Contract"
				name="contract"
				type="combo"
				{form}
				{errors}
				required
				items={data?.contractList}
				placeholder="Enter Contract Number"
			/>
			<div class={rowStyle}>
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
					disabled={!withHold}
					placeholder="Enter Withhold Invoice"
				/>
			</div>

			<h4>Financial Breakdown</h4>

			<div class="{rowStyle} grid-cols-2!">
				<div>
					<InputComp
						label="Requested Amount"
						name="requestAmount"
						type="number"
						{form}
						{errors}
						required
					/>

					{#if amountWasChanged}
						<InputComp
							label="Requested Change Amount"
							name="requestChangeReason"
							type="textarea"
							{form}
							{errors}
							required
						/>
					{/if}
				</div>
				<InputComp
					label="Before VAT Amount"
					name="beforeVat"
					type="number"
					{form}
					{errors}
					disabled
					required
				/>
				<InputComp label="VAT" disabled name="vat" type="number" {form} {errors} required />

				<div>
					<InputComp
						label="Withhold Amount"
						name="withholdAmount"
						type="number"
						{form}
						{errors}
						required
						disabled
					/>

					<Button
						type="button"
						onclick={toggleWithhold}
						variant={withHold ? 'destructive' : 'default'}
					>
						<FileIcon />
						{withHold ? 'No Withholding' : 'Withholding Applied'}
					</Button>
				</div>
				<InputComp
					label="Penalty Amount"
					name="penaltyAmount"
					type="number"
					{form}
					{errors}
					required
				/>
				<InputComp
					label="Payment Amount"
					name="paymentAmount"
					type="number"
					disabled
					{form}
					{errors}
					required
				/>
				<InputComp
					label="Bank Name"
					name="paymentMethod"
					type="combo"
					{form}
					{errors}
					required
					items={data?.paymentMethods}
				/>
			</div>
		</section>

		<section class={sectionStyle}>
			<h4>Timeline</h4>
			<div class={rowStyle}>
				<div>
					<InputComp type="hidden" label="Month" name="month" {form} {errors} required />
					<MonthYear bind:value={$form.month} />
				</div>

				<InputComp label="Payment Date" name="date" type="date" {form} {errors} required />
			</div>
		</section>

		<section class={sectionStyle}>
			<h4>Required Documents</h4>
			<div class={rowStyle}>
				<InputComp
					label="Payment Request File"
					name="paymentRequestFile"
					type="file"
					{form}
					{errors}
					required
				/>
				<InputComp
					label="Withhold File"
					name="withholdFile"
					type="file"
					{form}
					{errors}
					required={withHold}
					disabled={!withHold}
				/>
				<InputComp
					label="Bank Statement File"
					name="receiptFile"
					type="file"
					{form}
					{errors}
					required
				/>
			</div>
		</section>

		<section class={sectionStyle}>
			<Errors allErrors={$allErrors} />
			<Button type="submit" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Payment" />
				{:else}
					<Plus class="h-4 w-4" />
					Add Payment
				{/if}
			</Button>
		</section>
	</form>
</FormCard>