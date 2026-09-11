<script>
	import { Button } from '$lib/components/ui/button/index';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { renderComponent } from '$lib/components/ui/data-table/index.js';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import { formatDays } from '$lib/leaveDays';
	import { superForm } from 'sveltekit-superforms/client';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { CalendarPlus, TriangleAlert, CircleCheckBig, CircleX, Clock } from '@lucide/svelte';

	let { data } = $props();

	const { enhance, delayed, message } = superForm(data.form, { invalidateAll: true });

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	const staffLink = ({ row }) =>
		renderComponent(DataTableLinks, {
			id: row.original.staffId,
			name: row.original.name,
			entity: 'employee'
		});

	const grantColumns = [
		{ accessorKey: 'name', header: 'Employee', cell: staffLink },
		{ accessorKey: 'hireDate', header: 'Hired' },
		{ accessorKey: 'serviceYear', header: 'Service Year' },
		{ accessorKey: 'grantDate', header: 'Grant Date' },
		{ accessorKey: 'expiryDate', header: 'Expires On' },
		{ accessorKey: 'days', header: 'Days', cell: (info) => formatDays(info.getValue()) }
	];

	const expiryColumns = [
		{ accessorKey: 'name', header: 'Employee', cell: staffLink },
		{ accessorKey: 'serviceYear', header: 'Service Year' },
		{ accessorKey: 'grantDate', header: 'Granted' },
		{ accessorKey: 'expiryDate', header: 'Expired On' },
		{ accessorKey: 'daysGranted', header: 'Granted', cell: (info) => formatDays(info.getValue()) },
		{ accessorKey: 'daysUsed', header: 'Used', cell: (info) => formatDays(info.getValue()) },
		{ accessorKey: 'daysLost', header: 'Days Voided', cell: (info) => formatDays(info.getValue()) }
	];

	const skippedColumns = [
		{ accessorKey: 'name', header: 'Employee', cell: staffLink },
		{ accessorKey: 'serviceYear', header: 'Service Year' },
		{ accessorKey: 'reason', header: 'Why It Was Skipped' }
	];

	let host = $derived(page.url.host);

	let totalDays = $derived(data.pendingGrants.reduce((sum, g) => sum + g.days, 0));
	let totalLost = $derived(data.pendingExpiries.reduce((sum, g) => sum + g.daysLost, 0));
	let nothingDue = $derived(data.pendingGrants.length === 0 && data.pendingExpiries.length === 0);

	let hoursSinceRun = $derived(
		data.lastRun ? (Date.now() - new Date(data.lastRun.startedAt).getTime()) / 3600000 : null
	);
	// Matches the window the request backstop uses to decide the cron has gone quiet.
	let cronLooksStale = $derived(
		data.lastRun === null ||
			data.lastRun.status === 'failed' ||
			(hoursSinceRun ?? 0) >= data.backstopAfterHours
	);

	const runLabel = { cron: 'Scheduled', manual: 'Run by hand', backstop: 'Backstop' };

	function whenText(value) {
		const stamp = new Date(value);
		const hours = (Date.now() - stamp.getTime()) / 3600000;
		const rel =
			hours < 1
				? 'less than an hour ago'
				: hours < 24
					? `${Math.round(hours)} hours ago`
					: `${Math.round(hours / 24)} days ago`;
		return `${stamp.toLocaleString()} (${rel})`;
	}
</script>

<svelte:head>
	<title>Run Leave Accrual</title>
</svelte:head>

<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
	<p class="max-w-2xl text-sm text-muted-foreground">
		A daily cron runs this job. Review what is due below, or run it now — a manual run is recorded
		the same way the scheduled one is.
	</p>

	<form action="?/run" method="post" use:enhance>
		<Button type="submit" disabled={nothingDue}>
			{#if $delayed}
				<LoadingBtn name="Running Leave Job" />
			{:else}
				<CalendarPlus /> Run Now
			{/if}
		</Button>
	</form>
</div>

<div
	class="mb-8 rounded-lg border p-4 {cronLooksStale
		? 'border-amber-500/50 bg-amber-500/5'
		: 'border-border/60'}"
