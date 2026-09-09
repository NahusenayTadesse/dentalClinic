<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRightIcon, MapPinIcon, Building2Icon, UsersIcon, Banknote } from '@lucide/svelte';

	interface NavItem {
		name: string;
		href: string;
	}

	interface Props {
		title: string;
		description: string;
		icon: 'MapPin' | 'Building2' | 'Users' | 'BankNote';
		items: NavItem[];
		accentColor: string;
	}

	const { title, description, icon, items, accentColor }: Props = $props();

	const iconMap = {
		MapPin: MapPinIcon,
		Building2: Building2Icon,
		Users: UsersIcon,
		BankNote: Banknote
	};

	const IconComponent = iconMap[icon];
</script>

<Card
	class="group hover:shadow-lg-xl hover:shadow-lg-primary/10 relative overflow-hidden border-border/50 transition-all duration-300"
>
	<!-- Gradient Background -->
	<div
		class={`absolute inset-0 bg-linear-to-br ${accentColor} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
	></div>

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
			{#each items as item (item.href)}
				<a
					href={item.href}
					class="group/link flex items-center justify-between rounded-lg px-4 py-3 transition-all duration-200 hover:bg-primary/10"
				>
					<span class="font-medium text-foreground/80 group-hover/link:text-foreground"
						>{item.name}</span
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
