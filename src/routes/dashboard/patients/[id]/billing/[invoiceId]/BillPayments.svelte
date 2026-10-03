<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import Undo from '@lucide/svelte/icons/undo-2';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Table from '@nahu/admin-kit/components/ui/table/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import type { InvoiceDetail } from '$lib/server/billing';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { refund, type Refund } from '../schema';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';

	/**
	 * A bill's payments and refunds, asking for a refund from one payment, and — when the patient has
	 * deposits left — putting that credit towards the bill.
	 *
	 * A refund is a row of its own, shown negative, and counts against the bill only once a manager
	 * has approved it — until then it is marked as waiting, and a rejected one stays on the list,
	 * struck through, so the record of having asked is not lost. The Refund button offers at most
	 * what that payment has not already had given back or asked for; the server checks it again.
	 */
	let {
		payments,
		form,
		methods,
		canRefund,
		credit = 0,
		confirm
	}: {
		payments: InvoiceDetail['payments'];
		form: SuperValidated<Refund>;
		methods: { value: number; name: string; kind: string }[];
		/** False on a void bill, and for a viewer who cannot take money. */
		canRefund: boolean;
		/** The patient's credit this bill can use, or 0 (`server/deposits.ts`). */
		credit?: number;
		/** The bill page's empty step form, for "use credit". */
		confirm?: SuperValidated<Record<string, unknown>>;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.payments);

	let open = $state(false);
	let seed = $state<Partial<Refund>>({});
	let limit = $state(0);

	const methodItems = $derived(
		methods.map((m) => ({
			value: String(m.value),
			name: m.kind === 'cash' ? w.cash(m.name) : m.name
		}))
	);

	function start(paid: InvoiceDetail['payments'][number]) {
		limit = paid.refundable;
		seed = { paymentId: paid.transactionId, amount: paid.refundable, reason: '' };
		open = true;
	}

	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');
	const waiting = $derived({ pending: w.waiting, rejected: w.refused });
</script>

<Section title={w.title} IconComp={Banknote} style="personalIcon">
	{#if credit > 0 && confirm}
		<div class="mb-3">
			<StepButton
				id="use-credit"
				action="?/useCredit"
				data={confirm}
				label={t.m.billing.tab.useCredit(formatETB(credit))}
				icon={PiggyBank}
				variant="outline"
			/>
		</div>
	{/if}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>{w.receipt}</Table.Head>
				<Table.Head>{w.date}</Table.Head>
				<Table.Head>{w.how}</Table.Head>
				<Table.Head class="text-right">{w.amount}</Table.Head>
				{#if canRefund}<Table.Head class="w-0"></Table.Head>{/if}
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each payments as paid (paid.id)}
				{@const note =
					paid.approvalStatus === 'pending' || paid.approvalStatus === 'rejected'
						? waiting[paid.approvalStatus]
						: null}
				<Table.Row class={paid.approvalStatus === 'rejected' ? 'text-muted-foreground' : ''}>
					<Table.Cell>
						{paid.receiptNumber ?? (paid.direction === 'out' ? w.refund : '—')}
						{#if note}<span class="text-xs text-muted-foreground"> · {note}</span>{/if}
					</Table.Cell>
					<Table.Cell>{day(paid.occurredOn)}</Table.Cell>
					<Table.Cell>{paid.method ?? '—'}</Table.Cell>
					<Table.Cell
						class="text-right tabular-nums {paid.approvalStatus === 'rejected'
							? 'line-through'
							: ''}"
					>
						{formatETB(paid.amount)}
					</Table.Cell>
					{#if canRefund}
						<Table.Cell>
							{#if paid.refundable > 0}
								<Button variant="ghost" size="sm" onclick={() => start(paid)}>
									<Undo class="size-4" />
									{w.refund}
								</Button>
							{/if}
						</Table.Cell>
					{/if}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</Section>

<FormDialog
	title={w.giveBackTitle}
	description={w.giveBackDescription}
	action="?/requestRefund"
	data={form}
	schema={refund}
	bind:open
	{seed}
	hideTrigger
	submitLabel={w.askRefund}
	disabled={!canRefund}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="paymentId" value={values.paymentId} />
		<InputComp
			label={w.amount}
			name="amount"
			type="number"
			{form}
			{errors}
			description={w.atMost(formatETB(limit))}
		/>
		<InputComp
			label={w.givenBackBy}
			name="paymentMethodId"
			type="select"
			{form}
			{errors}
			items={methodItems}
		/>
		<InputComp label={w.why} name="reason" {form} {errors} placeholder={w.whyPlaceholder} />
	{/snippet}
</FormDialog>