>
	<h3 class="mb-2 flex items-center gap-2 font-semibold">
		{#if data.lastRun === null}
			<TriangleAlert class="h-4 w-4 text-amber-500" /> The job has never run
		{:else if data.lastRun.status === 'failed'}
			<CircleX class="h-4 w-4 text-red-500" /> Last run failed
		{:else if data.lastRun.status === 'running'}
			<Clock class="h-4 w-4" /> A run is in progress
		{:else if cronLooksStale}
			<TriangleAlert class="h-4 w-4 text-amber-500" /> The cron looks overdue
		{:else}
			<CircleCheckBig class="h-4 w-4 text-emerald-500" /> Cron is healthy
		{/if}
	</h3>

	{#if data.lastRun}
		<p class="text-sm text-muted-foreground">
			{runLabel[data.lastRun.trigger] ?? data.lastRun.trigger} run, {whenText(
				data.lastRun.startedAt
			)}.
			{#if data.lastRun.error}
				<span class="text-red-500">{data.lastRun.error}</span>
			{:else if data.lastRun.summary}
				{data.lastRun.summary}.
			{/if}
		</p>
		{#if cronLooksStale && data.lastRun.status !== 'failed'}
			<p class="mt-1 text-sm text-amber-500">
				Nothing has succeeded in {data.backstopAfterHours} hours — check the cron entry. Signed-in traffic
				will run it as a fallback in the meantime.
			</p>
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">
			Set up the daily cron, or press Run Now to do it by hand this once.
		</p>
	{/if}

	<details class="mt-3 text-sm">
		<summary class="cursor-pointer text-muted-foreground hover:text-foreground">
			cPanel cron setup
		</summary>
		<p class="mt-2 text-muted-foreground">
			Add a cron job set to <strong>once a day</strong> (<code>0 2 * * *</code> runs it at 2am),
			with this command. Replace the secret with the value of <code>LEAVE_CRON_SECRET</code> from the
			server's environment — it is deliberately not shown on this page.
		</p>
		<pre
			class="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">curl -fsS -H "Authorization: Bearer YOUR_LEAVE_CRON_SECRET" https://{host}/api/cron/leave-accrual</pre>
		<p class="mt-2 text-muted-foreground">
			The job is safe to run repeatedly — running it twice grants nothing extra. If the schedule
			stops firing, signed-in traffic picks it up after {data.backstopAfterHours} hours.
		</p>
	</details>
</div>

<div class="mb-8 grid gap-4 md:grid-cols-2">
	<div class="rounded-lg border border-border/60 p-4">
		<h3 class="mb-2 font-semibold">Entitlement Brackets</h3>
		{#if data.brackets.length === 0}
			<p class="flex items-center gap-2 text-sm text-amber-500">
				<TriangleAlert class="h-4 w-4" /> No active brackets — nothing can be granted.
			</p>
		{:else}
			<ul class="text-sm text-muted-foreground">
				{#each data.brackets as bracket}
					<li>
						{bracket.toYears === null
							? `${bracket.fromYears} years and above`
							: bracket.fromYears === bracket.toYears
								? `Year ${bracket.fromYears}`
								: `${bracket.fromYears} to ${bracket.toYears} years`} → {bracket.days} days
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded-lg border border-border/60 p-4">
		<h3 class="mb-2 font-semibold">Expiry Policy</h3>
		{#if data.policy}
			<p class="text-sm text-muted-foreground">
				{data.policy.name}: unused leave is voided {data.policy.expiryYears}
				{data.policy.expiryYears === 1 ? 'year' : 'years'} after it was granted.
			</p>
		{:else}
			<p class="flex items-center gap-2 text-sm text-amber-500">
				<TriangleAlert class="h-4 w-4" /> No active policy — grants would never expire.
			</p>
		{/if}
	</div>
</div>

<section class="mb-10">
	<h2 class="mb-3 text-xl font-semibold">
		Leave Due to Be Granted
		<span class="ml-2 text-sm font-normal text-muted-foreground">
			{data.pendingGrants.length} entries · {totalDays} days
		</span>
	</h2>

	{#if data.pendingGrants.length === 0}
		<p class="text-sm text-muted-foreground">Every active employee is up to date.</p>
	{:else}
		{#key data.pendingGrants}
			<DataTable
				columns={grantColumns}
				data={data.pendingGrants}
				search={true}
				fileName="Pending Leave Grants"
			/>
		{/key}
	{/if}
</section>

<section class="mb-10">
	<h2 class="mb-3 text-xl font-semibold">
		Stale Leave Due to Be Voided
		<span class="ml-2 text-sm font-normal text-muted-foreground">
			{data.pendingExpiries.length} grants · {totalLost} unused days
		</span>
	</h2>

	{#if data.pendingExpiries.length === 0}
		<p class="text-sm text-muted-foreground">No grants have gone stale.</p>
	{:else}
		{#key data.pendingExpiries}
			<DataTable
				columns={expiryColumns}
				data={data.pendingExpiries}
				search={true}
				fileName="Expiring Leave Grants"
			/>
		{/key}
	{/if}
</section>

{#if data.skipped.length > 0}
	<section class="mb-10">
		<h2 class="mb-3 text-xl font-semibold">
			Skipped
			<span class="ml-2 text-sm font-normal text-muted-foreground">
				{data.skipped.length} entries need a matching bracket
			</span>
		</h2>
		{#key data.skipped}
			<DataTable
				columns={skippedColumns}
				data={data.skipped}
				search={true}
				fileName="Skipped Leave Grants"
			/>
		{/key}
	</section>
{/if}
