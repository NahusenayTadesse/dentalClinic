<script lang="ts">
	import { CalendarXIcon, AlertTriangleIcon, CheckCircleIcon } from '@lucide/svelte';

	interface Props {
		total: number;
		deductable: number;
		nonDeductable: number;
	}

	let { total, deductable, nonDeductable }: Props = $props();
</script>

<div class="grid grid-cols-3 gap-3">
	<div class="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-3 text-center">
		<CalendarXIcon class="mb-1 size-5 text-muted-foreground" />
		<span class="text-2xl font-bold">{total}</span>
		<span class="text-xs text-muted-foreground">Total Absences</span>
	</div>
	<div
		class="flex flex-col items-center justify-center rounded-lg bg-destructive/10 p-3 text-center"
	>
		<AlertTriangleIcon class="mb-1 size-5 text-destructive" />
		<span class="text-2xl font-bold text-destructive">{deductable}</span>
		<span class="text-xs text-muted-foreground">Deductable</span>
	</div>
	<div
		class="flex flex-col items-center justify-center rounded-lg bg-emerald-500/10 p-3 text-center"
	>
		<CheckCircleIcon class="mb-1 size-5 text-emerald-600 dark:text-emerald-400" />
		<span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{nonDeductable}</span>
		<span class="text-xs text-muted-foreground">Non-Deductable</span>
	</div>
</div>
