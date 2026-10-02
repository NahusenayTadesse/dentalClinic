<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	/**
	 * Every money movement at this branch, over any period: filtered, counted and totalled on the
	 * server. The figures count everything the filters match, not just this page.
	 */
	let { data } = $props();

	const q = $derived(data.currentQuery);
	const stats = $derived([
		{ key: 'count', label: 'Transactions', value: data.totals.count, format: 'count' as const },
		{
			key: 'in',
			label: 'Money in',
			value: data.totals.moneyIn,
			format: 'money' as const,
			tone: 'positive' as const
		},
		{
			key: 'out',
			label: 'Money out',
			value: data.totals.moneyOut,
			format: 'money' as const,
			tone: 'negative' as const
		},
		{ key: 'net', label: 'Net', value: data.totals.net, format: 'money' as const }
	]);
</script>

<svelte:head>
	<title>Transactions</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Transactions</h1>
		<p class="text-muted-foreground">
			Every payment in and out at this branch: patients’ payments, payroll and expenses.
		</p>
	</header>

	<section class="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Transactions at a glance">
		{#each stats as stat (stat.key)}
			<StatCard stat={{ ...stat, group: 'transactions' }} amharicMoney={false} />
		{/each}
	</section>

	<DataTable
		data={data.rows}
		{columns}
		fileName="Transactions"
		charts
		dateFilter="Date"
		facetKeys={['direction', 'paymentMethod', 'paymentStatus', 'approvalStatus', 'recievedBy']}
		facetLabels={{
			direction: 'In / out',
			paymentMethod: 'Payment method',
			paymentStatus: 'Payment',
			approvalStatus: 'Approval',
			recievedBy: 'Recorded by'
		}}
		facetParams={{ paymentMethod: 'paymentMethodId', recievedBy: 'recievedById' }}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: q.search,
				sort: q.sort,
				dir: q.dir,
				dateStart: q.dateStart,
				dateEnd: q.dateEnd,
				direction: q.direction,
				paymentMethod: q.paymentMethodId,
				paymentStatus: q.paymentStatus,
				approvalStatus: q.approvalStatus,
				recievedBy: q.recievedById
			}
		}}
	/>
</div>
