<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { payslipColumns } from './columns';

	/**
	 * Paid salaries across any period: every payslip, with what each was made of. Choose a range,
	 * a month, a department; the figures above count everything that matches, not just this page.
	 */
	let { data } = $props();

	const q = $derived(data.currentQuery);

	const count = (key: string, label: string, value: number): Stat => ({
		key,
		label,
		value,
		format: 'count',
		group: 'payroll'
	});
	const money = (key: string, label: string, value: number): Stat => ({
		key,
		label,
		value,
		format: 'money',
		group: 'payroll'
	});
	const TILES = $derived<Stat[]>([
		count('payslips', 'Payslips', data.totals.payslips),
		count('employees', 'Employees', data.totals.employees),
		money('gross', 'Gross', data.totals.gross),
		money('tax', 'Income tax', data.totals.tax),
		money('pension', 'Pension (both shares)', data.totals.pension),
		{ ...money('net', 'Net paid', data.totals.net), tone: 'positive' }
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

	{#if data.forEmployee}
		<p class="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
			Showing <strong>{data.forEmployee}</strong>’s payslips only.
			<a class="underline" href="/dashboard/salary/paid-salaries">Show everyone</a>
		</p>
	{/if}

	<section
		class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
		aria-label="Paid salaries at a glance"
	>
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
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
