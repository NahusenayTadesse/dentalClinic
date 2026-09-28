<script lang="ts">
	import PhoneCall from '@lucide/svelte/icons/phone-call';
	import Section from '$lib/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { columns } from './columns';

	/**
	 * Quotes awaiting an answer, longest-waiting first, and how the last quarter's quotes went.
	 *
	 * The rate is the share of quoted *value* agreed, among plans that have been answered; quotes
	 * still waiting are shown beside it rather than counted as a no.
	 */
	let { data } = $props();

	const a = $derived(data.acceptance);
</script>

<svelte:head>
	<title>Treatment plan follow-up</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Treatment plan follow-up</h1>
		<p class="text-muted-foreground">
			Quotes shown to patients and not yet answered. Ring the longest-waiting first.
		</p>
	</header>

	<section
		class="grid grid-cols-2 gap-4 md:grid-cols-4"
		aria-label="Case acceptance, last {data.acceptanceDays} days"
	>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Case acceptance</p>
			<p class="text-2xl font-bold tabular-nums">{a.rate === null ? '—' : `${a.rate}%`}</p>
			<p class="text-xs text-muted-foreground">of quoted value, last {data.acceptanceDays} days</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Agreed</p>
			<p class="text-2xl font-bold tabular-nums">{formatETB(a.accepted)}</p>
			<p class="text-xs text-muted-foreground">of {formatETB(a.quoted)} answered</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Awaiting an answer</p>
			<p class="text-2xl font-bold tabular-nums">{data.waiting.length}</p>
			<p class="text-xs text-muted-foreground">quotes still standing</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Expired unanswered</p>
			<p class="text-2xl font-bold tabular-nums">{a.expired}</p>
			<p class="text-xs text-muted-foreground">last {data.acceptanceDays} days</p>
		</div>
	</section>

	<Section title="Awaiting an answer" IconComp={PhoneCall} style="identityIcon">
		{#if data.waiting.length}
			<DataTable
				{columns}
				data={data.waiting}
				search
				fileName="plans-awaiting-answer"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No quote is waiting for an answer at this branch. Plans are drawn up and presented from a
				patient’s <em>Treatment plans</em> tab.
			</p>
		{/if}
	</Section>
</div>
