<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { columns } from './columns';

	import { SUPPLIER_STATUSES, SUPPLIER_ACTIVITY, SUPPLIER_CONTACT, labelOf } from '../filters';

	let { data } = $props();
</script>

<svelte:head>
	<title>Suppliers</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-2xl font-bold">Suppliers: {data.pagination.total}</h2>
</div>

<QueryBuilder
	title="Supplier Query"
	description="Search by name or contact, then narrow by area, status or trading history"
	searchPlaceholder="Search name, phone or email..."
	showDate
	totalResults={data.pagination.total}
	initialSearch={data.currentQuery.search}
	initialStart={data.currentQuery.dateStart ?? undefined}
	initialEnd={data.currentQuery.dateEnd ?? undefined}
	initialPageSize={data.pagination.pageSize}
	initialCustomFilters={{
		subcityId: data.currentQuery.subcityId ?? '',
		status: data.currentQuery.status ?? '',
		activity: data.currentQuery.activity ?? '',
		contact: data.currentQuery.contact ?? ''
	}}
	onQueryChange={applyQueryToUrl}
>
	{#snippet children(filters, update)}
		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Subcity</Label>
			<Select
				type="single"
				value={filters.subcityId as string}
				onValueChange={(v) => update('subcityId', v as never)}
			>
				<SelectTrigger class="w-full">
					{data.subcitiesList.find((s) => String(s.value) === filters.subcityId)?.name ??
						'All subcities'}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All subcities</SelectItem>
					{#each data.subcitiesList as subcity (subcity.value)}
						<SelectItem value={String(subcity.value)}>{subcity.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Status</Label>
			<Select
				type="single"
				value={filters.status as string}
				onValueChange={(v) => update('status', v as never)}
			>
				<SelectTrigger class="w-full">
					{labelOf(SUPPLIER_STATUSES, filters.status as string, 'Any status')}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">Any status</SelectItem>
					{#each SUPPLIER_STATUSES as status (status.value)}
						<SelectItem value={status.value}>{status.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Trading History</Label>
			<Select
				type="single"
				value={filters.activity as string}
				onValueChange={(v) => update('activity', v as never)}
			>
				<SelectTrigger class="w-full">
					{labelOf(SUPPLIER_ACTIVITY, filters.activity as string, 'Supplied or not')}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">Supplied or not</SelectItem>
					{#each SUPPLIER_ACTIVITY as activity (activity.value)}
						<SelectItem value={activity.value}>{activity.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Contact Details</Label>
			<Select
				type="single"
				value={filters.contact as string}
				onValueChange={(v) => update('contact', v as never)}
			>
				<SelectTrigger class="w-full">
					{labelOf(SUPPLIER_CONTACT, filters.contact as string, 'Any contact details')}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">Any contact details</SelectItem>
					{#each SUPPLIER_CONTACT as contact (contact.value)}
						<SelectItem value={contact.value}>{contact.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>
	{/snippet}
</QueryBuilder>

{#if data.allData.length === 0}
	<p class="my-12 text-center text-muted-foreground">No suppliers match these filters.</p>
{:else}
	<DataTable {columns} data={data.allData} search={true} fileName="Suppliers" />
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
