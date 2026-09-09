<script lang="ts">
	import SingleView from '$lib/components/SingleView.svelte';
	import SingleTable from '$lib/components/SingleTable.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ArrowLeft, Ban, CircleCheckBig, XCircle } from '@lucide/svelte';

	import ApproveLease from './ApproveLease.svelte';
	import IssueLease from './IssueLease.svelte';
	import ReturnLease from './ReturnLease.svelte';
	import ReasonDialog from './ReasonDialog.svelte';
	import { movementColumns, eventColumns } from './columns';
	import { leaseStatusBadge, leaseStatusLabel } from '$lib/leaseStatus';
	import { ethiopianDate, ethiopianDateTime, USER_PAGE } from '$lib/tableCells';

	let { data } = $props();

	const lease = $derived(data.lease);
	const status = $derived(lease.status as string);

	/**
	 * Which buttons to offer. These mirror `canTransition` on the server, which
	 * is the real gate — hiding a button is convenience, not access control.
	 */
	const canApprove = $derived(status === 'pending');
	const canReject = $derived(status === 'pending');
	const canCancel = $derived(status === 'pending' || status === 'approved');
	const canIssue = $derived(
		(status === 'approved' || status === 'issued' || status === 'partially_returned') &&
			data.items.some((item) => item.awaitingIssue > 0)
	);
	const canReturn = $derived(
		(status === 'issued' || status === 'partially_returned') && data.outstanding > 0
	);
	const canClose = $derived(
		['issued', 'partially_returned', 'returned'].includes(status) && data.outstanding === 0
	);

	let summary = $derived(
		[
			{ name: 'Site', value: lease.site ?? 'Unknown site' },
			{ name: 'Site Phone', value: lease.sitePhone ?? '—' },
			{ name: 'Reference', value: lease.referenceNumber ?? '—' },
			{ name: 'Reason', value: lease.reason },
			{
				name: 'Expected Return',
				value: lease.expectedReturnDate
					? ethiopianDate(lease.expectedReturnDate)
					: 'No returnable items'
			},
			{ name: 'Still Out at Site', value: `${data.outstanding} unit(s)` }
		].filter(Boolean)
	);

	/**
	 * The audit trail. Only steps that actually happened are shown, so a pending
	 * lease does not display six empty lines.
	 *
	 * `id` is null when the actor's account has since been deleted — the load
	 * nulls it deliberately so the name still prints but does not link to a page
	 * that filters them out.
	 */
	let auditTrail = $derived(
		[
			{
				name: 'Requested By',
				who: lease.requestedBy,
				id: lease.requestedById,
				at: lease.requestedAt,
				note: null
			},
			{
				name: 'Approved By',
				who: lease.approvedBy,
				id: lease.approvedById,
				at: lease.approvedAt,
				note: lease.approvalNote
			},
			{
				name: 'Rejected By',
				who: lease.rejectedBy,
				id: lease.rejectedById,
				at: lease.rejectedAt,
				note: lease.rejectedReason
			},
			{
				name: 'Cancelled By',
				who: lease.cancelledBy,
				id: lease.cancelledById,
				at: lease.cancelledAt,
				note: lease.cancellationReason
			},
			{
				name: 'Issued By',
				who: lease.issuedBy,
				id: lease.issuedById,
				at: lease.issuedAt,
				note: null
			},
			{
				name: 'Closed By',
				who: lease.closedBy,
				id: lease.closedById,
				at: lease.closedAt,
				note: null
			}
		].filter((row) => row.who)
	);

	let handover = $derived(
		lease.receivedByName
			? [
					{
						name: 'Received At Site By',
						value: `${lease.receivedByName}${lease.receivedByPhone ? ` · ${lease.receivedByPhone}` : ''}`
					}
				]
			: []
	);
</script>

<svelte:head>
	<title>Lease · {lease.site ?? 'Supply Lease'}</title>
</svelte:head>

