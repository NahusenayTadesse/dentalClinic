<script lang="ts">
	import { Card, CardContent } from '@nahu/admin-kit/components/ui/card/index.js';
	import { CalendarIcon } from '@lucide/svelte';

	interface Props {
		count: number;
	}

	const { count }: Props = $props();
</script>

<div class="animate-in duration-500 fade-in slide-in-from-bottom-4">
	<Card class="relative overflow-hidden border bg-card">
		<CardContent class="relative pt-6">
			<div class="flex items-start justify-between">
				<div class="flex flex-col gap-2">
					<h4>Today's Appointments</h4>
					<h5 class="text-4xl font-bold">{count}</h5>
					<p class="text-xs text-muted-foreground">Scheduled for today</p>
				</div>
				<div class="rounded-lg bg-muted p-3">
					<CalendarIcon class="size-6 text-primary" />
				</div>
			</div>
		</CardContent>
	</Card>
</div>

<style>
	:global(.animate-in) {
		animation: slideIn 0.5s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
