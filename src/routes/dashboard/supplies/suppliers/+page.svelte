<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	/**
	 * The clinic's suppliers with their trading history. Searched on the server; the column
	 * filters — area, contact, whether they have supplied, status — count every supplier. The date
	 * window narrows the trading history (deliveries, spend) to that period.
	 */
	let { data } = $props();

	const q = $derived(data.currentQuery);
</script>

<svelte:head>
	<title>Suppliers</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-2xl font-bold">Suppliers · {data.pagination.total}</h2>
		<Button href="/dashboard/supplies/suppliers/add-suppliers">
			<Plus class="size-4" /> Add supplier
		</Button>
	</header>

	<DataTable
		{columns}
		data={data.allData}
		fileName="Suppliers"
		charts
		dateFilter="Delivered"
		facetKeys={['subcity', 'email', 'deliveries', 'status']}
		facetLabels={{
			subcity: 'Area',
			email: 'Contact',
			deliveries: 'Has supplied',
			status: 'Status'
		}}
		facetParams={{ subcity: 'subcityId', email: 'contact', deliveries: 'activity' }}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: q.search,
				dateStart: q.dateStart,
				dateEnd: q.dateEnd,
				subcity: q.subcityId,
				email: q.contact,
				deliveries: q.activity,
				status: q.status
			}
		}}
	/>
</div>
