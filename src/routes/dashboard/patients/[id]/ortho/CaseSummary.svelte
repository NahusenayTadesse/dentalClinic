<script lang="ts">
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import {
		APPLIANCE_LABEL,
		ORTHO_STATUS_LABEL,
		type Appliance,
		type OrthoStatus
	} from '$lib/orthoPlan';

	/**
	 * A case at a glance: what the patient wears, how many months in against the plan, and where the
	 * money stands. Shared by the tab's list and the case's own page.
	 */
	let {
		c
	}: {
		c: {
			appliance: Appliance;
			status: OrthoStatus;
			startedOn: string;
			plannedMonths: number;
			totalFee: number;
			provider: string | null;
			progress: { months: number; percent: number; overrun: boolean };
			paid: number;
			owed: number;
			dueUnbilled: number;
			overdue: number;
			next: { dueOn: string; amount: number } | null;
		};
	} = $props();

	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<span class="font-semibold">{APPLIANCE_LABEL[c.appliance]}</span>
		<Badge variant={c.status === 'active' ? 'default' : 'outline'}
			>{ORTHO_STATUS_LABEL[c.status]}</Badge
		>
		<span class="text-sm text-muted-foreground">
			Started {day(c.startedOn)}{c.provider ? ` · ${c.provider}` : ''}
		</span>
	</div>

	<div class="flex flex-col gap-1">
		<div class="flex justify-between text-xs text-muted-foreground">
			<span>Month {c.progress.months} of {c.plannedMonths}</span>
			{#if c.progress.overrun}<span class="text-destructive">Past the planned length</span>{/if}
		</div>
		<div class="h-2 overflow-hidden rounded-full bg-muted">
			<div
				class="h-full {c.progress.overrun ? 'bg-destructive' : 'bg-primary'}"
				style:width="{c.progress.percent}%"
			></div>
		</div>
	</div>

	<dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
		<div>
			<dt class="text-xs text-muted-foreground">Fee</dt>
			<dd class="tabular-nums">{formatETB(c.totalFee)}</dd>
		</div>
		<div>
			<dt class="text-xs text-muted-foreground">Paid</dt>
			<dd class="tabular-nums">{formatETB(c.paid)}</dd>
		</div>
		<div>
			<dt class="text-xs text-muted-foreground">Billed, unpaid</dt>
			<dd class="tabular-nums {c.overdue ? 'text-destructive' : ''}">
				{formatETB(c.owed)}{c.overdue ? ` · ${c.overdue} overdue` : ''}
			</dd>
		</div>
		<div>
			<dt class="text-xs text-muted-foreground">Next</dt>
			<dd>
				{#if c.dueUnbilled}
					<span class="text-amber-600 dark:text-amber-400">{c.dueUnbilled} due to bill</span>
				{:else if c.next}
					<span class="tabular-nums">{formatETB(c.next.amount)}</span> on {day(c.next.dueOn)}
				{:else}
					—
				{/if}
			</dd>
		</div>
	</dl>
</div>
