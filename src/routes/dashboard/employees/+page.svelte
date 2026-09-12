<script lang="ts">
	import { applyQueryToUrl } from '$lib/queryFilters';
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';

	import { Frown, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>Employee List</title>
</svelte:head>

{#if data.staffList.length === 0 && !data.currentQuery.search}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No Employees added yet
		</p>
		<Button href="/dashboard/employees/add-employee"><Plus />Add New Employees</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">Employees List</h2>

	<QueryBuilder
		title="Staff Query"
		description="Server-side search across all employees"
		showDate={false}
		initialSearch={data.currentQuery.search}
		initialStart={data.currentQuery.dateStart ?? undefined}
		initialEnd={data.currentQuery.dateEnd ?? undefined}
		initialPageSize={data.pagination.pageSize}
		initialCustomFilters={{
			branchId: data.currentQuery.branchId ?? '',
			departmentId: data.currentQuery.departmentId ?? '',
			positionId: data.currentQuery.positionId ?? '',
			educationId: data.currentQuery.educationId ?? '',
			statusId: data.currentQuery.statusId ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Branch</Label>
				<Select
					type="single"
					value={filters.branchId as string}
					onValueChange={(v) => update('branchId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.branches.find((s) => String(s.id) === filters.branchId)?.name ??
							'All branches'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All branches</SelectItem>
						{#each data.filterOptions.branches as branch (branch.id)}
							<SelectItem value={String(branch.id)}>{branch.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Department</Label>
				<Select
					type="single"
					value={filters.departmentId as string}
					onValueChange={(v) => update('departmentId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.departments.find((d) => String(d.id) === filters.departmentId)
							?.name ?? 'All departments'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All departments</SelectItem>
						{#each data.filterOptions.departments as dept (dept.id)}
							<SelectItem value={String(dept.id)}>{dept.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Status</Label>
				<Select
					type="single"
					value={filters.statusId as string}
					onValueChange={(v) => update('statusId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.statuses.find((s) => String(s.id) === filters.statusId)?.name ??
							'All statuses'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All statuses</SelectItem>
						{#each data.filterOptions.statuses as status (status.id)}
							<SelectItem value={String(status.id)}>{status.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/snippet}
	</QueryBuilder>

	<!--
		One table, in server mode. The facet tallies come from the load (`facetCounts`), so the
		column filters and the chart describe every employee rather than the twenty this page
		returned — which is what the separate FilterMenu did here until now.
	-->
	<DataTable
		data={data.staffList}
		{columns}
		fileName="Employees List"
		charts
		facetKeys={['branch', 'department', 'position', 'status']}
		facetLabels={{
			branch: 'Branch',
			department: 'Department',
			position: 'Position',
			status: 'Employment status'
		}}
		facetParams={{
			branch: 'branchId',
			department: 'departmentId',
			position: 'positionId',
			status: 'statusId'
		}}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: data.currentQuery.search,
				branch: data.currentQuery.branchId,
				department: data.currentQuery.departmentId,
				position: data.currentQuery.positionId,
				status: data.currentQuery.statusId
			}
		}}
	/>
{/if}
