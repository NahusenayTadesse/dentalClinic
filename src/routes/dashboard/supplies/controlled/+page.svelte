<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Printer from '@lucide/svelte/icons/printer';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { ethiopianDateTime } from '$lib/tableCells';
	import ControlledReturn from './ControlledReturn.svelte';
	import { MOVEMENT_LABEL } from '$lib/controlledDrugs';

	/**
	 * The controlled-medicine register: the month's return across every controlled item, then the
	 * chosen item's register — each movement with its lot, where it came from or who it went to,
	 * who recorded it, and the balance after it. For the month in progress, the balance is checked
	 * against what the lots hold, and a difference is shown rather than hidden.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let month = $state(data.month);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const query = (item?: number) =>
		`?month=${encodeURIComponent(data.month)}${item ? `&item=${item}` : ''}`;
	const r = $derived(data.register);
</script>

<svelte:head>
	<title>Controlled medicines</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Controlled medicines</h1>
			<p class="text-muted-foreground">
				The register and the monthly return for the Food and Drug Authority · {day(
					data.period.start
				)}
				– {day(data.period.end)}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<MonthYear bind:value={month} />
			<Button variant="outline" href="?month={encodeURIComponent(month)}">
				Go <ArrowRight class="size-4" />
			</Button>
			{#if data.sheet.length}
				<Button href="/dashboard/supplies/controlled/print{query(data.chosen?.id)}" target="_blank">
					<Printer class="size-4" /> Print
				</Button>
			{/if}
		</div>
	</header>

	{#if !data.sheet.length}
		<p class="rounded-md border p-4 text-sm text-muted-foreground">
			No stock item at this branch is a controlled medicine. Mark the medicine as narcotic or
			psychotropic under <strong>Clinic Setup → Medicines</strong>, and link the stock item to it on
			its page.
		</p>
	{:else}
		<Section title="The month's return" IconComp={ShieldAlert} style="identityIcon">
			<ControlledReturn sheet={data.sheet} chosen={data.chosen?.id ?? null} href={query} />
		</Section>

		{#if data.chosen && r}
			<Section
				title="Register: {data.chosen.medicine} {data.chosen.strength ?? ''}"
				IconComp={ShieldAlert}
				style="identityIcon"
			>
				{#snippet editDialog()}
					<Badge variant="outline" class="ml-auto capitalize">{data.chosen?.controlClass}</Badge>
				{/snippet}
				{#if r.shelf && !r.shelf.agrees}
					<p
						role="alert"
						class="mb-3 flex items-center gap-2 rounded-md border border-destructive p-3 text-sm text-destructive"
					>
						<TriangleAlert class="size-4 shrink-0" />
						The register comes to {r.summary.closing} but the shelf holds {r.shelf.onHand}. Stock
						moved without a register line: count it, and record the difference with the reason.
					</p>
				{/if}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-left text-xs text-muted-foreground">
								<th class="py-2 pr-3 font-normal">When</th>
								<th class="pr-3 font-normal">Movement</th>
								<th class="pr-3 font-normal">Batch</th>
								<th class="pr-3 font-normal">From / to</th>
								<th class="pr-3 text-right font-normal">In</th>
								<th class="pr-3 text-right font-normal">Out</th>
								<th class="pr-3 text-right font-normal">Balance</th>
								<th class="font-normal">Recorded by</th>
							</tr>
						</thead>
						<tbody>
							<tr class="border-b">
								<td class="py-2 pr-3" colspan="6">Brought forward</td>
								<td class="pr-3 text-right font-semibold tabular-nums">{r.summary.opening}</td>
								<td></td>
							</tr>
							{#each r.lines as line (line.id)}
								<tr class="border-b align-top">
									<td class="py-2 pr-3 whitespace-nowrap">{ethiopianDateTime(line.at)}</td>
									<td class="pr-3">{MOVEMENT_LABEL[line.movement]}</td>
									<td class="pr-3">{line.batchNumber ?? '—'}</td>
									<td class="pr-3">
										{#if line.patientId}
											<DataTableLinks
												entity="patient"
												id={line.patientId}
												name={line.patient ?? 'Patient'}
												display="inline"
											/>
											{#if line.fileNo}<span class="text-muted-foreground">
													· {line.fileNo}</span
												>{/if}
										{:else if line.supplier}
											{line.supplier}
										{:else}
											<span class="text-muted-foreground">{line.reason ?? '—'}</span>
										{/if}
									</td>
									<td class="pr-3 text-right tabular-nums"
										>{line.quantity > 0 ? line.quantity : ''}</td
									>
									<td class="pr-3 text-right tabular-nums"
										>{line.quantity < 0 ? -line.quantity : ''}</td
									>
									<td class="pr-3 text-right font-semibold tabular-nums">{line.balance}</td>
									<td>{line.recordedBy ?? '—'}</td>
								</tr>
							{:else}
								<tr
									><td colspan="8" class="py-3 text-muted-foreground">No movement this month.</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>
			</Section>
		{/if}
	{/if}
</div>
