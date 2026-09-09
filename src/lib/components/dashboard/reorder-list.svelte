<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Badge } from "$lib/components/ui/badge";
	import { AlertCircleIcon } from "@lucide/svelte";

	interface Item {
		name: string;
		quantity: number;
	}

	interface Props {
		title: string;
		description: string;
		items: Item[];
		icon: any;
	}

	const { title, description, items, icon: Icon }: Props = $props();
	const isEmpty = $derived(items.length === 0);
</script>

<div class="animate-in fade-in slide-in-from-bottom-4 duration-500" style="animation-delay: 100ms;">
	<Card class="border-0 shadow-lg-lg hover:shadow-lg-xl transition-shadow-lg duration-300">
		<CardHeader class="pb-3">
			<div class="flex items-start justify-between">
				<div class="space-y-1">
					<CardTitle class="text-lg">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</div>
				<div class="rounded-lg bg-accent/10 p-2">
					<Icon class="size-5 text-black dark:text-white" />
				</div>
			</div>
		</CardHeader>
		<CardContent>
			{#if isEmpty}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<div class="rounded-full bg-muted p-3 mb-3">
						<AlertCircleIcon class="size-5 text-muted-foreground" />
					</div>
					<p class="text-sm text-muted-foreground">No items need reordering</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
					{#each items as item, index (index)}
						<div class="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors duration-200 group" style="animation-delay: {(index + 1) * 50}ms;">
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium truncate text-foreground">{item.name}</p>
								<p class="text-xs text-muted-foreground">Qty: {item.quantity}</p>
							</div>
							<Badge variant="outline" class="ml-2 shrink-0 bg-destructive/10 text-destructive border-destructive/20">Low Stock</Badge>
						</div>
					{/each}
				</div>
			{/if}
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

	:global(.space-y-2 > div) {
		animation: itemSlideIn 0.4s ease-out forwards;
		opacity: 0;
	}

	@keyframes itemSlideIn {
		from {
			opacity: 0;
			transform: translateX(-8px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