<SingleView title="Supply Lease — {lease.site ?? 'Unknown site'}">
	<div class="flex w-full flex-row flex-wrap items-center gap-2 p-4">
		<Statuses status={leaseStatusBadge(status)} />
		<span class="text-muted-foreground">{leaseStatusLabel(status)}</span>
	</div>

	<div class="flex w-full flex-row flex-wrap items-start justify-start gap-2 px-4">
		<Button href="/dashboard/supplies/leases" variant="outline">
			<ArrowLeft class="size-4" /> All Leases
		</Button>

		{#if canApprove}
			<ApproveLease data={data.approveForm} items={data.items} />
		{/if}

		{#if canIssue}
			<IssueLease data={data.issueForm} items={data.items} />
		{/if}

		{#if canReturn}
			<ReturnLease data={data.returnForm} items={data.items} />
		{/if}

		{#if canReject}
			<ReasonDialog
				data={data.rejectForm}
				action="?/reject"
				title="Reject"
				description="This ends the request. Say why."
				variant="destructive"
				IconComp={XCircle}
				label="Why is this being rejected?"
				placeholder="Reason kept on the audit trail"
				submitLabel="Reject Request"
			/>
		{/if}

		{#if canCancel}
			<ReasonDialog
				data={data.cancelForm}
				action="?/cancel"
				title="Cancel"
				description="This releases any stock reserved for the lease."
				variant="destructive"
				IconComp={Ban}
				label="Why is this being cancelled?"
				placeholder="Reason kept on the audit trail"
				submitLabel="Cancel Lease"
			/>
		{/if}

		{#if canClose}
			<ReasonDialog
				data={data.closeForm}
				action="?/close"
				title="Close"
				description="Nothing is outstanding — close the lease out."
				variant="default"
				IconComp={CircleCheckBig}
				field="note"
				label="Closing note"
				placeholder="Optional"
				required={false}
				submitLabel="Close Lease"
			/>
		{/if}

		<DeleteEntity
			entity="Lease"
			name={lease.referenceNumber ?? `for ${lease.site}`}
			consequence="Its item lines and audit log go with it. A lease that has already moved stock cannot be deleted — cancel or close it instead."
			canDelete={data?.isSuperAdmin}
		/>
	</div>

	<div class="w-full p-4"><SingleTable singleTable={[...summary, ...handover]} /></div>

	<div class="w-full px-4 pb-4">
		<h3 class="mb-2 text-lg">Audit Trail</h3>
		<div class="overflow-x-auto rounded-md border">
			<table class="w-full text-left text-sm">
				<tbody>
					{#each auditTrail as row (row.name)}
						<tr class="border-b last:border-0">
							<td class="px-4 py-3 font-semibold">{row.name}</td>
							<td class="px-4 py-3">
								{#if row.id}
									<a
										class="underline underline-offset-2 hover:no-underline"
										href="{USER_PAGE}/{row.id}">{row.who}</a
									>
								{:else}
									{row.who}
								{/if}
								<span class="text-muted-foreground"> · {ethiopianDateTime(row.at)}</span>
								{#if row.note}
									<p class="text-xs text-muted-foreground">{row.note}</p>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</SingleView>

<div class="mt-8 w-full">
	<h3 class="mb-2 text-lg">Items on this Lease</h3>
	<div class="w-full overflow-x-auto rounded-md border">
		<table class="w-full text-sm">
			<thead class="bg-muted/50">
				<tr>
					<th class="p-3 text-left">Item</th>
					<th class="p-3 text-left">Requested</th>
					<th class="p-3 text-left">Approved</th>
					<th class="p-3 text-left">Issued</th>
					<th class="p-3 text-left">Returned</th>
					<th class="p-3 text-left">Written Off</th>
					<th class="p-3 text-left">Still Out</th>
					<th class="p-3 text-left">Kind</th>
				</tr>
			</thead>
			<tbody>
				{#each data.items as item (item.id)}
					<tr class="border-t">
						<td class="p-3">
							<a class="underline" href="/dashboard/supplies/{item.supplyId}">{item.name}</a>
							{#if item.notes}<p class="text-xs text-muted-foreground">{item.notes}</p>{/if}
						</td>
						<td class="p-3">{item.quantityRequested} {item.unitOfMeasure ?? ''}</td>
						<td class="p-3">{item.quantityApproved}</td>
						<td class="p-3">{item.quantityIssued}</td>
						<td class="p-3">{item.quantityReturned}</td>
						<td class="p-3">{item.quantityWrittenOff}</td>
						<td class="p-3">
							{#if item.outstanding > 0}
								<span class="font-medium text-yellow-600 dark:text-yellow-500">
									{item.outstanding}
								</span>
							{:else}
								—
							{/if}
						</td>
						<td class="p-3 text-muted-foreground">
							{item.returnable ? 'Returnable' : 'Consumable'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if data.movements.length}
	<div class="mt-8 w-full">
		<h3 class="mb-2 text-lg">Stock Movements</h3>
		<DataTable
			data={data.movements}
			columns={movementColumns}
			fileName="Lease {lease.id} Movements"
		/>
	</div>
{/if}

<div class="mt-8 w-full">
	<h3 class="mb-2 text-lg">Status History</h3>
	<DataTable data={data.events} columns={eventColumns} fileName="Lease {lease.id} History" />
</div>
