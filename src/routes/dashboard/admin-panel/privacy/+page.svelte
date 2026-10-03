<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
	import Save from '@lucide/svelte/icons/save';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { retention } from './schema';

	/**
	 * Data protection under the Personal Data Protection Proclamation (No. 1321/2024): the retention
	 * period and the records past it, the breach log, and where the patient-facing rights live —
	 * a copy of the record on each chart, and who opened it in its access log.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = createForm(data.form, retention);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
</script>

<svelte:head>
	<title>Data protection</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<Section title="Data protection" IconComp={LockKeyhole} style="identityIcon">
		<ul class="flex list-disc flex-col gap-2 pl-5 text-sm">
			<li>
				<strong>A patient asks for their record:</strong> open their chart and choose
				<em>The patient’s copy of their record</em> — printed, or as a file. Handing it over is logged
				in the chart’s access log. It needs the permission to give a patient their record.
			</li>
			<li>
				<strong>A patient asks who has seen their record:</strong> the chart’s Access log tab, or the
				last section of their copy.
			</li>
			<li>
				<strong>Something has gone wrong</strong> — a lost laptop, a message to the wrong person:
				record it in the
				<a class="underline" href="/dashboard/admin-panel/data-breaches">Breach log</a>.
				{#if data.openBreaches}<span class="text-destructive">{data.openBreaches} still open.</span
					>{/if}
			</li>
		</ul>
	</Section>

	<Section title="How long records are kept" IconComp={Archive} style="identityIcon">
		<form method="post" use:enhance class="mb-4 flex flex-wrap items-end gap-3">
			<div class="w-56">
				<InputComp
					label="Years after the patient was last seen"
					name="recordRetentionYears"
					type="number"
					{form}
					{errors}
				/>
			</div>
			<Button type="submit" disabled={$delayed}>
				{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save{/if}
			</Button>
		</form>
		<p class="mb-3 text-sm text-muted-foreground">
			{data.due.length} record{data.due.length === 1 ? '' : 's'} not seen in {data.years} years. Nothing
			is deleted automatically: review each — a child’s record, or one in a dispute, is kept — and decide.
		</p>
		{#if data.due.length}
			<ul class="flex flex-col divide-y rounded-md border text-sm">
				{#each data.due as p (p.id)}
					<li class="flex items-center gap-3 px-3 py-2">
						<DataTableLinks entity="patient" id={p.id} name={p.name} display="inline" />
						{#if p.fileNo}<span class="text-muted-foreground">{p.fileNo}</span>{/if}
						<span class="ml-auto text-muted-foreground"
							>Last seen {p.lastSeen ? day(p.lastSeen) : '—'}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Section>
</div>
