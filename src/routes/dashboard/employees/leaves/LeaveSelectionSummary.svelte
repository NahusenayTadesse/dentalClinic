<script lang="ts">
	/**
	 * What you are about to change, shown above the status control.
	 *
	 * The three leave desks all put a status changer on screen as soon as a row is
	 * ticked, but it only ever said "Selected Employees: 1" — so approving or
	 * rejecting meant reading the row in the table, scrolling up to the form, and
	 * trusting you had kept your place. On a single selection the leave is spelled
	 * out here instead; a multi-row batch keeps the count, because there is no one
	 * leave to describe.
	 */
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { formatDays } from '$lib/leaveDays';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import { Eye } from '@lucide/svelte';
	import type { LeaveRow } from '$lib/components/leaves/columns';

	/**
	 * The ticked rows, as the leave tables carry them (`$lib/components/leaves/columns`). It had a
	 * private copy of that type, which had drifted — the day count a number here, nullable there.
	 */
	let { selected }: { selected: LeaveRow[] } = $props();

	const leave = $derived(selected.length === 1 ? selected[0] : null);

	/** Only worth saying when a boundary day is actually a half. */
	const halfDayNote = $derived.by(() => {
		if (!leave) return '';
		const parts: string[] = [];
		if (leave.halfDayStart) parts.push('half first day');
		if (leave.halfDayEnd && leave.startDate !== leave.endDate) parts.push('half last day');
		return parts.join(', ');
	});
</script>

{#snippet field(label: string, value: string | null | undefined)}
	<div class="flex flex-col gap-0.5">
		<span class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
			{label}
		</span>
		<span class="text-sm font-medium">{value || '—'}</span>
	</div>
{/snippet}

{#if leave}
	<div class="my-4 rounded-lg border bg-muted/40 p-4">
		<div class="mb-3 flex flex-wrap items-center gap-2">
			<span class="text-base font-bold">{leave.name || 'Unnamed employee'}</span>
			<Badge variant="outline">{leave.leaveTypeName || 'No leave type'}</Badge>
			<Badge variant={leave.status === 'approved' ? 'default' : 'secondary'}>
				{leave.status ?? 'unknown'}
			</Badge>
		</div>

		<div class="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
			{@render field('Department', leave.department)}
			{@render field('Branch', leave.branchName)}
			{@render field('Requested', formatEthiopianDate(new Date(leave.requestDate)))}
			{@render field('From', formatEthiopianDate(new Date(leave.startDate)))}
			{@render field('To', formatEthiopianDate(new Date(leave.endDate)))}
			{@render field(
				'Duration',
				`${formatDays(Number(leave.numberOfDays ?? 0))}${halfDayNote ? ` (${halfDayNote})` : ''}`
			)}
		</div>

		<div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
			{@render field('Reason', leave.reason)}
			{#if leave.status === 'rejected'}
				{@render field('Rejection reason', leave.rejectionReason)}
			{:else if leave.approvedBy}
				{@render field('Approved by', leave.approvedBy)}
			{/if}
		</div>

		<div class="mt-3">
			{#if leave.leaveLetter}
				<DataTableLinks
					id={leave.leaveLetter}
					name="View leave letter"
					link="/dashboard/files"
					IconComp={Eye}
					target="_blank"
				/>
			{:else}
				<span class="text-sm text-muted-foreground">No leave letter attached</span>
			{/if}
		</div>
	</div>
{:else}
	<p class="my-4 text-sm">Selected Employees: {selected.length}</p>
{/if}
