<script lang="ts">
	import { adjustmentColumns, columns, reciepts } from './columns.svelte';

	let { data } = $props();

	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';

	import { Frown, ArrowRight } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';

	let month = $state('');

	let link = $derived(`${month}`);

	const MONTH_MAP: Record<string, number> = {
		january: 1,
		february: 2,
		march: 3,
		april: 4,
		may: 5,
		june: 6,
		july: 7,
		august: 8,
		september: 9,
		october: 10,
		november: 11,
		december: 12
	};

	const getEthiopianMonth = (month: number | string): string => {
		let monthNumber: number | undefined;

		if (typeof month === 'number') {
			monthNumber = month;
		} else {
			monthNumber = MONTH_MAP[month.toLowerCase()];
		}

		if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
			return '';
		}

		// Fixed reference year to avoid edge cases
		const date = new Date(2024, monthNumber - 1, 1);

		const formatter = new Intl.DateTimeFormat('am-ET', {
			month: 'long',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	};

	export const getEthiopianYear = (year: number): string => {
		if (!year) return '';

		// Use January 1st to avoid Ethiopian new-year boundary issues
		const date = new Date(year, 0, 1);

		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	};

	import Filter from '$lib/components/Table/FilterMenu.svelte';
	import { goto } from '$app/navigation';
	let filteredList = $derived(data?.payrollData);

	const calculateTotal = (
		employees: any[],
		key: 'gross' | 'taxAmount' | 'penEm' | 'penOrg' | 'netPay'
	): number => {
		// If employees hasn't been populated by the effect yet, return 0
		if (!employees || !Array.isArray(employees)) return 0;

		const total = employees.reduce((sum, emp) => {
			const value = emp[key];
			// Cast to number just in case they are stringified numbers from an input
			const numValue = typeof value === 'string' ? parseFloat(value) : value;
			return sum + (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0);
		}, 0);

		return Math.round(total * 100) / 100;
	};

	let totals = $derived({
		gross: calculateTotal(filteredList, 'gross'),
		tax: calculateTotal(filteredList, 'taxAmount'),
		penEm: calculateTotal(filteredList, 'penEm'),
		penOrg: calculateTotal(filteredList, 'penOrg'),
		netPay: calculateTotal(filteredList, 'netPay')
	});

	import PayrollTotals from '$lib/components/payroll-totals.svelte';
	import Adjust from './adjust.svelte';
	import Finalize from './finalize.svelte';

	let selected = $state([]);
</script>

<svelte:head>
	<title>Salaries List for {data.month} {data.year}</title>
</svelte:head>

{#if data?.payrollData.length === 0}
	<div
		class="flex min-h-[400px] w-full max-w-5xl flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted p-12 text-center"
	>
		<!-- Icon / Illustration -->
		<div class="relative mb-6">
			<div class="absolute -inset-1 rounded-full bg-primary/10 blur-xl"></div>
			<Frown class="relative h-16 w-16 animate-bounce text-muted-foreground" />
		</div>

		<!-- Main Text -->
		<h2 class="text-2xl font-semibold tracking-tight">No salaries found</h2>
		<p class="mt-2 mb-8 text-muted-foreground">
			There are no recorded salaries for <span class="font-medium text-foreground"
				>{data.month} {data.year}</span
			>.
		</p>

		<!-- Control Group -->
		<div class="flex flex-col items-center gap-4 sm:flex-row">
			<div class="flex items-center">
				<label class="sr-only" for="month-select">Select Month and Year</label>
				<MonthYear bind:value={month} />
			</div>

			<Button
				onclick={() => goto(`/dashboard/salary/paid-salaries/${link}`)}
				aria-label="Go to selected month and year"
				class="group px-8"
			>
				View Month
				<ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
			</Button>
		</div>

		<!-- Secondary Action (Optional) -->
		<Button variant="ghost" href="/dashboard/salary/add-payroll" class="mt-8 text-sm">
			+ Add New Salary Record
		</Button>
	</div>
{:else}
	<div
		class="mx-auto max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
	>
		<div class="flex-1">
			<h1 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
				Salaries — {data?.month}
				{data.year}
			</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Total Employees: <span class="font-medium text-gray-800 dark:text-gray-100"
					>{data?.payrollData.length}</span
				>
			</p>
		</div>

		<div class="mt-3 flex flex-col items-stretch gap-3 sm:mt-0 sm:flex-row sm:items-center">
			<div class="flex items-center gap-2">
				<label class="sr-only" for="month-select">Month</label>
				<MonthYear bind:value={month} />
			</div>

			<Button
				onclick={() => goto(`/dashboard/salary/paid-salaries/${link}`)}
				aria-label="Go to selected month and year"
				class="flex items-center gap-2"
			>
				Go
				<ArrowRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
	<PayrollTotals {totals} />

	<div class="mb-4 flex items-center gap-3">
		{#if data?.payrollRun?.finalized}
			<p class="text-sm text-muted-foreground">
				Finalized by <span class="font-medium text-foreground">{data.payrollRun.finalizedBy}</span>
				on {new Date(data.payrollRun.finalizedAt ?? '').toLocaleDateString()}
			</p>
		{:else if data?.payrollRun}
			<Finalize id={data.payrollRun.id} employees={data?.employees} data={data?.finalizeForm} />
		{/if}
	</div>
	<br />

	<div class="mb-4 flex flex-col">
		<h4>Bank Statements</h4>
		<DataTable data={data?.payrollReciept} columns={reciepts} fileName="Bank Statements" />
	</div>

	{#if data?.adjustments.length}
		<div class="mb-4 flex flex-col">
			<h4>Salary Adjustments</h4>
			<DataTable
				data={data?.adjustments}
				columns={adjustmentColumns}
				fileName="Salary Adjustments"
			/>
		</div>
	{/if}

	<Filter
		data={data?.payrollData}
		bind:filteredList
		filterKeys={[
			'branch',
			'bank',
			'department',
			'position',
			'taxAmount',
			'overtime',
			'basicSalary',
			'housingAllowance',
			'transportAllowance',
			'positionAllowance'
		]}
	/>
	<br />

	{#if selected.length}
		{#if data?.payrollRun?.finalized}
			<p class="text-sm text-muted-foreground">
				This payroll run is finalized — adjustments are disabled.
			</p>
		{:else}
			<Adjust id={selected?.map((item) => item.payrollId)} banks={data?.banks} data={data?.form} />
		{/if}
	{/if}

	<DataTable bind:selected data={filteredList} {columns} fileName="Bank Accounts" />
{/if}
