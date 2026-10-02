<script lang="ts">
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import { labCaseColumns } from '$lib/components/labCases/columns';
	import { performanceColumns } from './columns';

	/**
	 * The lab board: what is out, what is late, and what is back to fit. New work is sent from the
	 * patient's Lab work tab, where the tooth and the treatment are; this page moves it on.
	 */
	let { data } = $props();

	const columns = $derived(labCaseColumns({ withPatient: true, move: data.move }));

	const TILES = $derived<Stat[]>([
		{
			key: 'preparing',
			label: 'Being prepared',
			value: data.summary.preparing,
			format: 'count',
			group: 'lab'
		},
		{ key: 'out', label: 'At the lab', value: data.summary.out, format: 'count', group: 'lab' },
		{
			key: 'overdue',
			label: 'Overdue from the lab',
			value: data.summary.overdue,
			format: 'count',
			group: 'lab',
			tone: data.summary.overdue ? 'warning' : 'neutral'
		},
		{
			key: 'ready',
			label: 'Back — ready to fit',
			value: data.summary.ready,
			format: 'count',
			group: 'lab'
		}
	]);
</script>

<svelte:head>
	<title>Lab Work</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Lab Work</h1>
		<p class="text-muted-foreground">
			Work at this branch that is out at a laboratory or back and not yet fitted. Send new work from
			the patient’s <strong>Lab work</strong> tab.
		</p>
	</header>

	<section class="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Lab work at a glance">
		{#each TILES as stat (stat.key)}
			<StatCard {stat} />
		{/each}
	</section>

	<Section title="Open cases" IconComp={FlaskConical} style="identityIcon">
		{#if data.cases.length}
			<DataTable
				{columns}
				data={data.cases}
				facetKeys={['status', 'lab']}
				search
				fileName="lab-work"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">Nothing is out at a laboratory from this branch.</p>
		{/if}
	</Section>

	<Section title="How the laboratories have done" IconComp={Gauge} style="identityIcon">
		<p class="mb-3 text-sm text-muted-foreground">
			Work sent in the past year. Late is received after the day the laboratory promised.
		</p>
		{#if data.performance.length}
			<DataTable
				data={data.performance}
				columns={performanceColumns}
				variant="compact"
				fileName="laboratory-performance"
				rowClass={(lab) => (lab.remakes ? 'bg-destructive/10' : null)}
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No work has come back from a laboratory this year.
			</p>
		{/if}
	</Section>
</div>
