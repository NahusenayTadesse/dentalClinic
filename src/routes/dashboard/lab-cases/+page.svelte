<script lang="ts">
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Section from '$lib/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { labCaseColumns } from '$lib/components/labCases/columns';

	/**
	 * The lab board: what is out, what is late, and what is back to fit. New work is sent from the
	 * patient's Lab work tab, where the tooth and the treatment are; this page moves it on.
	 */
	let { data } = $props();

	const columns = $derived(labCaseColumns({ withPatient: true, move: data.move }));

	const TILES = $derived([
		{ label: 'Being prepared', value: data.summary.preparing, warn: false },
		{ label: 'At the lab', value: data.summary.out, warn: false },
		{ label: 'Overdue from the lab', value: data.summary.overdue, warn: true },
		{ label: 'Back — ready to fit', value: data.summary.ready, warn: false }
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
		{#each TILES as tile (tile.label)}
			<div class="rounded-lg border bg-card p-4">
				<p class="text-sm text-muted-foreground">{tile.label}</p>
				<p
					class="text-2xl font-bold tabular-nums {tile.warn && tile.value
						? 'text-destructive'
						: ''}"
				>
					{tile.value}
				</p>
			</div>
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
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="text-left text-muted-foreground">
						<tr class="border-b">
							<th class="py-2 pr-4 font-medium">Laboratory</th>
							<th class="py-2 pr-4 text-right font-medium">Cases</th>
							<th class="py-2 pr-4 text-right font-medium">Usually says</th>
							<th class="py-2 pr-4 text-right font-medium">Took on average</th>
							<th class="py-2 pr-4 text-right font-medium">Late</th>
							<th class="py-2 text-right font-medium">Remakes</th>
						</tr>
					</thead>
					<tbody>
						{#each data.performance as lab (lab.lab)}
							<tr class="border-b last:border-0">
								<td class="py-2 pr-4">{lab.lab}</td>
								<td class="py-2 pr-4 text-right tabular-nums">{lab.cases}</td>
								<td class="py-2 pr-4 text-right tabular-nums">
									{lab.promised ? `${lab.promised} days` : '—'}
								</td>
								<td class="py-2 pr-4 text-right tabular-nums">
									{lab.averageDays === null ? '—' : `${lab.averageDays} days`}
								</td>
								<td class="py-2 pr-4 text-right tabular-nums">
									{lab.late}{lab.averageLateDays ? ` · ${lab.averageLateDays} days on average` : ''}
								</td>
								<td class="py-2 text-right tabular-nums {lab.remakes ? 'text-destructive' : ''}">
									{lab.remakes}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				No work has come back from a laboratory this year.
			</p>
		{/if}
	</Section>
</div>
