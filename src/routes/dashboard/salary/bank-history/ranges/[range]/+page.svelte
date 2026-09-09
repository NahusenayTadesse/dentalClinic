<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import { Frown } from '@lucide/svelte';
	import DateMonth from '$lib/formComponents/DateMonth.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import AccountsList from '$lib/components/bank-accounts/accounts-list.svelte';
	let filteredList = $derived(data?.allTransactions);
</script>

<svelte:head>
	<title>Bank History</title>
</svelte:head>

<AccountsList bankAccounts={data?.bankAccounts} />

{#if data.allTransactions.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />

			Bank History is Empty for this Date Range Choose Another Range
		</p>
		<DateMonth start={data?.start} end={data?.end} link="/dashboard/salary/bank-history/ranges" />
	</div>
{:else}
	<div class="flex flex-col gap-4">
		<h2 class="my-4 text-2xl">No of Changes: {data.allTransactions?.length}</h2>

		<DateMonth start={data?.start} end={data?.end} link="/dashboard/salary/bank-history/ranges" />
		<FilterMenu
			data={data?.allTransactions}
			bind:filteredList
			filterKeys={['amount', 'bank', 'recievedBy', 'description']}
		/>

		<DataTable
			data={filteredList}
			{columns}
			fileName="Bank History from {formatEthiopianDate(
				new Date(data?.start)
			)} to {formatEthiopianDate(new Date(data?.end))}"
		/>
	</div>
{/if}
