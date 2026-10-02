<script lang="ts">
	import Smile from '@lucide/svelte/icons/smile';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { boardColumns } from './columns';

	/**
	 * Every orthodontic case still being seen here: who is due back for an adjustment, and whose
	 * payments are due to bill or overdue. Filter on Payments for the day's billing list.
	 */
	let { data } = $props();

	const toBill = $derived(data.cases.filter((c) => c.dueUnbilled).length);
	const overdue = $derived(data.cases.filter((c) => c.overdue).length);
</script>

<svelte:head>
	<title>Orthodontics</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<Section title="Orthodontic cases" IconComp={Smile} style="identityIcon">
		<p class="mb-3 text-sm text-muted-foreground">
			{data.cases.length} being seen · {toBill} with instalments due to bill · {overdue} overdue. Open
			a case to bill what is due or record a visit.
		</p>
		{#if data.cases.length}
			<DataTable
				columns={boardColumns}
				data={data.cases}
				facetKeys={['money', 'appliance', 'status']}
				fileName="orthodontic-cases"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No orthodontic case at this branch. Start one on a patient's <strong>Ortho</strong> tab.
			</p>
		{/if}
	</Section>
</div>
