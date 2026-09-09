<script lang="ts">
	import { Card, CardContent } from "$lib/components/ui/card";
	import { CalendarIcon } from "@lucide/svelte";

	interface Props {
		count: number;
	}

	const { count }: Props = $props();
</script>

<div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
	<Card class="relative overflow-hidden border-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/50 shadow-lg-lg shadow-lg-primary/20">
		<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.7),transparent_50%)]"></div>
		<CardContent class="relative pt-6">
			<div class="flex items-start justify-between">
				<div class="flex flex-col gap-2">
					<h4 class="text-primary-foreground">Today's Appointments</h4>
					<h5 class="text-4xl font-bold text-primary-foreground">{count}</h5>
					<p class="text-xs text-primary-foreground/60">Scheduled for today</p>
				</div>
				<div class="rounded-lg bg-primary-foreground/10 p-3 backdrop-blur-sm">
					<CalendarIcon class="size-6 text-primary-foreground" />
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
