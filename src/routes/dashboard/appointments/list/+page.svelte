<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { columns } from './columns';

	let { data } = $props();
	const q = $derived(data.currentQuery);
</script>

<svelte:head>
	<title>Appointment list</title>
</svelte:head>

<div class="my-4 flex flex-wrap items-center justify-between gap-2">
	<h1>Appointment list</h1>
	<Button variant="outline" href="/dashboard/appointments"
		><CalendarDays class="size-4" /> Day view</Button
	>
</div>

<DataTable
	data={data.appointments}
	{columns}
	fileName="Appointments"
	charts
	dateFilter="Date"
	facetKeys={['status', 'type', 'provider', 'chair', 'flags']}
	facetLabels={{
		status: 'Status',
		type: 'What for',
		provider: 'Dentist',
		chair: 'Chair',
		flags: 'Flags'
	}}
	facetParams={{ type: 'typeId', provider: 'providerId', chair: 'chairId', flags: 'flag' }}
	server={{
		pagination: data.pagination,
		facets: data.facets,
		filters: {
			search: q.search,
			sort: q.sort,
			dir: q.dir,
			dateStart: q.dateStart,
			dateEnd: q.dateEnd,
			status: q.status,
			type: q.typeId,
			provider: q.providerId,
			chair: q.chairId,
			flags: q.flag
		}
	}}
/>
