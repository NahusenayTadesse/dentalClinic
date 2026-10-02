<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Printer from '@lucide/svelte/icons/printer';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import { ethiopianDateTime } from '$lib/tableCells';
	import { CYCLE_KIND_LABEL, CYCLE_STATUS_LABEL } from '$lib/sterilisation';
	import { packColumns } from './columns';

	/**
	 * One cycle. Its readings; while the spore test is out, the two buttons to read it; its packs and
	 * who each was opened for. When it has failed, the patients its packs were used on come first:
	 * they are who the clinic calls.
	 */
	let { data } = $props();

	const INDICATOR = { pass: 'Pass', fail: 'Fail', pending: 'Not read yet', none: 'Not used' };

	const c = $derived(data.cycle);
	const exposed = $derived(data.packs.filter((p) => p.patientId !== null));
	const readings = $derived([
		['Steriliser', `${c.steriliser}, cycle ${c.cycleNo}`],
		['Kind', CYCLE_KIND_LABEL[c.kind]],
		['Ran', ethiopianDateTime(c.ranAt)],
		['Program', c.program ?? '—'],
		['Temperature', c.temperatureC === null ? '—' : `${c.temperatureC} °C`],
		['Held', c.holdMinutes === null ? '—' : `${c.holdMinutes} min`],
		['Indicator strip', INDICATOR[c.chemical]],
		[
			'Spore test',
			c.biologicalReadAt
				? `${INDICATOR[c.biological]}, read ${ethiopianDateTime(c.biologicalReadAt)}`
				: INDICATOR[c.biological]
		]
	]);
</script>

<svelte:head>
	<title>{c.steriliser} cycle {c.cycleNo}</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<div class="flex flex-wrap items-center gap-2">
		<Button href="/dashboard/sterilisation" variant="ghost" size="sm">
			<ArrowLeft class="size-4" /> The log
		</Button>
		<div class="ml-auto flex flex-wrap gap-2">
			{#if data.packs.length}
				<Button
					href="/dashboard/sterilisation/{c.id}/labels"
					target="_blank"
					variant="outline"
					size="sm"
				>
					<Printer class="size-4" /> Print labels
				</Button>
			{/if}
			{#if c.biological === 'pending'}
				<StepButton
					id="spore-pass"
					action="?/spore"
					data={data.spore}
					values={{ result: 'pass' }}
					label="Spore test: no growth"
					icon={CircleCheck}
					variant="outline"
				/>
				<StepButton
					id="spore-fail"
					action="?/spore"
					data={data.spore}
					values={{ result: 'fail' }}
					label="Spore test: growth"
					icon={CircleX}
					variant="destructive"
					confirm={{
						title: 'The spores grew?',
						description:
							'The cycle fails. Its unused packs are withdrawn, and the patients its packs were used on are listed here to be called. It cannot be undone.',
						action: 'Fail the cycle'
					}}
				/>
			{/if}
		</div>
	</div>

	{#if c.status === 'failed'}
		<section
			role="alert"
			class="flex flex-col gap-2 rounded-2xl border-2 border-destructive/60 bg-destructive/5 p-4"
		>
			<p class="flex items-center gap-2 text-lg font-bold text-destructive">
				<TriangleAlert class="size-5" /> This cycle failed
			</p>
			{#if exposed.length}
				<p class="text-sm">
					Its packs were used on these patients. Call each, and record the call as a note on their
					chart.
				</p>
				<ul class="flex flex-col gap-1 text-sm">
					{#each exposed as pack (pack.id)}
						<li class="flex flex-wrap items-center gap-2">
							<DataTableLinks
								entity="patient"
								id={pack.patientId}
								name={pack.patient ?? 'Patient'}
								display="inline"
							/>
							{#if pack.fileNo}<span class="text-muted-foreground">{pack.fileNo}</span>{/if}
							{#if pack.phone}<span>{pack.phone}</span>{/if}
							<span class="text-muted-foreground">
								· pack {pack.code}{pack.usedAt ? `, ${ethiopianDateTime(pack.usedAt)}` : ''}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm">
					None of its packs had been used. They are withdrawn: resterilise them.
				</p>
			{/if}
		</section>
	{/if}

	<Section title="Cycle {c.cycleNo}" IconComp={ShieldCheck} style="identityIcon">
		{#snippet editDialog()}
			<Badge
				class="ml-auto"
				variant={c.status === 'failed'
					? 'destructive'
					: c.status === 'pending'
						? 'secondary'
						: 'outline'}
			>
				{CYCLE_STATUS_LABEL[c.status]}
			</Badge>
		{/snippet}
		<dl class="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
			{#each readings as [label, value] (label)}
				<div class="flex justify-between gap-4 border-b py-1">
					<dt class="text-muted-foreground">{label}</dt>
					<dd class="text-right">{value}</dd>
				</div>
			{/each}
		</dl>
		{#if c.note}<p class="mt-3 text-sm whitespace-pre-line">{c.note}</p>{/if}
	</Section>

	{#if data.packs.length}
		<Section title="Packs" IconComp={ShieldCheck} style="identityIcon">
			<DataTable
				columns={packColumns}
				data={data.packs}
				facetKeys={['state', 'contents']}
				fileName="cycle-{c.id}-packs"
				height="auto"
			/>
		</Section>
	{/if}
</div>
