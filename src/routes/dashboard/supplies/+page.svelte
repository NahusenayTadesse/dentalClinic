<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	/**
	 * The supply catalogue with what is in store. Searched and dated on the server; the column
	 * filters — type, kind, unit, stock — count the whole catalogue, not just this page.
	 */
	let { data } = $props();

	const q = $derived(data.currentQuery);
	/** Whether anything is narrowing the list, so an empty page can say which. */
	const isFiltered = $derived(
		Object.values(data.currentQuery).some((value) => value !== null && value !== '')
	);
</script>

<svelte:head>
	<title>Supplies</title>
</svelte:head>

{#if data.pagination.total === 0 && !isFiltered}
	<div class="flex h-96 flex-col items-center justify-center gap-4 text-center">
		<p class="text-3xl">No supplies added yet</p>
		<Button href="/dashboard/supplies/add-supplies"><Plus /> Add supplies</Button>
	</div>
{:else}
	<div class="flex flex-col gap-4">
		<header class="flex flex-wrap items-end justify-between gap-2">
			<div>
				<h2 class="text-2xl">Supplies · {data.pagination.total}</h2>
				{#if data.atReorder}
					<p class="text-sm text-muted-foreground">
						{data.atReorder} at or below their reorder level — filter the Stock column to see them.
					</p>
				{/if}
			</div>
		</header>

		<DataTable
			data={data.supplyList}
			{columns}
			fileName="Supplies"
			charts
			dateFilter="Added"
			facetKeys={['type', 'kind', 'unitOfMeasure', 'stockStatus']}
			facetLabels={{ type: 'Type', kind: 'Kind', unitOfMeasure: 'Unit', stockStatus: 'Stock' }}
			facetParams={{ type: 'supplyTypeId' }}
			server={{
				pagination: data.pagination,
				facets: data.facets,
				filters: {
					search: q.search,
					dateStart: q.dateStart,
					dateEnd: q.dateEnd,
					type: q.supplyTypeId,
					kind: q.kind,
					unitOfMeasure: q.unitOfMeasure,
					stockStatus: q.stockStatus
				}
			}}
		/>
	</div>
{/if}
