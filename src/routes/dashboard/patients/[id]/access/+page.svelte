<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { accessColumns } from './columns';

	/** The chart's Access log tab: every opening and printing of this patient's record. */
	let { data } = $props();

	const columns = accessColumns();
</script>

<svelte:head>
	<title>{data.patient.fullName} — Access log</title>
</svelte:head>

<Section title="Who opened this record" IconComp={Eye} style="systemIcon">
	<p class="mb-3 text-sm text-muted-foreground">
		Every time a part of this chart was opened or printed, by whom and from which branch. Repeat
		openings by the same person within a few minutes count once.
	</p>
	{#if data.views.length}
		<DataTable
			{columns}
			data={data.views}
			facetKeys={['user', 'part', 'branch']}
			search
			fileName="access-log"
			height="auto"
		/>
	{:else}
		<p class="text-sm text-muted-foreground">Nobody has opened this chart yet.</p>
	{/if}
</Section>
