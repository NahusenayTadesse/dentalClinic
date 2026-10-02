<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { payslipColumns } from './columns';

	/**
	 * Paid salaries across any period: every payslip, with what each was made of. Choose a range,
	 * a month, a department; the figures above count everything that matches, not just this page.
	 */
	let { data } = $props();

	const q = $derived(data.currentQuery);

	const TILES = $derived([
		{ label: 'Payslips', value: data.totals.payslips.toLocaleString() },
		{ label: 'Employees', value: data.totals.employees.toLocaleString() },
		{ label: 'Gross', value: formatETB(data.totals.gross) },
		{ label: 'Income tax', value: formatETB(data.totals.tax) },
		{ label: 'Pension (both shares)', value: formatETB(data.totals.pension) },
		{ label: 'Net paid', value: formatETB(data.totals.net) }
	]);
</script>

<svelte:head>
	<title>Paid Salaries</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Paid Salaries</h1>
		<p class="text-muted-foreground">
			Every payslip a payroll run has written. Open a month for that run’s receipts, adjustments and
			finalising.
		</p>
	</header>

	<section
		class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
		aria-label="Paid salaries at a glance"
	>
		{#each TILES as tile (tile.label)}
			<div class="rounded-lg border bg-card p-4">
				<p class="text-sm text-muted-foreground">{tile.label}</p>
				<p class="text-xl font-bold tabular-nums">{tile.value}</p>
			</div>
		{/each}
	</section>

	<DataTable
		data={data.rows}
		columns={payslipColumns}
		fileName="Paid salaries"
		search
		charts
		dateFilter="Pay period"
		facetKeys={['period', 'department', 'position', 'paymentMethod', 'status']}
		facetLabels={{
			period: 'Month',
			department: 'Department',
			position: 'Position',
			paymentMethod: 'Paid through',
			status: 'Status'
		}}
		facetParams={{
			department: 'departmentId',
			position: 'positionId',
			paymentMethod: 'paymentMethodId'
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
				period: q.period,
				department: q.departmentId,
				position: q.positionId,
				paymentMethod: q.paymentMethodId,
				status: q.status
			}
		}}
	/>
</div>
