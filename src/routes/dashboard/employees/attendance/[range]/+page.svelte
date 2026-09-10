<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import { Frown, Plus, ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.staffList);
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import { page } from '$app/state';
	let month = $state(page.params.range);
	let link = $derived(month);
</script>

<svelte:head>
	<title>Employee List</title>
</svelte:head>

{#if data.staffList.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />
			No Employees added yet
		</p>
		<Button href="/dashboard/employees/add-employee"><Plus />Add New Employees</Button>
	</div>
{:else}
	<h3 class="my-4 text-2xl">
		All Active Employees Attendance for {month?.replace('_', ' ')}
	</h3>
	<h4 class="mb-4">{data?.staffList.length} Employees</h4>
	<div class="mb-4 flex w-32 flex-row items-start gap-2">
		<label class="sr-only" for="month-select">Month</label>
		<MonthYear bind:value={month} />

		<Button
			href="/dashboard/employees/attendance/{link}"
			aria-label="Go to selected month and year"
			class="flex items-center gap-2"
		>
			Go
			<ArrowRight class="h-4 w-4" />
		</Button>
	</div>

	<FilterMenu
		data={data?.staffList}
		bind:filteredList
		filterKeys={['department', 'branch', 'status', 'absent', 'deductable', 'nonDeductable']}
	/>
	<DataTable data={filteredList} class="!" {columns} />
{/if}
