<script lang="ts">
	import Frown from '@lucide/svelte/icons/frown';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { columns } from './columns';

	let { data } = $props();

	/*
	 * Nothing is filtered when the URL asks for nothing — which is what separates "this clinic has
	 * no employees yet" from "your filters matched none". Showing the add-your-first-employee
	 * screen to someone who has just searched for a name is the bug this guards.
	 */
	const isFiltered = $derived(
		Boolean(
			data.currentQuery.search ||
			data.currentQuery.departmentId ||
			data.currentQuery.positionId ||
			data.currentQuery.statusId ||
			data.currentQuery.educationId
		)
	);
</script>

<svelte:head>
	<title>Employee List</title>
</svelte:head>

{#if data.pagination.total === 0 && !isFiltered}
	<div class="flex h-96 w-full flex-col items-center justify-center gap-4">
		<p class="flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			{data.elsewhere > 0 ? 'No employees at this branch' : 'No employees added yet'}
		</p>

		{#if data.elsewhere > 0}
			<!--
				Branch scoping made this screen lie: a clinic with employees at another location saw
				"none added yet" and an invitation to add their first, because the list was empty
				*here*. Saying which it is costs one count, and only when the list is empty.
			-->
			<p class="text-muted-foreground">
				{data.elsewhere.toLocaleString()} at other branches — switch branch in the top bar to see them.
			</p>
		{/if}

		<Button href="/dashboard/employees/add-employee"><Plus />Add new employee</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">Employees List</h2>

	<!--
		One table, in server mode, and no filter bar above it.

		`QueryBuilder` used to sit here carrying a department select and a status select — the same
		two the table now renders in their own column headers, writing the same URL params. It also
		carried a search box and a page-size picker the table already owned, so the page shipped two
		of each. The branch select went when branch became context (§15) rather than a filter.

		The facet tallies come from `facetCounts` in the load, so the column filters and the chart
		describe every employee the query matches rather than the twenty on this page.
	-->
	<DataTable
		data={data.staffList}
		{columns}
		fileName="Employees List"
		charts
		facetKeys={['department', 'position', 'status']}
		facetLabels={{
			department: 'Department',
			position: 'Position',
			status: 'Employment status'
		}}
		facetParams={{
			department: 'departmentId',
			position: 'positionId',
			status: 'statusId'
		}}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: data.currentQuery.search,
				sort: data.currentQuery.sort,
				dir: data.currentQuery.dir,
				department: data.currentQuery.departmentId,
				position: data.currentQuery.positionId,
				status: data.currentQuery.statusId
			}
		}}
	/>
{/if}
