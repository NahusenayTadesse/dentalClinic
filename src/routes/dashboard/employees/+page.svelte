<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';

	import { Frown, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.staffList);
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
		totalResults={data?.staffList.length ?? 0}
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

	<FilterMenu
		data={data?.staffList}
		bind:filteredList
		filterKeys={[
			'branch',
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
	<DataTable data={filteredList} {columns} fileName="Employees List" />

	{#if data.pagination.total > data.pagination.pageSize}
		<div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
			<span>
				Page {data.pagination.page} of {Math.ceil(data.pagination.total / data.pagination.pageSize)}
				({data.pagination.total} total)
			</span>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page <= 1}
					onclick={() => {
						navigateWithQuery({ page: data.pagination.page - 1 });
					}}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page >=
						Math.ceil(data.pagination.total / data.pagination.pageSize)}
					onclick={() => {
						navigateWithQuery({ page: data.pagination.page + 1 });
					}}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
{/if}
