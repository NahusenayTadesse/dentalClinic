<script lang="ts">
	import { columns } from './columns.svelte';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { Frown, ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';

	let month = $state('');

	let link = $derived(`${month}`);

	import Filter from '$lib/components/Table/FilterMenu.svelte';
	import { goto } from '$app/navigation';
	let filteredList = $derived(data?.payrollData);
</script>

<svelte:head>
	<title>Salaries List for {data.payrollData[0].name}</title>
</svelte:head>

{#if data?.payrollData.length === 0}
	<Frown class="h-12 w-16  animate-bounce" />
	No salaries added yet for {data.payrollData[0].name}
{:else}
	<div
		class="mx-auto max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
	>
		<div class="flex-1">
			<h1 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
				Paid Salary History for for {data.payrollData[0].name}
			</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Number of Salaries Paid: <span class="font-medium text-gray-800 dark:text-gray-100"
					>{data?.payrollData.length}</span
				>
			</p>
		</div>
	</div>
	<br />

	<Filter
		data={data?.payrollData}
		bind:filteredList
		filterKeys={[
			'year',
			'month',
			'bank',
			'taxAmount',
			'overtime',
			'basicSalary',
			'housingAllowance',
			'transportAllowance',
			'positionAllowance'
		]}
	/>
	<br />

	<DataTable data={filteredList} {columns} fileName="{data?.payrollData[0].name} Salary History" />
{/if}
