<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Building2Icon,
		SearchIcon,
		MapPinIcon,
		ArrowRightIcon,
		Users2Icon
	} from '@lucide/svelte';
	import { fly, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';

	type Site = {
		id: number | string;
		name: string;
		numbers?: string | number;
	};

	interface Props {
		baseLink: string;
		sites: Site[];
		title?: string;
		description?: string;
		/** Label for the count (e.g., "Employees", "Customers") */
		unitLabel?: string;
		onSelect?: (site: Site, fullUrl: string) => void;
	}

	let {
		baseLink,
		sites,
		title = 'Select a Site',
		description = 'Choose a site to continue',
		unitLabel = 'Total',
		onSelect
	}: Props = $props();

	let searchQuery = $state('');

	const filteredSites = $derived(
		sites.filter((site) => site.name.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	const handleSiteClick = (site: Site) => {
		const normalizedBase = baseLink.endsWith('/') ? baseLink.slice(0, -1) : baseLink;
		const fullUrl = `${normalizedBase}/${site.id}`;

		if (onSelect) onSelect(site, fullUrl);
		goto(fullUrl);
	};

	const getSiteColor = (name: string): string => {
		const colors = [
			'from-blue-500/20 to-blue-600/10',
			'from-emerald-500/20 to-emerald-600/10',
			'from-violet-500/20 to-violet-600/10',
			'from-amber-500/20 to-amber-600/10',
			'from-rose-500/20 to-rose-600/10'
		];
		const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
		return colors[index];
	};

	const getIconColor = (name: string): string => {
		const colors = [
			'text-blue-500',
			'text-emerald-500',
			'text-violet-500',
			'text-amber-500',
			'text-rose-500'
		];
		const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
		return colors[index];
	};
</script>

<div class="mx-auto w-full max-w-5xl p-6" in:fly={{ y: 20, duration: 300 }}>
	<div class="mb-8 text-center">
		<div class="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10">
			<MapPinIcon class="size-8 text-primary" />
		</div>
		<h1 class="text-3xl font-bold tracking-tight">{title}</h1>
		<p class="mt-2 text-muted-foreground">{description}</p>
	</div>

	{#if sites.length > 6}
		<div class="relative mb-8">
			<SearchIcon class="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				placeholder="Search by name..."
				class="h-12 pl-10 text-base shadow-sm"
			/>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each filteredSites as site, index (site.id)}
			<button
				class="group w-full text-left"
				onclick={() => handleSiteClick(site)}
				in:scale={{ start: 0.95, duration: 300, delay: index * 40 }}
			>
				<Card
					class="h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
				>
					<CardContent class="p-0">
						<div
							class={[
								'relative flex h-24 items-center justify-center bg-gradient-to-br',
								getSiteColor(site.name)
							]}
						>
							<Building2Icon
								class={[
									'size-12 transition-transform duration-500 group-hover:scale-110',
									getIconColor(site.name)
								]}
							/>

							{#if site.numbers !== undefined}
								<div class="absolute top-3 right-3">
									<Badge variant="secondary" class="bg-background/80 font-mono backdrop-blur-sm">
										{site.numbers}
									</Badge>
								</div>
							{/if}
						</div>

						<div class="p-5">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<h3 class="truncate text-lg font-bold text-foreground group-hover:text-primary">
										{site.name}
									</h3>
									<div class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
										<Users2Icon class="size-3.5" />
										<span>{site.numbers ?? 0} {unitLabel}</span>
									</div>
								</div>
								<div
									class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
								>
									<ArrowRightIcon class="size-5 transition-transform group-hover:translate-x-0.5" />
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</button>
		{/each}
	</div>

	{#if filteredSites.length === 0}
		<div class="py-20 text-center">
			<SearchIcon class="mx-auto size-12 text-muted-foreground/30" />
			<p class="mt-4 text-lg font-medium">No results for "{searchQuery}"</p>
		</div>
	{/if}
</div>
