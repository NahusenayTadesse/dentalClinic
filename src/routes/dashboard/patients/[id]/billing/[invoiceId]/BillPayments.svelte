<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import Undo from '@lucide/svelte/icons/undo-2';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Section from '$lib/components/Section.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import type { InvoiceDetail } from '$lib/server/billing';
	import { refund, type Refund } from '../schema';

	/**
	 * A bill's payments and refunds, and asking for a refund from one payment.
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
		canRefund
	}: {
		payments: InvoiceDetail['payments'];
		form: SuperValidated<Refund>;
		methods: { value: number; name: string; kind: string }[];
		/** False on a void bill, and for a viewer who cannot take money. */
		canRefund: boolean;
	} = $props();

	let open = $state(false);
	let seed = $state<Partial<Refund>>({});
	let limit = $state(0);

	const methodItems = $derived(
		methods.map((m) => ({
			value: String(m.value),
			name: m.kind === 'cash' ? `${m.name} (cash)` : m.name
		}))
	);

	function start(paid: InvoiceDetail['payments'][number]) {
		limit = paid.refundable;
		seed = { paymentId: paid.transactionId, amount: paid.refundable, reason: '' };
		open = true;
	}

	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');
	const waiting = { pending: 'waiting for approval', rejected: 'refused' } as const;
</script>

<Section title="Payments" IconComp={Banknote} style="personalIcon">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Receipt</Table.Head>
				<Table.Head>Date</Table.Head>
				<Table.Head>How</Table.Head>
				<Table.Head class="text-right">Amount</Table.Head>
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
						{paid.receiptNumber ?? (paid.direction === 'out' ? 'Refund' : '—')}
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
									<Undo class="size-4" /> Refund
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
	title="Give money back"
	description="A manager approves it in Approvals → Refunds. Only then does the bill owe it again, and only then does cash leave the drawer."
	action="?/requestRefund"
	data={form}
	schema={refund}
	bind:open
	{seed}
	hideTrigger
	submitLabel="Ask for the refund"
	disabled={!canRefund}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="paymentId" value={values.paymentId} />
		<InputComp
			label="Amount"
			name="amount"
			type="number"
			{form}
			{errors}
			description="At most {formatETB(limit)} from this payment."
		/>
		<InputComp
			label="Given back by"
			name="paymentMethodId"
			type="select"
			{form}
			{errors}
			items={methodItems}
		/>
		<InputComp label="Why" name="reason" {form} {errors} placeholder="Crown not fitted" />
	{/snippet}
</FormDialog>
