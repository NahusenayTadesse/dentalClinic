<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Ban from '@lucide/svelte/icons/ban';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Send from '@lucide/svelte/icons/send';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Table from '@nahu/admin-kit/components/ui/table/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import InvoiceStatusBadge from '$lib/components/InvoiceStatusBadge.svelte';
	import ProcedurePicker from '$lib/components/ProcedurePicker.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Link from '$lib/components/Table/data-table-links.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { canEditInvoice, canPay, canRequestVoid } from '$lib/invoiceStatus';
	import PaymentForm from '$lib/components/PaymentForm.svelte';
	import BillPayments from './BillPayments.svelte';
	import {
		addCharge,
		addWork,
		discount,
		editLine,
		issue,
		payer,
		voidRequest,
		type EditLine
	} from '../schema';

	/**
	 * One bill, and whatever its next step is: a draft is put together and issued; an issued bill
	 * takes payments, prints, and can be sent to a manager to void. Only the steps the bill is at
	 * are offered; the actions refuse the rest anyway.
	 */
	let { data } = $props();

	const bill = $derived(data.bill);
	const draft = $derived(canEditInvoice(bill.status));
	const payable = $derived(canPay(bill.status, bill.approvalStatus));
	const voidable = $derived(canRequestVoid(bill.status, bill.approvalStatus, bill.paid));
	const base = $derived(`/dashboard/patients/${data.patient.id}/billing`);
	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');

	/** A draft discount's share of the bill, and whether issuing it will need a manager. */
	const discountShare = $derived(
		bill.subtotal > 0 && bill.discount ? ((bill.discount / bill.subtotal) * 100).toFixed(1) : '0'
	);

	let addOpen = $state(false);
	let chargeOpen = $state(false);
	let discountOpen = $state(false);
	let issueOpen = $state(false);
	let voidOpen = $state(false);
	let payOpen = $state(false);
	let payerOpen = $state(false);
	const payerItems = $derived([
		{ value: '', name: 'The patient' },
		...data.payers.map((p) => ({ value: String(p.value), name: p.name }))
	]);
	let editOpen = $state(false);
	let editSeed = $state<Partial<EditLine>>({});

	function edit(line: (typeof bill.lines)[number]) {
		editSeed = {
			lineId: line.id,
			description: line.description,
			quantity: line.quantity,
			unitPrice: line.unitPrice
		};
		editOpen = true;
	}
</script>

