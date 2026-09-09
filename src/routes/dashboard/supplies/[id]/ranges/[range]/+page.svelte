<script lang="ts">
	import { makeColumns } from './columns';

	let { data } = $props();

	let columns = $derived(makeColumns(data?.isSuperAdmin));

	import DataTable from '$lib/components/Table/data-table.svelte';
	import { Button } from '$lib/components/ui/button/index';

	import Loading from '$lib/components/Loading.svelte';
	import { Frown, ArrowLeft } from '@lucide/svelte';
	import DateMonth from '$lib/formComponents/DateMonth.svelte';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Quantity Change History</title>
</svelte:head>
<Button href="/dashboard/supplies/{page.params.id}" class="justify-self-start"
	><ArrowLeft /> Back</Button
>
{#await data}
	<Loading name="Change History" />
{:then reports}
	{#if data.allTransactions.length === 0}
		<div class="flex h-96 w-5xl flex-col items-center justify-center">
			<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
				<Frown class="h-12 w-16  animate-bounce" />

				Change History is Empty for this Date Range Choose Another Range
			</p>
			<DateMonth
				start={data?.start}
				end={data?.end}
				link="/dashboard/supplies/{page.params.id}/ranges"
			/>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<h2 class="my-4 text-2xl">No of Changes {data.allTransactions?.length}</h2>

			<DateMonth
				start={data?.start}
				end={data?.end}
				link="/dashboard/supplies/{page.params.id}/ranges"
			/>

			<!-- <div class="lg:w-[1250px] w-[350px] lg:p-0 p-2 mt-8 mb-4 pt-4 px-2">


   <DataTable data={data.allTransactions} {columns}  />
 </div> -->
			<DataTable
				data={data.allTransactions}
				{columns}
				fileName="{data?.supply.name} Quantity Change History"
			/>
		</div>
	{/if}
{:catch}
	<div class="flex h-screen w-screen flex-col items-center justify-center">
		<h1 class="text-red-500">Unexpected Error: Reload</h1>
	</div>
{/await}
