<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { DAY_LABEL } from '$lib/attendance';
	import DayBadge from '../DayBadge.svelte';
	import { monthColumns } from './columns';

	/**
	 * A month of attendance: every day of everyone at this branch, so who did not come is visible
	 * at a glance — an absence is a working day with nothing recorded, in red. A cell opens that
	 * day's register, where it is ticked, corrected or excused.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let month = $state(data.month);
	const columns = $derived(monthColumns(data.days));
	const absent = $derived(data.rows.reduce((sum, r) => sum + r.absent, 0));
	const absentees = $derived(data.rows.filter((r) => r.absent > 0).length);
	const late = $derived(data.rows.reduce((sum, r) => sum + r.late, 0));
	const monthLabel = $derived(data.month.replace('_', ' '));
</script>

<svelte:head>
	<title>Attendance — {monthLabel}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Attendance — {monthLabel}</h1>
			<p class="text-muted-foreground">
				{absent} absence{absent === 1 ? '' : 's'} by {absentees}
				{absentees === 1 ? 'person' : 'people'} · {late} late arrival{late === 1 ? '' : 's'}.
				Absences are deducted by payroll unless excused.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<label class="sr-only" for="month-select">Month</label>
			<MonthYear bind:value={month} />
			<Button variant="outline" href="?month={encodeURIComponent(month)}">
				Go <ArrowRight class="size-4" />
			</Button>
			<Button href="/dashboard/employees/attendance">
				<ClipboardCheck class="size-4" /> Today’s register
			</Button>
		</div>
	</header>

	<ul class="flex flex-wrap gap-3 text-sm" aria-label="What the letters mean">
		{#each ['present', 'absent', 'excused', 'leave', 'closed', 'notYet'] as const as kind (kind)}
			<li class="flex items-center gap-1">
				<DayBadge {kind} short />
				{DAY_LABEL[kind].label}
			</li>
		{/each}
		<li class="text-muted-foreground">Blank: a day off, or before the register was kept.</li>
	</ul>

	<DataTable
		data={data.rows}
		{columns}
		search
		facetKeys={['department']}
		fileName="Attendance {monthLabel}"
		defaultPageSize={50}
	/>
</div>
