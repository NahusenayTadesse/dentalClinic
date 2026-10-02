<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '@nahu/admin-kit/components/ui/card/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';
	import type { NavItem } from '$lib/navigation';

	/**
	 * One section of the admin panel's index: a title, a line saying what is in it, and a link per
	 * screen. The sections and their screens come from `settingsSections` in `$lib/navigation.ts`.
	 */
	interface Props {
		title: string;
		description: string;
		icon: Component<IconProps>;
		items: NavItem[];
	}

	const { title, description, icon: IconComponent, items }: Props = $props();
</script>

<Card
	class="group hover:shadow-lg-xl hover:shadow-lg-primary/10 relative overflow-hidden border-border/50 transition-all duration-300"
>
	<!-- Content -->
	<div class="relative">
		<CardHeader class="pb-4">
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<CardTitle class="mb-2 text-xl">{title}</CardTitle>
					<CardDescription class="text-sm">{description}</CardDescription>
				</div>
				<div
					class="ml-4 rounded-lg bg-primary/10 p-3 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
				>
					<IconComponent class="size-6" />
				</div>
			</div>
		</CardHeader>

		<CardContent class="flex flex-col gap-2">
			{#each items as item (item.url)}
				<a
					href={item.url}
					class="group/link flex items-center justify-between rounded-lg px-4 py-3 transition-all duration-200 hover:bg-primary/10"
				>
					<span class="font-medium text-foreground/80 group-hover/link:text-foreground"
						>{item.title}</span
					>
					<ArrowRightIcon
						class="size-4 text-muted-foreground opacity-0 transition-all duration-200
					 group-hover/link:translate-x-1 group-hover/link:opacity-100"
					/>
				</a>
			{/each}
		</CardContent>
	</div>

	<!-- Border Gradient on Hover -->
	<div
		class="pointer-events-none absolute inset-0 rounded-lg border border-primary/0 transition-colors duration-300 group-hover:border-primary/20"
	></div>
</Card>
