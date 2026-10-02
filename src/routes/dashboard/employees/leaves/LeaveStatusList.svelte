<script lang="ts">
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import X from '@lucide/svelte/icons/x';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { makeColumns, type LeaveRow } from '$lib/components/leaves/columns';
	import {
		approveLeaveFor,
		type ApproveLeave,
		type EditLeave
	} from '$lib/components/leaves/schema';
	import LeaveEditDialog from './LeaveEditDialog.svelte';
	import LeaveSelectionSummary from './LeaveSelectionSummary.svelte';

	type Row = LeaveRow;

	/**
	 * A list of leave requests in one status, with the bulk action that moves the ticked ones to
	 * another — the body of the Pending and the Cancelled pages, which were two copies of it that
	 * differed in their wording (one still offered to "Approve Contract Payment"). Filtering is the
	 * table's own column facets; the old separate filter menu went with the copies.
	 *
	 * **Server mode** for the Approved list, which is long enough to page: pass `server` (the load's
	 * pagination, facets and query) and the table filters, counts and pages in SQL, with a date
	 * window over when the leave was taken. Without it the rows are filtered in the browser.
	 */
	let {
		status,
		title,
		rows,
		form: initial,
		editForm,
		leaveTypes,
		isSuperAdmin,
		choices,
		server = undefined
	}: {
		/** Which leaves these are; the bulk action offers the other states. */
		status: 'pending' | 'rejected' | 'approved';
		title: string;
		rows: Row[];
		form: SuperValidated<ApproveLeave>;
		/** The page's one edit form, seeded from whichever row is opened. */
		editForm: SuperValidated<EditLeave>;
		leaveTypes: { value: number; name: string; maxDays: number | null }[];
		isSuperAdmin: boolean;
		/** What the ticked leaves can be moved to, as the select lists them. */
		choices: { value: string; name: string }[];
		/** The load's paging, facets and query, for a list filtered on the server. */
		server?: {
			pagination: { page: number; pageSize: number; total: number };
			facets: Record<string, { value: string; label: string; count: number }[]>;
			query: Record<string, string | null | undefined>;
		};
	} = $props();

	let selected = $state<Row[]>([]);
	let editing = $state<Row | null>(null);
	let editOpen = $state(false);
	const columns = $derived(
		makeColumns(status, isSuperAdmin, (row) => {
			editing = row;
			editOpen = true;
		})
	);

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(
		initial,
		approveLeaveFor(status),
		{
			dataType: 'json',
			onUpdated({ form }) {
				if (form.message?.type === 'success') selected = [];
			}
		}
	);

	/** The ids the action moves: the ticked rows, read when it is posted. */
	function chosen() {
		$form.ids = selected.map((row) => row.id);
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<h2 class="my-4 text-2xl">{title} · {server ? server.pagination.total : rows.length}</h2>

	{#if rows.length === 0 && !server}
		<p class="rounded-lg border p-6 text-center text-muted-foreground">
			No {status === 'pending' ? 'pending' : 'cancelled'} leave requests.
		</p>
	{:else}
		{#if selected.length > 0}
			<FormCard
				title="Change {selected.length} leave {selected.length === 1 ? 'request' : 'requests'}"
				className="relative!"
			>
				<LeaveSelectionSummary {selected} />
				<Button
					title="Unselect all"
					variant="outline"
					class="absolute top-2 right-2"
					size="icon"
					onclick={() => (selected = [])}
				>
					<X />
				</Button>
				<form
					action="?/approve"
					method="post"
					use:enhance
					onsubmit={chosen}
					class="my-4 flex flex-col gap-4"
				>
					<Errors allErrors={$allErrors} />
					<InputComp
						{form}
						{errors}
						label="Change the selected requests to"
						type="select"
						name="status"
						items={choices}
					/>
					<Button type="submit">
						{#if $delayed}
							<LoadingBtn name="Saving" />
						{:else}
							<BadgeCheck /> Save changes
						{/if}
					</Button>
				</form>
			</FormCard>
		{/if}

		{#if server}
			<DataTable
				data={rows}
				{columns}
				fileName={title}
				bind:selected
				charts
				dateFilter="Taken"
				facetKeys={['leaveTypeName', 'department', 'approvedBy', 'numberOfDays']}
				facetLabels={{
					leaveTypeName: 'Leave type',
					department: 'Department',
					approvedBy: 'Approved by',
					numberOfDays: 'Length'
				}}
				facetParams={{
					leaveTypeName: 'leaveTypeId',
					department: 'departmentId',
					approvedBy: 'approvedById',
					numberOfDays: 'duration'
				}}
				server={{
					pagination: server.pagination,
					facets: server.facets,
					filters: {
						search: server.query.search,
						dateStart: server.query.dateStart,
						dateEnd: server.query.dateEnd,
						leaveTypeName: server.query.leaveTypeId,
						department: server.query.departmentId,
						approvedBy: server.query.approvedById,
						numberOfDays: server.query.duration
					}
				}}
			/>
		{:else}
			<DataTable
				data={rows}
				{columns}
				fileName={title}
				bind:selected
				charts
				facetKeys={['department', 'branchName', 'leaveTypeName']}
				facetLabels={{
					department: 'Department',
					branchName: 'Branch',
					leaveTypeName: 'Leave type'
				}}
			/>
		{/if}
	{/if}
</div>

<LeaveEditDialog row={editing} bind:open={editOpen} data={editForm} {leaveTypes} />
