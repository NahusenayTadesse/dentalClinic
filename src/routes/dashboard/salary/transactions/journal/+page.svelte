<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Download from '@lucide/svelte/icons/download';
	import ListTree from '@lucide/svelte/icons/list-tree';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import AccountCodes from './AccountCodes.svelte';

	/**
	 * The accounting export: pick a month, check it — every account coded, every entry balanced,
	 * little in suspense — and download it for Peachtree or any ledger. The account codes are set
	 * below, once, from the accountant's chart of accounts.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let month = $state(data.month);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const query = $derived(`?month=${encodeURIComponent(data.month)}`);
	const ready = $derived(!data.unmapped.length && !data.unbalanced && data.count > 0);
</script>

<svelte:head>
	<title>Accounting export</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Accounting export</h1>
			<p class="text-muted-foreground">
				A month of money as journal entries, for Peachtree or any ledger · {day(data.period.start)} –
				{day(data.period.end)}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<MonthYear bind:value={month} />
			<Button variant="outline" href="?month={encodeURIComponent(month)}">
				Go <ArrowRight class="size-4" />
			</Button>
		</div>
	</header>

	<Section title="The month" IconComp={BookOpen} style="identityIcon">
		<div class="flex flex-col gap-3">
			<p class="text-sm">
				{data.count} entries · {formatETB(data.debits)} debited, the same credited.
				{#if data.suspense}
					<span class="text-amber-600 dark:text-amber-400">
						{data.suspense} could not be placed and go to suspense, for the accountant to post.
					</span>
				{/if}
			</p>
			{#if data.unmapped.length}
				<p
					role="alert"
					class="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm text-destructive"
				>
					<TriangleAlert class="mt-0.5 size-4 shrink-0" />
					<span>Give these an account code below before exporting: {data.unmapped.join(', ')}.</span
					>
				</p>
			{/if}
			{#if data.unbalanced}
				<p role="alert" class="rounded-md border border-destructive p-3 text-sm text-destructive">
					{data.unbalanced} entries do not balance. Nothing can be exported until they do.
				</p>
			{/if}
			{#if ready}
				<div class="flex flex-wrap gap-2">
					<Button
						href="/dashboard/salary/transactions/journal/export{query}&format=peachtree"
						download
					>
						<Download class="size-4" /> Peachtree (Sage 50)
					</Button>
					<Button
						href="/dashboard/salary/transactions/journal/export{query}&format=journal"
						variant="outline"
						disabled={!ready}
						download
					>
						<Download class="size-4" /> Plain journal (CSV)
					</Button>
				</div>
			{/if}

			{#if data.preview.length}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-left text-xs text-muted-foreground">
								<th class="py-2 pr-3 font-normal">Date</th>
								<th class="pr-3 font-normal">Reference</th>
								<th class="pr-3 font-normal">Description</th>
								<th class="pr-3 font-normal">Account</th>
								<th class="pr-3 text-right font-normal">Debit</th>
								<th class="text-right font-normal">Credit</th>
							</tr>
						</thead>
						<tbody>
							{#each data.preview as entry, e (e)}
								{#each entry.lines as line, i (i)}
									<tr class={i === entry.lines.length - 1 ? 'border-b' : ''}>
										<td class="py-1 pr-3 whitespace-nowrap">{i === 0 ? day(entry.date) : ''}</td>
										<td class="pr-3">{i === 0 ? entry.reference : ''}</td>
										<td class="pr-3">{i === 0 ? entry.description : ''}</td>
										<td
											class="pr-3 font-mono {line.account === 'UNMAPPED' ? 'text-destructive' : ''}"
										>
											{line.account}
										</td>
										<td class="pr-3 text-right tabular-nums"
											>{line.debit ? line.debit.toFixed(2) : ''}</td
										>
										<td class="text-right tabular-nums"
											>{line.credit ? line.credit.toFixed(2) : ''}</td
										>
									</tr>
								{/each}
							{/each}
						</tbody>
					</table>
					{#if data.count > data.preview.length}
						<p class="mt-2 text-xs text-muted-foreground">
							The first {data.preview.length} of {data.count}; the file has them all.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</Section>

	<Section title="Account codes" IconComp={ListTree} style="identityIcon">
		<p class="mb-3 text-sm text-muted-foreground">
			From the accountant's chart of accounts. Set once; a new payment method or expense type
			appears here to be given its code.
		</p>
		<AccountCodes data={data.form} targets={data.targets} />
	</Section>
</div>
