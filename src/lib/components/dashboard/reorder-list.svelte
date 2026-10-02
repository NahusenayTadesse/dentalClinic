<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { AlertCircleIcon } from '@lucide/svelte';
	import type { IconProps } from '@lucide/svelte';
	import type { Component } from 'svelte';

	/**
	 * A dashboard card listing stock that needs someone's attention. Built for items below their
	 * reorder line; the expiring-lots card is the second user, so a row may say its own detail and
	 * badge, and link to where it is dealt with. Left out, both read as the reorder list always has.
	 */
	interface Item {
		name: string;
		quantity: number;
		/** The line under the name. Defaults to the quantity. */
		detail?: string;
		/** Defaults to "Low Stock". */
		badge?: string;
		href?: string;
	}

	interface Props {
		title: string;
		description: string;
		items: Item[];
		icon: Component<IconProps>;
		emptyText?: string;
	}

	const {
		title,
		description,
		items,
		icon: Icon,
		emptyText = 'No items need reordering'
	}: Props = $props();
	const isEmpty = $derived(items.length === 0);
</script>

<div class="animate-in duration-500 fade-in slide-in-from-bottom-4" style="animation-delay: 100ms;">
	<Card class="shadow-lg-lg hover:shadow-lg-xl transition-shadow-lg border-0 duration-300">
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
					<div class="mb-3 rounded-full bg-muted p-3">
						<AlertCircleIcon class="size-5 text-muted-foreground" />
					</div>
					<p class="text-sm text-muted-foreground">{emptyText}</p>
				</div>
			{:else}
				<div class="flex max-h-64 flex-col gap-2 overflow-y-auto">
					{#each items as item, index (index)}
						<svelte:element
							this={item.href ? 'a' : 'div'}
							href={item.href}
							class="group flex items-center justify-between rounded-lg bg-muted/50 p-3 transition-colors duration-200 hover:bg-muted"
							style="animation-delay: {(index + 1) * 50}ms;"
						>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-foreground">{item.name}</p>
								<p class="text-xs text-muted-foreground">
									{item.detail ?? `Qty: ${item.quantity}`}
								</p>
							</div>
							<Badge
								variant="outline"
								class="ml-2 shrink-0 border-destructive/20 bg-destructive/10 text-destructive"
								>{item.badge ?? 'Low Stock'}</Badge
							>
						</svelte:element>
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
