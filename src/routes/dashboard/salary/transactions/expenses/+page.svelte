<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '@nahu/admin-kit/queryFilters.js';
	import { makeColumns } from './columns';

	let { data } = $props();

	let columns = $derived(makeColumns(data?.isSuperAdmin));

	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	import { Frown } from '@lucide/svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.allTransactions);
</script>

<svelte:head>
	<title>Expenses</title>
</svelte:head>

<QueryBuilder
	title="Other Expenses Query"
	description="Filter expenses by date, type, payment method, or recipient"
	showDate
	totalResults={data.pagination.total}
	initialSearch={data.currentQuery.search}
	initialStart={data.currentQuery.dateStart ?? undefined}
	initialEnd={data.currentQuery.dateEnd ?? undefined}
	initialPageSize={data.pagination.pageSize}
	initialCustomFilters={{
		paymentMethodId: data.currentQuery.paymentMethodId ?? '',
		expenseTypeId: data.currentQuery.expenseTypeId ?? '',
		recievedById: data.currentQuery.recievedById ?? ''
	}}
	onQueryChange={applyQueryToUrl}
>
	{#snippet children(filters, update)}
		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Other Expense Type</Label>
			<Select
				type="single"
				value={filters.expenseTypeId as string}
				onValueChange={(v) => update('expenseTypeId', v as never)}
			>
				<SelectTrigger class="w-full">
					{data.filterOptions.expenseTypes.find((t) => String(t.id) === filters.expenseTypeId)
						?.name ?? 'All types'}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All types</SelectItem>
					{#each data.filterOptions.expenseTypes as type (type.id)}
						<SelectItem value={String(type.id)}>{type.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Payment Method</Label>
			<Select
				type="single"
				value={filters.paymentMethodId as string}
				onValueChange={(v) => update('paymentMethodId', v as never)}
			>
				<SelectTrigger class="w-full">
					{data.filterOptions.paymentMethods.find((m) => String(m.id) === filters.paymentMethodId)
						?.name ?? 'All methods'}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All methods</SelectItem>
					{#each data.filterOptions.paymentMethods as method (method.id)}
						<SelectItem value={String(method.id)}>{method.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="flex flex-col gap-2">
			<Label class="text-sm font-medium">Received By</Label>
			<Select
				type="single"
				value={filters.recievedById as string}
				onValueChange={(v) => update('recievedById', v as never)}
			>
				<SelectTrigger class="w-full">
					{data.filterOptions.users.find((u) => u.id === filters.recievedById)?.name ?? 'All users'}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All users</SelectItem>
					{#each data.filterOptions.users as u (u.id)}
						<SelectItem value={u.id}>{u.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>
	{/snippet}
</QueryBuilder>

{#if data.allTransactions.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No Expenses Found for this Filter
		</p>
	</div>
{:else}
	<div class="flex flex-col gap-4">
		<h2 class="my-4 text-2xl">No of Other Expenses: {data.pagination.total}</h2>

		<FilterMenu
			data={data?.allTransactions}
			bind:filteredList
			filterKeys={['amount', 'expenseType', 'paymentMethods', 'recievedBy']}
		/>

		<DataTable
			data={filteredList}
			{columns}
			fileName={data.currentQuery.dateStart && data.currentQuery.dateEnd
				? `Expenses from ${formatEthiopianDate(new Date(data.currentQuery.dateStart))} to ${formatEthiopianDate(new Date(data.currentQuery.dateEnd))}`
				: 'Expenses'}
		/>

		{#if data.pagination.total > data.pagination.pageSize}
			<div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
				<span>
					Page {data.pagination.page} of {Math.ceil(
						data.pagination.total / data.pagination.pageSize
					)}
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
	</div>
{/if}
