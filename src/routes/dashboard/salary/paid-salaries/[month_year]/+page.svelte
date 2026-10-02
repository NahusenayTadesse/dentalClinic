<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { adjustmentColumns, columns, reciepts } from './columns.svelte';
	import Adjust from './adjust.svelte';
	import Finalize from './finalize.svelte';

	/**
	 * One payroll run: the month's payslips, its bank receipts and adjustments, and finalising it.
	 * The payslips are filtered by the table's own column filters; the figures describe the ticked
	 * payslips, or the whole month when none is ticked. Paid Salaries lists payslips across months.
	 */
	let { data } = $props();

	type Row = (typeof data.payrollData)[number];
	let selected = $state<Row[]>([]);
	// svelte-ignore state_referenced_locally
	let month = $state(`${data.month}_${data.year}`);

	const counted = $derived(selected.length ? selected : data.payrollData);
	const sum = (key: 'gross' | 'taxAmount' | 'penEm' | 'penOrg' | 'netPay') =>
		Math.round(counted.reduce((total, row) => total + Number(row[key] ?? 0), 0) * 100) / 100;

	const stats = $derived([
		{ key: 'gross', label: 'Gross', value: sum('gross') },
		{ key: 'tax', label: 'Income tax', value: sum('taxAmount') },
		{ key: 'pension', label: 'Pension (both shares)', value: sum('penEm') + sum('penOrg') },
		{ key: 'net', label: 'Net paid', value: sum('netPay'), tone: 'positive' as const }
	]);
</script>

<svelte:head>
	<title>Salaries — {data.month} {data.year}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Salaries — {data.month} {data.year}</h1>
			<p class="text-muted-foreground">
				{data.payrollData.length} payslips{selected.length
					? ` · the figures are for the ${selected.length} ticked`
					: ''}.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<label class="sr-only" for="month-select">Month</label>
			<MonthYear bind:value={month} />
			<Button variant="outline" href="/dashboard/salary/paid-salaries/{month}">
				Go <ArrowRight class="size-4" />
			</Button>
		</div>
	</header>

	{#if data.payrollData.length === 0}
		<p class="rounded-lg border p-6 text-center text-muted-foreground">
			Nobody has been paid for {data.month}
			{data.year}.
			<a class="underline" href="/dashboard/salary/add-payroll/{month}">Run this month’s payroll</a
			>.
		</p>
	{:else}
		<section class="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="The month at a glance">
			{#each stats as stat (stat.key)}
				<StatCard stat={{ ...stat, format: 'money', group: 'payroll' }} amharicMoney={false} />
			{/each}
		</section>

		<div class="flex items-center gap-3">
			{#if data.payrollRun?.finalized}
				<p class="text-sm text-muted-foreground">
					Finalized by <span class="font-medium text-foreground">{data.payrollRun.finalizedBy}</span
					>
					on {new Date(data.payrollRun.finalizedAt ?? '').toLocaleDateString()}
				</p>
			{:else if data.payrollRun}
				<Finalize id={data.payrollRun.id} employees={data.employees} data={data.finalizeForm} />
			{/if}
		</div>

		<section class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">Bank statements</h2>
			<DataTable
				data={data.payrollReciept}
				columns={reciepts}
				fileName="Bank statements"
				variant="compact"
			/>
		</section>

		{#if data.adjustments.length}
			<section class="flex flex-col gap-2">
				<h2 class="text-lg font-semibold">Salary adjustments</h2>
				<DataTable
					data={data.adjustments}
					columns={adjustmentColumns}
					fileName="Salary adjustments"
					variant="compact"
				/>
			</section>
		{/if}

		{#if selected.length}
			{#if data.payrollRun?.finalized}
				<p class="text-sm text-muted-foreground">
					This payroll run is finalized — adjustments are disabled.
				</p>
			{:else}
				<Adjust id={selected.map((item) => item.payrollId)} banks={data.banks} data={data.form} />
			{/if}
		{/if}

		<section class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">Payslips</h2>
			<DataTable
				bind:selected
				data={data.payrollData}
				{columns}
				fileName="Salaries {data.month} {data.year}"
				charts
				facetKeys={['branch', 'department', 'position', 'bank']}
				facetLabels={{
					branch: 'Branch',
					department: 'Department',
					position: 'Position',
					bank: 'Bank'
				}}
			/>
		</section>
	{/if}
</div>
