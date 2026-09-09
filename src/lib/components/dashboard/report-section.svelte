<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { FileTextIcon } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<div class="animate-in fade-in slide-in-from-bottom-4 duration-500" style="animation-delay: 200ms;">
	<Card class="border-0 shadow-lg-lg">
		<CardHeader class="pb-3">
			<div class="flex items-center justify-between">
				<div class="space-y-1">
					<CardTitle class="text-lg">Today's Report</CardTitle>
					<CardDescription>Daily performance metrics and data</CardDescription>
				</div>
				<div class="rounded-lg bg-secondary/10 p-2">
					<FileTextIcon class="size-5 text-black dark:text-white" />
				</div>
			</div>
		</CardHeader>
		<CardContent>
			{@render children()}
		</CardContent>
	</Card>
</div>

<style>
	:global(.animate-in) {
		animation: slideIn 0.5s ease-out forwards;
		opacity: 0;
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
