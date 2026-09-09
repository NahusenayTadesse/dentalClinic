<script lang="ts">
	import { formatETB } from '$lib/global.svelte';
	import {
		DollarSignIcon,
		Minus as MinusCircleIcon,
		CircleAlert as AlertTriangleIcon,
		WalletIcon,
		ClockIcon
	} from '@lucide/svelte';

	type Totals = {
		gross: number;
		tax: number;
		penEm: number;
		penOrg: number;
		netPay: number;
	};

	let { totals }: { totals: Totals } = $props();

	/** Format currency */
</script>

<h4>Totals</h4>
<div
	class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4 lg:max-w-305!"
>
	<!-- Gross Pay -->
	<div class="flex items-center gap-2 pr-4">
		<div class="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
			<DollarSignIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Gross</p>
			<p class="font-semibold text-emerald-600 dark:text-emerald-400">
				{formatETB(totals.gross, true)}
			</p>
		</div>
	</div>

	<!-- Tax -->
	<div class="flex items-center gap-2 pr-4">
		<div class="flex size-8 items-center justify-center rounded-full bg-orange-500/20">
			<MinusCircleIcon class="size-4 text-orange-600 dark:text-orange-400" />
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Total Salary Tax</p>
			<p class="font-semibold text-orange-600 dark:text-orange-400">
				-{formatETB(totals.tax, true)}
			</p>
		</div>
	</div>

	<!-- Penalty -->
	<div class="flex items-center gap-2 pr-4">
		<div class="flex size-8 items-center justify-center rounded-full bg-red-500/20">
			<AlertTriangleIcon class="size-4 text-red-600 dark:text-red-400" />
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Pen(Em)</p>
			<p class="font-semibold text-red-600 dark:text-red-400">-{formatETB(totals.penEm, true)}</p>
		</div>
	</div>

	<div class="flex items-center gap-2 pr-4">
		<div class="flex size-8 items-center justify-center rounded-full bg-red-500/20">
			<AlertTriangleIcon class="size-4 text-red-600 dark:text-red-400" />
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Pen(Org)</p>
			<p class="font-semibold text-red-600 dark:text-red-400">-{formatETB(totals.penOrg, true)}</p>
		</div>
	</div>

	<!-- Net Pay -->
	<div class="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
		<div class="flex size-8 items-center justify-center rounded-full bg-primary/20">
			<WalletIcon class="size-4 text-primary" />
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Net Pay</p>
			<p class="font-bold text-primary">{formatETB(totals.netPay, true)}</p>
		</div>
	</div>
</div>
