<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { Pen, Plus, X, FileMinus, FilePlus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { add } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';

	let { data } = $props();
	const { form, errors, enhance, message, delayed, capture, restore, allErrors } = superForm(
		data.form,
		{
			taintedMessage: () => {
				return new Promise((resolve) => {
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
				});
			},

			validators: zod4Client(add),
			onChange(event) {
				if (event.target) {
					$form.paymentAmount =
						$form.beforeVat -
						$form.penaltyAmount -
						($form.requestAmount * $form.withholdAmount) / 100;

					$form.beforeVat = $form.requestAmount - $form.requestAmount * ($form.vat / 100);
				}
			}
		}
	);

	export const snapshot: Snapshot = { capture, restore };
	import { toast } from 'svelte-sonner';
	import Input from '$lib/components/ui/input/input.svelte';
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
	// $form.vat = Number(data.vats.vat);

	// $form.requestAmount = Number(data?.siteName.monthlyAmount);

	// $form.beforeVat = $form.requestAmount - $form.requestAmount * ($form.vat / 100);

	let withHold = $state(true);
	let FileIcon = $derived(withHold ? FileMinus : FilePlus);
	// $form.withholdAmount = ($form.beforeVat * Number(data.vats.withHold)) / 100;

	// $form.paymentAmount = $form.requestAmount - $form.penaltyAmount - $form.withholdAmount;

	function toggleWithhold() {
		withHold = !withHold;
		if (withHold) $form.withholdAmount = ($form.beforeVat * Number(data.vats.withHold)) / 100;
		else {
			$form.withholdAmount = 0;
		}
	}
</script>

<svelte:head>
	<title>Add New Payment Collection</title>
</svelte:head>

<FormCard title="Add Payment Collection for {data?.siteName.name}" className="lg:w-full!">
	<!-- EmployeeAddForm.svelte -->

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
			<h4>Identification & Service</h4>

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
					required
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

					{#if $form.requestAmount !== Number(data?.siteName.monthlyAmount)}
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
					required
					disabled
				/>
				<div>
					<InputComp label="VAT" name="vat" type="hidden" {form} {errors} required />

					<Input disabled bind:value={$form.vat} />
				</div>

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

					<!-- <Input disabled bind:value={$form.withholdAmount} /> -->

					<Button onclick={toggleWithhold} variant={withHold ? 'destructive' : 'default'}>
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
					{form}
					{errors}
					disabled
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

		<!-- 2. GOVERNMENT / LEGAL -->
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

		<!-- 3. JOB DETAILS -->
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
				<InputComp label="Withhold File" name="withholdFile" type="file" {form} {errors} required />
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

{#if data?.isSuperAdmin}
	<div class="mt-4 flex w-full justify-end lg:w-full">
		<DeleteEntity
			entity="Contract"
			name={data?.siteName?.name ?? ''}
			consequence="Its payment and renewal history stays in the database but stops appearing anywhere."
			canDelete={data?.isSuperAdmin}
		/>
	</div>
{/if}
