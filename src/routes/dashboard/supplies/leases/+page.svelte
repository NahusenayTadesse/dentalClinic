<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import { columns } from './columns';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Frown, Plus } from '@lucide/svelte';

	import { LEASE_STATUS_LABELS, type LeaseStatus } from '$lib/leaseStatus';
	import { LEASE_DUE_STATUSES, LEASE_SETTLEMENTS, labelOf } from '../filters';

	let { data } = $props();

	const statusOptions = Object.entries(LEASE_STATUS_LABELS) as [LeaseStatus, string][];

	/** Whether anything is narrowing the list, so an empty page can say which. */
	const isFiltered = $derived(
		Object.values(data.currentQuery).some((value) => value !== null && value !== '')
	);
</script>

<svelte:head>
	<title>Supply Leases</title>
</svelte:head>

{#if data.pagination.total === 0 && !isFiltered}
	<div class="flex h-96 w-full flex-col items-center justify-center gap-4">
		<p class="mt-4 flex flex-row gap-4 justify-self-center text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No supplies leased to a site yet
		</p>
		<Button href="/dashboard/supplies/leases/add-lease"><Plus /> Request a Lease</Button>
	</div>
{:else}
	<div class="my-4 flex flex-row flex-wrap items-center gap-6">
		<h2 class="text-2xl">Leases: {data.pagination.total}</h2>
		{#if data.awaitingApproval > 0}
			<p class="text-yellow-600 dark:text-yellow-500">
				{data.awaitingApproval} awaiting approval
			</p>
		{/if}
		{#if data.outstandingUnits > 0}
			<p class="text-muted-foreground">{data.outstandingUnits} unit(s) still out at sites</p>
		{/if}
	</div>

	<QueryBuilder
		title="Lease Query"
		description="Search by reference or reason, then narrow by site, status or what is still owed"
		searchPlaceholder="Search reference, reason or site..."
		showDate
		totalResults={data.pagination.total}
		initialSearch={data.currentQuery.search}
		initialStart={data.currentQuery.dateStart ?? undefined}
		initialEnd={data.currentQuery.dateEnd ?? undefined}
		initialPageSize={data.pagination.pageSize}
		initialCustomFilters={{
			siteId: data.currentQuery.siteId ?? '',
			status: data.currentQuery.status ?? '',
			dueStatus: data.currentQuery.dueStatus ?? '',
			settlement: data.currentQuery.settlement ?? '',
			requestedById: data.currentQuery.requestedById ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Site</Label>
				<Select
					type="single"
					value={filters.siteId as string}
					onValueChange={(v) => update('siteId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.sites.find((s) => String(s.id) === filters.siteId)?.name ??
							'All sites'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All sites</SelectItem>
						{#each data.filterOptions.sites as site (site.id)}
							<SelectItem value={String(site.id)}>{site.name}</SelectItem>
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
						{LEASE_STATUS_LABELS[filters.status as LeaseStatus] ?? 'Any status'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Any status</SelectItem>
						{#each statusOptions as [value, name] (value)}
							<SelectItem {value}>{name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Due Status</Label>
				<Select
					type="single"
					value={filters.dueStatus as string}
					onValueChange={(v) => update('dueStatus', v as never)}
				>
					<SelectTrigger class="w-full">
						{labelOf(LEASE_DUE_STATUSES, filters.dueStatus as string, 'Any due status')}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Any due status</SelectItem>
						{#each LEASE_DUE_STATUSES as due (due.value)}
							<SelectItem value={due.value}>{due.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Settlement</Label>
				<Select
					type="single"
					value={filters.settlement as string}
					onValueChange={(v) => update('settlement', v as never)}
				>
					<SelectTrigger class="w-full">
						{labelOf(LEASE_SETTLEMENTS, filters.settlement as string, 'Settled or not')}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Settled or not</SelectItem>
						{#each LEASE_SETTLEMENTS as settlement (settlement.value)}
							<SelectItem value={settlement.value}>{settlement.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Requested By</Label>
				<Select
					type="single"
					value={filters.requestedById as string}
					onValueChange={(v) => update('requestedById', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.requesters.find((u) => u.id === filters.requestedById)?.name ??
							'Anyone'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Anyone</SelectItem>
						{#each data.filterOptions.requesters as requester (requester.id)}
							<SelectItem value={requester.id}>{requester.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/snippet}
	</QueryBuilder>

	{#if data.leaseList.length === 0}
		<p class="my-12 text-center text-muted-foreground">No leases match these filters.</p>
	{:else}
		<DataTable data={data.leaseList} {columns} fileName="Supply Leases" />
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
