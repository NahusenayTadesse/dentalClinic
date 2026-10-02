<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { listColumns } from './columns';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	let { data } = $props();
	const q = $derived(data.currentQuery);
	const t = useI18n();
	const l = $derived(t.m.appointments.list);
	const columns = $derived(listColumns(t.m));
</script>

<svelte:head>
	<title>{l.title}</title>
</svelte:head>

<div class="my-4 flex flex-wrap items-center justify-between gap-2">
	<h1>{l.title}</h1>
	<Button variant="outline" href="/dashboard/appointments"
		><CalendarDays class="size-4" /> {l.dayView}</Button
	>
</div>

<DataTable
	data={data.appointments}
	{columns}
	fileName="Appointments"
	charts
	dateFilter={t.m.common.date}
	facetKeys={['status', 'type', 'provider', 'chair', 'flags']}
	facetLabels={{
		status: t.m.common.status,
		type: l.whatFor,
		provider: t.m.common.dentist,
		chair: t.m.common.chair,
		flags: l.flags
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
