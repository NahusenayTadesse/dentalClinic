<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { ArrowBigRight, Frown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';

	let filteredList = $derived(data?.contracts);

	// Now sourced from the dedicated, unpaginated urgentContracts query —
	// stays accurate no matter what page/filter is Terminated on the main table.
	let sortedUrgent = $derived(
		[...(data?.urgentContracts ?? [])].sort((a, b) => a.daysRemaining - b.daysRemaining)
	);
</script>

<svelte:head>
	<title>Terminated Contracts</title>
</svelte:head>

{#if data.contracts.length === 0 && !data.currentQuery.search}
	<div class="flex h-96 w-5xl items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No Terminated Contracts.
		</p>
	</div>
{:else}
	<h2 class="my-4 text-2xl">No of Terminated Contracts: {data.pagination.total}</h2>

	{#if sortedUrgent.length > 0}
		<section
			class="mb-8 w-auto justify-self-center overflow-hidden rounded-xl border border-red-200 bg-red-50 p-1 shadow-lg transition-all dark:border-red-900/50 dark:bg-red-950/30"
		>
			<div class="flex items-center gap-3 px-4 py-3 text-red-800 dark:text-red-200">
				<div class="relative flex h-3 w-3">
					<span
						class="absolute inline-flex h-full w-full scale-200 animate-ping rounded-full bg-red-400 opacity-75"
					></span>
					<span class="relative inline-flex h-3 w-3 scale-200 rounded-full bg-red-600"></span>
				</div>

				<h3 class="text-sm font-bold tracking-wider uppercase">
					Urgent: {sortedUrgent.length}
					{sortedUrgent.length === 1 ? 'Contract' : 'Contracts'} Expiring Soon
				</h3>
			</div>

			<div class="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each sortedUrgent as contract (contract.id)}
					<div
						class="group relative flex flex-col justify-between rounded-lg border border-red-200 bg-white p-4 shadow-sm transition-colors hover:bg-red-100/50 dark:border-red-800/40 dark:bg-neutral-900 dark:hover:bg-red-900/20"
					>
						<div>
							<div class="flex items-start justify-between">
								<h4 class="font-bold text-neutral-900 dark:text-white">
									{contract.site}
								</h4>
								<span class="text-xs font-medium text-red-600 dark:text-red-400">
									{contract.daysRemaining <= 0 ? 'Expired' : `${contract.daysRemaining}d left`}
								</span>
							</div>
							<p class="text-sm text-neutral-500 dark:text-neutral-400">
								{contract.service}
							</p>
						</div>

						<div
							class="mt-3 flex items-center justify-between border-t border-red-100 pt-3 dark:border-red-900/30"
						>
							<span class="text-xs text-neutral-400">
								Ends: {formatEthiopianDate(new Date(contract.endDate))}
							</span>
							<a
								href="/dashboard/contracts/{contract.id}/payment-history"
								class="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
							>
								Renew <ArrowBigRight />
							</a>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<QueryBuilder
		title="Contract Query"
		description="Server-side search across all Terminated contracts"
		showDate
		totalResults={data.pagination.total}
		initialSearch={data.currentQuery.search}
		initialStart={data.currentQuery.dateStart ?? undefined}
		initialEnd={data.currentQuery.dateEnd ?? undefined}
		initialPageSize={data.pagination.pageSize}
		initialCustomFilters={{
			serviceId: data.currentQuery.serviceId ?? '',
			signingOfficerId: data.currentQuery.signingOfficerId ?? '',
			contractYear: data.currentQuery.contractYear ?? '',
			commission: data.currentQuery.commission ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Service</Label>
				<Select
					type="single"
					value={filters.serviceId as string}
					onValueChange={(v) => update('serviceId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.services.find((s) => String(s.id) === filters.serviceId)?.name ??
							'All services'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All services</SelectItem>
						{#each data.filterOptions.services as svc (svc.id)}
							<SelectItem value={String(svc.id)}>{svc.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Signing Officer</Label>
				<Select
					type="single"
					value={filters.signingOfficerId as string}
					onValueChange={(v) => update('signingOfficerId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.signingOfficers.find(
							(o) => String(o.id) === filters.signingOfficerId
						)?.name ?? 'All officers'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All officers</SelectItem>
						{#each data.filterOptions.signingOfficers as officer (officer.id)}
							<SelectItem value={String(officer.id)}>{officer.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Contract Year</Label>
				<Select
					type="single"
					value={filters.contractYear as string}
					onValueChange={(v) => update('contractYear', v as never)}
				>
					<SelectTrigger class="w-full">
						{filters.contractYear || 'All years'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All years</SelectItem>
						{#each data.filterOptions.contractYears as year (year)}
							<SelectItem value={String(year)}>{year}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/snippet}
	</QueryBuilder>

	<FilterMenu
		data={data?.contracts}
		bind:filteredList
		filterKeys={[
			'site',
			'service',
			'monthlyAmount',
			'signingOfficer',
			'contractYear',
			'officeCommission',
			'expectedPayments',
			'actualPayments',
			'missingPayments',
			'numberOfRenewals',
			'signingOfficerName'
		]}
	/>
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
