<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { makeColumns } from './columns';

	/**
	 * The clinic's own spending over any period, filtered and totalled on the server. Pending
	 * expenses are in the approvals queue, not here.
	 */
	let { data } = $props();

	const q = $derived(data.currentQuery);
	const columns = $derived(makeColumns(data.isSuperAdmin));
</script>

<svelte:head>
	<title>Expenses</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Other Expenses</h1>
		<p class="text-muted-foreground">
			Approved spending at this branch, by category. Pending expenses wait in Approvals.
		</p>
	</header>

	<section class="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Expenses at a glance">
		<StatCard
			stat={{
				key: 'count',
				label: 'Expenses',
				value: data.totals.count,
				format: 'count',
				group: 'expenses'
			}}
			amharicMoney={false}
		/>
		<StatCard
			stat={{
				key: 'amount',
				label: 'Spent',
				value: data.totals.amount,
				format: 'money',
				group: 'expenses',
				tone: 'negative'
			}}
			amharicMoney={false}
		/>
	</section>

	<DataTable
		data={data.rows}
		{columns}
		fileName="Expenses"
		charts
		dateFilter="Date"
		facetKeys={['expenseType', 'paymentMethod', 'recievedBy']}
		facetLabels={{ expenseType: 'Category', paymentMethod: 'Paid from', recievedBy: 'Recorded by' }}
		facetParams={{
			expenseType: 'expenseTypeId',
			paymentMethod: 'paymentMethodId',
			recievedBy: 'recievedById'
		}}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: q.search,
				sort: q.sort,
				dir: q.dir,
				dateStart: q.dateStart,
				dateEnd: q.dateEnd,
				expenseType: q.expenseTypeId,
				paymentMethod: q.paymentMethodId,
				recievedBy: q.recievedById
			}
		}}
	/>
</div>
