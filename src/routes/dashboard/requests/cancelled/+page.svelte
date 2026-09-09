<script lang="ts">
	import { fade } from 'svelte/transition';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import RequestFilters from '../RequestFilters.svelte';
	import Receipt from '../Receipt.svelte';
	import Penality from './penality.svelte';
	import { idsField } from '../receipts';
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Frown } from '@lucide/svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';

	let { data } = $props();

	const totalPages = $derived(Math.ceil(data.pagination.total / data.pagination.pageSize));

	const periodLabel = (months: { month: string; year: number }[]) => {
		if (months.length === 1) return `${months[0].month} ${months[0].year}`;
		const first = months[0];
		const last = months[months.length - 1];
		return `${months.length} months · ${first.month} ${first.year} – ${last.month} ${last.year}`;
	};
</script>

<svelte:head>
	<title>Cancelled Requests</title>
</svelte:head>

<div class="mx-auto w-full max-w-305!">
	<QueryBuilder
		title="Requests Query"
		description="Server-side search across rejected requests"
		showDate
		totalResults={data.pagination.total}
		searchPlaceholder="Search site, customer or invoice number..."
		initialSearch={data.currentQuery.search}
		initialStart={data.currentQuery.dateStart ?? undefined}
		initialEnd={data.currentQuery.dateEnd ?? undefined}
		initialPageSize={data.pagination.pageSize}
		defaultPageSize={10}
		initialCustomFilters={{
			month: data.currentQuery.month ?? '',
			year: data.currentQuery.year ?? '',
			customerId: data.currentQuery.customerId ?? '',
			requestedBy: data.currentQuery.requestedBy ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<RequestFilters {filters} {update} filterOptions={data.filterOptions} />
		{/snippet}
	</QueryBuilder>
</div>

{#key data?.receipts}
	<div class="flex min-h-screen flex-col items-center justify-center p-4 lg:p-8">
		<div class="my-4 w-4xl justify-self-center">
			<h2 class="mb-6">
				{data.pagination.total} rejected invoice{data.pagination.total === 1 ? '' : 's'}
				{#if totalPages > 1}
					· showing {data.receipts.length} on page {data.pagination.page} of {totalPages}
				{/if}
			</h2>
		</div>

		{#if data.receipts.length === 0}
			<div class="flex h-96 flex-col items-center justify-center gap-4">
				<p class="flex flex-row gap-4 text-center text-3xl">
					<Frown class="h-10 w-14 animate-bounce" />
					No rejected requests match this query
				</p>
				<p class="text-sm text-zinc-500">Clear the filters in the query bar above.</p>
				<Button variant="outline" href="/dashboard/requests/pending">Go to pending requests</Button>
			</div>
		{/if}

		<div class="flex flex-col items-center gap-16 pb-20">
			{#each data.receipts as receipt (receipt.key)}
				<div class="flex flex-col items-center gap-6" transition:fade={{ duration: 600 }}>
					<Receipt
						invoiceNumber={receipt.invoiceNumber}
						siteId={receipt.siteId}
						siteName={receipt.head.siteName}
						customerName={receipt.head.customerName}
						requestDate={receipt.head.requestDate}
						months={receipt.months}
						contracts={data.contracts}
						vat={data.vats.vat}
						withhold={data.vats.withHold}
						employees={data.employees}
						requestedBy={receipt.head.requestedBy}
						approvedBy={receipt.head.approvedBy}
					/>

					<Penality
						ids={receipt.ids}
						data={data?.form}
						rejectedReason={receipt.head.rejectedReason}
						months={receipt.months}
						requestedBy={receipt.head.requestedBy}
						employees={data?.employees}
						requestDate={receipt.head.requestDate}
					/>

					{#if data?.isSuperAdmin}
						<div class="flex w-full max-w-212.5 justify-end">
							<DeleteEntity
								entity="Payment Request"
								name="{receipt.invoiceNumber} ({periodLabel(receipt.months)})"
								consequence={receipt.ids.length > 1
									? `All ${receipt.ids.length} months on this invoice are removed together.`
									: ''}
								id={idsField(receipt.ids)}
								canDelete={data?.isSuperAdmin}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if totalPages > 1}
			<div
				class="mx-auto mb-16 flex w-full max-w-212.5 items-center justify-between text-sm text-muted-foreground"
			>
				<span>Page {data.pagination.page} of {totalPages}</span>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={data.pagination.page <= 1}
						onclick={() => navigateWithQuery({ page: data.pagination.page - 1 })}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={data.pagination.page >= totalPages}
						onclick={() => navigateWithQuery({ page: data.pagination.page + 1 })}
					>
						Next
					</Button>
				</div>
			</div>
		{/if}
	</div>
{/key}
