<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';

	import { Frown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.siteList);
</script>

<svelte:head>
	<title>Site List</title>
</svelte:head>

{#if data.siteList.length === 0 && !data.currentQuery.search}
	<div class="flex h-96 w-5xl items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No Sites Found
		</p>
	</div>
{:else}
	<h2 class="my-4 text-2xl">No of sites {data.pagination.total}</h2>

	<QueryBuilder
		title="Site Query"
		description="Server-side search across all sites"
		showDate={false}
		totalResults={data.pagination.total}
		initialSearch={data.currentQuery.search}
		initialPageSize={data.pagination.pageSize}
		initialCustomFilters={{
			customerId: data.currentQuery.customerId ?? '',
			subcityId: data.currentQuery.subcityId ?? '',
			addedById: data.currentQuery.addedById ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Customer</Label>
				<Select
					type="single"
					value={filters.customerId as string}
					onValueChange={(v) => update('customerId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.customers.find((c) => String(c.id) === filters.customerId)?.name ??
							'All customers'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All customers</SelectItem>
						{#each data.filterOptions.customers as customer (customer.id)}
							<SelectItem value={String(customer.id)}>{customer.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Subcity</Label>
				<Select
					type="single"
					value={filters.subcityId as string}
					onValueChange={(v) => update('subcityId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.subcities.find((s) => String(s.id) === filters.subcityId)?.name ??
							'All subcities'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All subcities</SelectItem>
						{#each data.filterOptions.subcities as subcity (subcity.id)}
							<SelectItem value={String(subcity.id)}>{subcity.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Added By</Label>
				<Select
					type="single"
					value={filters.addedById as string}
					onValueChange={(v) => update('addedById', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.users.find((u) => String(u.id) === filters.addedById)?.name ??
							'All users'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All users</SelectItem>
						{#each data.filterOptions.users as u (u.id)}
							<SelectItem value={String(u.id)}>{u.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/snippet}
	</QueryBuilder>

	<FilterMenu data={data?.siteList} bind:filteredList filterKeys={['customerName']} />
	<DataTable data={filteredList} fileName="Site List" {columns} />

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