<svelte:head>
	<title>{data.patient.fullName} — {bill.invoiceNumber ?? 'Draft bill'}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center gap-2">
		<Button href={base} variant="ghost" size="sm"><ArrowLeft class="size-4" /> All bills</Button>
		<div class="ml-auto flex flex-wrap gap-2">
			{#if !draft}
				<Button href="{base}/{bill.id}/print" target="_blank" variant="outline" size="sm">
					<Printer class="size-4" /> Print
				</Button>
			{/if}
			{#if payable}
				<Button size="sm" onclick={() => (payOpen = true)}>
					<Banknote class="size-4" /> Take a payment
				</Button>
			{/if}
			{#if voidable}
				<Button size="sm" variant="ghost" onclick={() => (voidOpen = true)}>
					<Ban class="size-4" /> Void
				</Button>
			{/if}
			{#if draft}
				<Button size="sm" variant="outline" onclick={() => (addOpen = true)}>
					<Plus class="size-4" /> Add work
				</Button>
				<Button size="sm" variant="outline" onclick={() => (chargeOpen = true)}>
					<Plus class="size-4" /> Add a charge
				</Button>
				<StepButton
					id="discard-bill"
					action="?/discard"
					data={data.forms.confirm}
					label="Throw away"
					icon={Trash}
					variant="ghost"
					confirm={{
						title: 'Throw this draft away?',
						description:
							'It was never issued, so nothing is lost but the draft. Its work is unbilled again.',
						action: 'Throw away'
					}}
				/>
			{/if}
		</div>
	</div>

	<Section title={bill.invoiceNumber ?? 'Draft bill'} IconComp={Receipt} style="identityIcon">
		{#snippet editDialog()}
			<div class="ml-auto">
				<InvoiceStatusBadge status={bill.status} approvalStatus={bill.approvalStatus} />
			</div>
		{/snippet}

		<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-5">
			<div>
				<dt class="text-muted-foreground">Bill to</dt>
				<dd class="flex items-center gap-1">
					{#if bill.customerId}
						<Link
							entity="customer"
							id={bill.customerId}
							name={data.payerName ?? 'A payer'}
							display="inline"
						/>
					{:else}
						The patient
					{/if}
					{#if draft}
						<Button
							variant="ghost"
							size="icon"
							class="size-6"
							aria-label="Change who pays"
							onclick={() => (payerOpen = true)}
						>
							<Pencil class="size-3" />
						</Button>
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Issued</dt>
				<dd>{draft ? 'Not yet' : day(bill.issuedOn)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Due</dt>
				<dd>{bill.dueOn ? day(bill.dueOn) : 'On the day'}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Total</dt>
				<dd class="font-semibold tabular-nums">{formatETB(bill.total)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Still owed</dt>
				<dd class="font-semibold tabular-nums {bill.owed > 0 ? 'text-destructive' : ''}">
					{draft ? '—' : formatETB(bill.owed)}
				</dd>
			</div>
		</dl>

		{#if bill.approvalStatus === 'pending'}
			<p class="mt-4 rounded-md border border-amber-500 p-3 text-sm">
				{#if bill.voidReason}
					A void has been asked for (“{bill.voidReason}”). It waits for a manager in
					<strong>Approvals → Discounts and Voids</strong>, and takes no payment meanwhile.
				{:else}
					Its discount is over {data.discountThreshold}% of the bill, so it waits for a manager in
					<strong>Approvals → Discounts and Voids</strong> and takes no payment until then.
				{/if}
			</p>
		{/if}
		{#if bill.status === 'void'}
			<p class="mt-4 rounded-md border p-3 text-sm">
				Void{bill.voidReason ? `: ${bill.voidReason}` : ''}. Its number is kept; its work can be
				billed again.
			</p>
		{/if}
		{#if bill.rejectionReason && bill.approvalStatus === 'approved'}
			<p class="mt-4 text-sm text-muted-foreground">
				A manager refused a request on this bill: {bill.rejectionReason}
			</p>
		{/if}
	</Section>

	<Section title="Lines" IconComp={Receipt} style="systemIcon">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>What</Table.Head>
					<Table.Head class="text-right">Qty</Table.Head>
					<Table.Head class="text-right">Price</Table.Head>
					<Table.Head class="text-right">Total</Table.Head>
					{#if draft}<Table.Head class="sr-only">Change</Table.Head>{/if}
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each bill.lines as line (line.id)}
					<Table.Row>
						<Table.Cell>{line.description}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{line.quantity}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatETB(line.unitPrice)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatETB(line.lineTotal)}</Table.Cell>
						{#if draft}
							<Table.Cell class="flex justify-end gap-1">
								<Button
									size="icon"
									variant="ghost"
									aria-label="Change {line.description}"
									onclick={() => edit(line)}
								>
									<Pencil class="size-4" />
								</Button>
								<StepButton
									id="remove-line-{line.id}"
									action="?/removeLine"
									data={data.forms.remove}
									label="Remove"
									variant="ghost"
									values={{ lineId: line.id }}
								/>
							</Table.Cell>
						{/if}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="text-muted-foreground">No lines.</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
			<Table.Footer>
				<Table.Row>
					<Table.Cell colspan={3}>Subtotal</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatETB(bill.subtotal)}</Table.Cell>
					{#if draft}<Table.Cell></Table.Cell>{/if}
				</Table.Row>
				<Table.Row>
					<Table.Cell colspan={3}>
						Discount
						{#if draft}
							<Button size="sm" variant="ghost" class="ml-2" onclick={() => (discountOpen = true)}>
								{bill.discount ? 'Change' : 'Add'}
							</Button>
						{/if}
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">
						{bill.discount ? `−${formatETB(bill.discount)}` : '—'}
					</Table.Cell>
					{#if draft}<Table.Cell></Table.Cell>{/if}
				</Table.Row>
				<Table.Row class="font-semibold">
					<Table.Cell colspan={3}>Total</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatETB(bill.total)}</Table.Cell>
					{#if draft}<Table.Cell></Table.Cell>{/if}
				</Table.Row>
			</Table.Footer>
		</Table.Root>

		{#if draft && bill.lines.length}
			<div class="mt-4 flex items-center justify-end gap-3">
				{#if bill.discount && Number(discountShare) > data.discountThreshold}
					<p class="text-sm text-muted-foreground">
						The {discountShare}% discount is over {data.discountThreshold}%: a manager approves it
						before it can be paid.
					</p>
				{/if}
				<Button onclick={() => (issueOpen = true)}><Send class="size-4" /> Issue the bill</Button>
			</div>
		{/if}
	</Section>

	{#if bill.payments.length}
		<BillPayments
			payments={bill.payments}
			form={data.forms.refund}
			methods={data.methods}
			canRefund={bill.status !== 'void'}
		/>
	{/if}
</div>

<FormDialog
	title="Add completed work"
	action="?/addWork"
	data={data.forms.add}
	schema={addWork}
	bind:open={addOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Add to bill"
	disabled={!draft}
>
	{#snippet fields({ form })}
		<ProcedurePicker {form} work={data.unbilled} legend="Completed work">
			{#snippet empty()}Nothing else completed is waiting to be billed.{/snippet}
		</ProcedurePicker>
	{/snippet}
</FormDialog>

<FormDialog
	title="Add a charge"
	description="Something that is not charted treatment: a missed-appointment fee, something sold."
	action="?/addCharge"
	data={data.forms.charge}
	schema={addCharge}
	bind:open={chargeOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Add charge"
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="What for"
			name="description"
			{form}
			{errors}
			placeholder="Missed appointment"
		/>
		<InputComp label="Quantity" name="quantity" type="number" step="1" min="1" {form} {errors} />
		<InputComp
			label="Price each (birr)"
			name="unitPrice"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Change line"
	action="?/editLine"
	data={data.forms.edit}
	schema={editLine}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
	disabled={!draft}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="lineId" value={values.lineId} />
		<InputComp label="What the patient reads" name="description" {form} {errors} />
		<InputComp label="Quantity" name="quantity" type="number" step="1" min="1" {form} {errors} />
		<InputComp
			label="Price each (birr)"
			name="unitPrice"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Discount"
	description="In birr, off the whole bill. Over {data.discountThreshold}% of it, a manager approves it before the bill can be paid. 0 removes it."
	action="?/discount"
	data={data.forms.discount}
	schema={discount}
	bind:open={discountOpen}
	hideTrigger
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Discount (birr)"
			name="discount"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Issue this bill"
	description="It gets its number and is fixed from now on — what the patient holds and what the system shows stay the same."
	action="?/issue"
	data={data.forms.issue}
	schema={issue}
	bind:open={issueOpen}
	hideTrigger
	submitLabel="Issue"
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Payment due"
			name="dueOn"
			type="date"
			oldDays={false}
			allowEmpty
			required={false}
			{form}
			{errors}
			description="Leave it empty when the patient pays on the day."
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Who pays this bill"
	description="An employer or insurer that pays for this patient. Their bills are paid, and show as owed, on the payer's own page."
	action="?/payer"
	data={data.forms.payer}
	schema={payer}
	bind:open={payerOpen}
	hideTrigger
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp label="Bill to" name="customerId" type="select" {form} {errors} items={payerItems} />
	{/snippet}
</FormDialog>

<FormDialog
	title="Void this bill"
	description="A manager approves it in Approvals → Discounts and Voids. The bill keeps its number; its work can be billed again."
	action="?/requestVoid"
	data={data.forms.void}
	schema={voidRequest}
	bind:open={voidOpen}
	hideTrigger
	submitLabel="Ask to void"
	disabled={!voidable}
>
	{#snippet fields({ form, errors })}
		<InputComp label="Why" name="reason" {form} {errors} placeholder="Billed the wrong patient" />
	{/snippet}
</FormDialog>

<DialogComp title="Take a payment" variant="ghost" bind:open={payOpen}>
	{#snippet trigger()}{/snippet}
	<div class="p-4">
		<PaymentForm
			data={data.forms.payment}
			bills={data.payable}
			methods={data.methods}
			drawerOpen={data.drawerOpen}
			onpaid={() => (payOpen = false)}
		/>
	</div>
</DialogComp>
