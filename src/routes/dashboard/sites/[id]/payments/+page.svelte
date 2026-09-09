<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { Frown } from '@lucide/svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.payments);
</script>

<svelte:head>
	<title>Site List</title>
</svelte:head>

{#await data}
	<Loading name="Sites" />\
{:then customerList}
	{#if data.payments.length === 0}
		<div class="flex h-96 w-5xl items-center justify-center">
			<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
				<Frown class="h-12 w-16  animate-bounce" />
				No Uncontracted Customers
			</p>
		</div>
	{:else}
		<h2 class="my-4 text-2xl">No of sites {data.payments?.length}</h2>

		<!-- <div class="lg:w-full w-[350px] lg:p-0 p-2 mt-8 mb-4 pt-4">

   <DataTable data={data.customersList} {columns} />
 </div> -->

		<FilterMenu
			data={data?.payments}
			bind:filteredList
			filterKeys={[
				'siteName', // To find payments by specific project/location
				'invoiceNumber', // To find a specific bill
				'fsNumber', // For tax/audit purposes
				'month', // To filter by Amharic month names (e.g., "ሚያዝያ")
				'year', // To filter by budget year
				'addedBy' // To see which staff member processed the entry
			]}
		/>
		<DataTable data={filteredList} fileName="Site List" {columns} />
	{/if}
{:catch}
	<div class="flex h-screen w-screen flex-col items-center justify-center">
		<h1 class="text-red-500">Unexpected Error: Reload</h1>
	</div>
{/await}
