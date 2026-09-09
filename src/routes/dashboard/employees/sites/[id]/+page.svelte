<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import { Frown, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.staffList);
</script>

<svelte:head>
	<title>Employee List</title>
</svelte:head>

{#if data.staffList.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />
			No Employees for {data?.siteName} added yet
		</p>
		<Button href="/dashboard/employees/add-employee"><Plus />Add New Employees</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">{data?.siteName} Employees</h2>
	<h4 class="mb-4">{data?.staffList.length} Employees in {data?.siteName}</h4>

	<FilterMenu
		data={data?.staffList}
		bind:filteredList
		filterKeys={[
			'department',
			'position',
			'education',
			'status',
			'years',
			'guarantor',
			'accounts',
			'families'
		]}
	/>
	<DataTable data={filteredList} class="!" {columns} />
{/if}
