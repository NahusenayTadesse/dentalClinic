<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';
	import { Button } from '$lib/components/ui/button';

	import { Frown, Plus } from '@lucide/svelte';
	import { SUPPLY_KINDS, STOCK_STATUSES, labelOf } from './filters';

	/** Whether anything is narrowing the list, so an empty page can say which. */
	const isFiltered = $derived(
		Object.values(data.currentQuery).some((value) => value !== null && value !== '')
	);
</script>

<svelte:head>
	<title>Supplies List</title>
</svelte:head>

{#if data.pagination.total === 0 && !isFiltered}
	<div class="flex h-96 w-5xl flex-col items-center justify-center gap-4">
		<p class="mt-4 flex flex-row gap-4 justify-self-center text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No supplies added Yet
		</p>
		<Button href="/dashboard/supplies/add-supplies"><Plus /> Add New Supplies</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">No of Supplies: {data.pagination.total}</h2>

	<QueryBuilder
		title="Supplies Query"
		description="Search the catalogue, then narrow it by type, kind or stock level"
		searchPlaceholder="Search name or description..."
		showDate
		totalResults={data.pagination.total}
		initialSearch={data.currentQuery.search}
		initialStart={data.currentQuery.dateStart ?? undefined}
		initialEnd={data.currentQuery.dateEnd ?? undefined}
		initialPageSize={data.pagination.pageSize}
		initialCustomFilters={{
			supplyTypeId: data.currentQuery.supplyTypeId ?? '',
			kind: data.currentQuery.kind ?? '',
			unitOfMeasure: data.currentQuery.unitOfMeasure ?? '',
			stockStatus: data.currentQuery.stockStatus ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Supply Type</Label>
				<Select
					type="single"
					value={filters.supplyTypeId as string}
					onValueChange={(v) => update('supplyTypeId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.supplyTypes.find((t) => String(t.id) === filters.supplyTypeId)
							?.name ?? 'All types'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All types</SelectItem>
						{#each data.filterOptions.supplyTypes as type (type.id)}
							<SelectItem value={String(type.id)}>{type.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Kind</Label>
				<Select
					type="single"
					value={filters.kind as string}
					onValueChange={(v) => update('kind', v as never)}
				>
					<SelectTrigger class="w-full">
						{labelOf(SUPPLY_KINDS, filters.kind as string, 'Returnable and consumable')}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Returnable and consumable</SelectItem>
						{#each SUPPLY_KINDS as kind (kind.value)}
							<SelectItem value={kind.value}>{kind.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Stock Status</Label>
				<Select
					type="single"
					value={filters.stockStatus as string}
					onValueChange={(v) => update('stockStatus', v as never)}
				>
					<SelectTrigger class="w-full">
						{labelOf(STOCK_STATUSES, filters.stockStatus as string, 'Any stock level')}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Any stock level</SelectItem>
						{#each STOCK_STATUSES as status (status.value)}
							<SelectItem value={status.value}>{status.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Where It Is</Label>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Unit</Label>
				<Select
					type="single"
					value={filters.unitOfMeasure as string}
					onValueChange={(v) => update('unitOfMeasure', v as never)}
				>
					<SelectTrigger class="w-full">
						{filters.unitOfMeasure || 'All units'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All units</SelectItem>
						{#each data.filterOptions.units as unit (unit)}
							<SelectItem value={unit}>{unit}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/snippet}
	</QueryBuilder>

	{#if data.supplyList.length === 0}
		<p class="my-12 text-center text-muted-foreground">No supplies match these filters.</p>
	{:else}
		<DataTable data={data.supplyList} {columns} fileName="Supplies" />
	{/if}

	{#if data.pagination.total > data.pagination.pageSize}
		<div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
			<span>
				Page {data.pagination.page} of {Math.ceil(data.pagination.total / data.pagination.pageSize)}
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
