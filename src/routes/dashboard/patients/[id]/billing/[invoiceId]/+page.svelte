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
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Link from '$lib/components/Table/data-table-links.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { canEditInvoice, canPay, canRequestVoid } from '$lib/invoiceStatus';
	import PaymentForm from '$lib/components/PaymentForm.svelte';
	import BillPayments from './BillPayments.svelte';
	import BillBundles from './BillBundles.svelte';
	import DraftAdditions from './DraftAdditions.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { discount, editLine, issue, payer, voidRequest, type EditLine } from '../schema';

	/**
	 * One bill, and whatever its next step is: a draft is put together and issued; an issued bill
	 * takes payments, prints, and can be sent to a manager to void. Only the steps the bill is at
	 * are offered; the actions refuse the rest anyway.
	 */
	let { data } = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.bill);

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
		{ value: '', name: w.thePatient },
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
	<title>{w.pageTitle(data.patient.fullName, bill.invoiceNumber ?? w.draftBill)}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center gap-2">
		<Button href={base} variant="ghost" size="sm"><ArrowLeft class="size-4" /> {w.allBills}</Button>
		<div class="ml-auto flex flex-wrap gap-2">
			{#if !draft}
				<Button href="{base}/{bill.id}/print" target="_blank" variant="outline" size="sm">
					<Printer class="size-4" />
					{t.m.common.print}
				</Button>
			{/if}
			{#if payable}
				<Button size="sm" onclick={() => (payOpen = true)}>
					<Banknote class="size-4" />
					{t.m.billing.tab.takePayment}
				</Button>
			{/if}
			{#if voidable}
				<Button size="sm" variant="ghost" onclick={() => (voidOpen = true)}>
					<Ban class="size-4" />
					{w.void}
				</Button>
			{/if}
			{#if draft}
				<Button size="sm" variant="outline" onclick={() => (addOpen = true)}>
					<Plus class="size-4" />
					{w.addWork}
				</Button>
				<Button size="sm" variant="outline" onclick={() => (chargeOpen = true)}>
					<Plus class="size-4" />
					{w.addCharge}
				</Button>
				<StepButton
					id="discard-bill"
					action="?/discard"
					data={data.forms.confirm}
					label={w.throwAway}
					icon={Trash}
					variant="ghost"
					confirm={{
						title: w.throwAwayTitle,
						description: w.throwAwayDescription,
						action: w.throwAway
					}}
				/>
			{/if}
		</div>
	</div>

	<Section title={bill.invoiceNumber ?? w.draftBill} IconComp={Receipt} style="identityIcon">
		{#snippet editDialog()}
			<div class="ml-auto">
				<InvoiceStatusBadge status={bill.status} approvalStatus={bill.approvalStatus} />
			</div>
		{/snippet}

		{#if data.cover.payerBill}
			<p class="mb-3 text-sm">
				<a
					class="underline"
					href="/dashboard/patients/{data.patient.id}/billing/{data.cover.payerBill.id}"
					>{t.m.billing.cover.coPayOf(data.cover.payerBill.number ?? '')}</a
				>
			</p>
		{/if}
		{#if data.cover.authorisation}
			<p class="mb-3 text-sm text-muted-foreground">
				{t.m.billing.cover.authorisation(data.cover.authorisation)}
			</p>
		{/if}

		<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-5">
			<div>
				<dt class="text-muted-foreground">{w.billTo}</dt>
				<dd class="flex items-center gap-1">
					{#if bill.customerId}
						<Link
							entity="customer"
							id={bill.customerId}
							name={data.payerName ?? w.aPayer}
							display="inline"
						/>
					{:else}
						{w.thePatient}
					{/if}
					{#if draft}
						<Button
							variant="ghost"
							size="icon"
							class="size-6"
							aria-label={w.changeWhoPays}
							onclick={() => (payerOpen = true)}
						>
							<Pencil class="size-3" />
						</Button>
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">{w.issued}</dt>
				<dd>{draft ? w.notYet : day(bill.issuedOn)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">{w.due}</dt>
				<dd>{bill.dueOn ? day(bill.dueOn) : w.onTheDay}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">{w.total}</dt>
				<dd class="font-semibold tabular-nums">{formatETB(bill.total)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">{w.stillOwed}</dt>
				<dd class="font-semibold tabular-nums {bill.owed > 0 ? 'text-destructive' : ''}">
					{draft ? '—' : formatETB(bill.owed)}
				</dd>
			</div>
		</dl>

		{#if bill.approvalStatus === 'pending'}
			<p class="mt-4 rounded-md border border-amber-500 p-3 text-sm">
				{#if bill.voidReason}
					{w.voidAsked(bill.voidReason)}
					<strong>{w.queue}</strong>{w.voidAskedEnd}
				{:else}
					{w.discountWaits(data.discountThreshold)}
					<strong>{w.queue}</strong>
					{w.discountWaitsEnd}
				{/if}
			</p>
		{/if}
		{#if bill.status === 'void'}
			<p class="mt-4 rounded-md border p-3 text-sm">{w.isVoid(bill.voidReason)}</p>
		{/if}
		{#if bill.rejectionReason && bill.approvalStatus === 'approved'}
			<p class="mt-4 text-sm text-muted-foreground">{w.refusedRequest(bill.rejectionReason)}</p>
		{/if}
	</Section>

	{#if draft}
		<BillBundles
			applied={data.bundles.applied}
			fitting={data.bundles.fitting}
			form={data.forms.bundle}
		/>
	{/if}

	<Section title={w.lines} IconComp={Receipt} style="systemIcon">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{w.what}</Table.Head>
					<Table.Head class="text-right">{w.qty}</Table.Head>
					<Table.Head class="text-right">{w.price}</Table.Head>
					<Table.Head class="text-right">{w.total}</Table.Head>
					{#if draft}<Table.Head class="sr-only">{w.change}</Table.Head>{/if}
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
									aria-label={w.changeLine(line.description)}
									onclick={() => edit(line)}
								>
									<Pencil class="size-4" />
								</Button>
								<StepButton
									id="remove-line-{line.id}"
									action="?/removeLine"
									data={data.forms.remove}
									label={w.remove}
									variant="ghost"
									values={{ lineId: line.id }}
								/>
							</Table.Cell>
						{/if}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="text-muted-foreground">{w.noLines}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
			<Table.Footer>
				<Table.Row>
					<Table.Cell colspan={3}>{w.subtotal}</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatETB(bill.subtotal)}</Table.Cell>
					{#if draft}<Table.Cell></Table.Cell>{/if}
				</Table.Row>
				<Table.Row>
					<Table.Cell colspan={3}>
						{w.discount}
						{#if draft}
							<Button size="sm" variant="ghost" class="ml-2" onclick={() => (discountOpen = true)}>
								{bill.discount ? w.change : w.add}
							</Button>
						{/if}
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">
						{bill.discount ? `−${formatETB(bill.discount)}` : '—'}
					</Table.Cell>
					{#if draft}<Table.Cell></Table.Cell>{/if}
				</Table.Row>
				{#if bill.vatAmount !== null && bill.vatRate !== null}
					<Table.Row>
						<Table.Cell colspan={3}>
							{draft ? w.vatAtIssue(bill.vatRate) : w.vat(bill.vatRate)}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatETB(bill.vatAmount)}</Table.Cell>
						{#if draft}<Table.Cell></Table.Cell>{/if}
					</Table.Row>
				{/if}
				{#if bill.coPayment}
					<Table.Row>
						<Table.Cell colspan={3}>
							{t.m.billing.cover.coPayment}
							{#if data.cover.coPayBill}
								· <a
									class="underline"
									href="/dashboard/patients/{data.patient.id}/billing/{data.cover.coPayBill.id}"
									>{data.cover.coPayBill.number}</a
								>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">−{formatETB(bill.coPayment)}</Table.Cell>
						{#if draft}<Table.Cell></Table.Cell>{/if}
					</Table.Row>
				{/if}
				<Table.Row class="font-semibold">
					<Table.Cell colspan={3}>{w.total}</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatETB(bill.total)}</Table.Cell>
					{#if draft}<Table.Cell></Table.Cell>{/if}
				</Table.Row>
			</Table.Footer>
		</Table.Root>

		{#if draft && bill.lines.length}
			<div class="mt-4 flex items-center justify-end gap-3">
				{#if bill.discount && Number(discountShare) > data.discountThreshold}
					<p class="text-sm text-muted-foreground">
						{w.overThreshold(discountShare, data.discountThreshold)}
					</p>
				{/if}
				<Button onclick={() => (issueOpen = true)}><Send class="size-4" /> {w.issueTheBill}</Button>
			</div>
		{/if}
	</Section>

	{#if bill.payments.length || data.credit > 0}
		<BillPayments
			payments={bill.payments}
			form={data.forms.refund}
			methods={data.methods}
			canRefund={bill.status !== 'void'}
			credit={data.credit}
			confirm={data.forms.confirm}
		/>
	{/if}
</div>

<DraftAdditions
	bind:workOpen={addOpen}
	bind:chargeOpen
	workForm={data.forms.add}
	chargeForm={data.forms.charge}
	unbilled={data.unbilled}
	vatRegistered={data.vatRegistered}
	{draft}
/>

<FormDialog
	title={w.changeLineTitle}
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
		<InputComp label={w.whatPatientReads} name="description" {form} {errors} />
		<InputComp label={w.quantity} name="quantity" type="number" step="1" min="1" {form} {errors} />
		<InputComp
			label={w.priceEach}
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
	title={w.discount}
	description={w.discountDescription(data.discountThreshold)}
	action="?/discount"
	data={data.forms.discount}
	schema={discount}
	bind:open={discountOpen}
	hideTrigger
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label={w.discountLabel}
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
	title={w.issueTitle}
	description={w.issueDescription}
	action="?/issue"
	data={data.forms.issue}
	schema={issue}
	bind:open={issueOpen}
	hideTrigger
	submitLabel={w.issueSubmit}
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label={w.paymentDue}
			name="dueOn"
			type="date"
			oldDays={false}
			allowEmpty
			required={false}
			{form}
			{errors}
			description={w.paymentDueHint}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title={w.whoPaysTitle}
	description={w.whoPaysDescription}
	action="?/payer"
	data={data.forms.payer}
	schema={payer}
	bind:open={payerOpen}
	hideTrigger
	disabled={!draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label={w.billTo}
			name="customerId"
			type="select"
			{form}
			{errors}
			items={payerItems}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title={w.voidTitle}
	description={w.voidDescription}
	action="?/requestVoid"
	data={data.forms.void}
	schema={voidRequest}
	bind:open={voidOpen}
	hideTrigger
	submitLabel={w.voidSubmit}
	disabled={!voidable}
>
	{#snippet fields({ form, errors })}
		<InputComp label={w.why} name="reason" {form} {errors} placeholder={w.voidPlaceholder} />
	{/snippet}
</FormDialog>

<DialogComp title={t.m.billing.tab.takePayment} variant="ghost" bind:open={payOpen}>
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
