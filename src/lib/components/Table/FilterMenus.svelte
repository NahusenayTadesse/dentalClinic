<script lang="ts">
	import { Checkbox } from 'bits-ui';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';

	import pluralize from 'pluralize';
	import { Label } from '$lib/components/ui/label/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import Button from '../ui/button/button.svelte';
	import { RotateCcw, SlidersHorizontal, X, Check, ChevronsUpDown } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { fly } from 'svelte/transition';
	import { cn } from '$lib/utils.js';

	interface Props {
		data: any[];
		filterKeys: string[];
		filteredList: any[];
	}

	let { data, filterKeys, filteredList = $bindable(data) }: Props = $props();
	import { buttonVariants } from '../ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let selectedFilters = $state<Record<string, string[]>>({});

	let open = $state(false);

	// Initialize selectedFilters for each filterKey with empty arrays
	$effect(() => {
		filterKeys.forEach((key) => {
			if (!(key in selectedFilters)) {
				selectedFilters[key] = [];
			}
		});
	});

	// Get distinct values for each filter key
	const getDistinctValues = (key: string) => {
		return Array.from(
			new Set(data.map((item: any) => item[key]).filter((v) => v !== undefined && v !== null))
		).sort();
	};

	const getCountForValue = (filterKey: string, value: string) => {
		return data.filter((item: any) => {
			return filterKeys.every((key) => {
				if (key === filterKey) {
					return String(item[key]) === value;
				}
				const selectedValues = selectedFilters[key];
				if (selectedValues.length === 0) return true;
				return selectedValues.includes(String(item[key]));
			});
		}).length;
	};

	// Toggle value in array (add if not present, remove if present)
	const toggleFilterValue = (key: string, value: string) => {
		const current = selectedFilters[key];
		if (current.includes(value)) {
			selectedFilters[key] = current.filter((v) => v !== value);
		} else {
			selectedFilters[key] = [...current, value];
		}
	};

	// Check if a value is selected
	const isValueSelected = (key: string, value: string) => {
		return selectedFilters[key]?.includes(value) ?? false;
	};

	// Filter data based on all active filters (AND logic within each key)
	$effect(() => {
		filteredList = data.filter((item: any) => {
			return filterKeys.every((key) => {
				const selectedValues = selectedFilters[key];
				if (selectedValues.length === 0) return true;
				return selectedValues.includes(String(item[key]));
			});
		});
	});

	let isResetting = $state(false);
	const resetFilters = () => {
		isResetting = true;
		selectedFilters = {};
		filterKeys.forEach((key) => {
			selectedFilters[key] = [];
		});
		filteredList = data;
		toast.success('Filters reset');
		isResetting = false;
	};

	const activeFilterCount = $derived(
		Object.values(selectedFilters).reduce((acc, arr) => acc + arr.length, 0)
	);

	let Icon = $derived(open ? X : SlidersHorizontal);

	// Track open state for each popover
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger class={buttonVariants({ variant: 'outline' })}>
			{#snippet child(props)}
				<Button onclick={() => (open = !open)} class="w-32" {...props}>
					<Icon />Filters {activeFilterCount > 0 ? `${activeFilterCount} active` : ''}
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>Filter Table</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>

{#if open}
	<div
		class="mt-4 flex w-full items-center justify-center text-foreground"
		transition:fly={{ x: -100, duration: 300 }}
	>
		<Card class="w-full">
			<CardHeader>
				<CardTitle>Filter Table</CardTitle>
				<CardDescription>Filter table using the below parameters</CardDescription>
			</CardHeader>
			<CardContent class="">
				<div
					class="space-y-2 rounded-xl border border-border/50 bg-background bg-linear-to-br from-card to-card/50 p-6 shadow-sm"
				>
					<!-- Filter Header -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<SlidersHorizontal class="size-5 text-primary" />
							<h3 class="text-base font-semibold text-foreground">Filters</h3>
							{#if activeFilterCount > 0}
								<Badge variant="secondary" class="ml-2">{activeFilterCount} active</Badge>
							{/if}
						</div>
						<Button
							variant="outline"
							size="sm"
							class="gap-2 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
							onclick={resetFilters}
							title="Reset all filters"
						>
							<RotateCcw
								class="size-4 {isResetting ? 'animate-[spin_1s_linear_infinite_reverse' : ''}"
							/>
							<span class="hidden sm:inline">Reset {isResetting ? '...' : ''}</span>
						</Button>
					</div>

					<!-- Filter Controls -->
					<div class="flex flex-row flex-wrap gap-4">
						{#each filterKeys as filterKey (filterKey)}
							<div class="min-w-50 space-y-2">
								<Label for={filterKey} class="text-sm font-medium text-foreground capitalize">
									{pluralize(filterKey).replace(/([a-z])([A-Z])/g, '$1 $2')}
								</Label>

								<Popover.Root>
									<Popover.Trigger class="w-full">
										{#snippet child({ props })}
											<Button
												variant="outline"
												role="combobox"
												class="w-full justify-between"
												{...props}
											>
												<span class="truncate">
													{#if selectedFilters[filterKey]?.length === 0}
														<span class="text-muted-foreground capitalize">
															All {pluralize(filterKey).replace(/([a-z])([A-Z])/g, '$1 $2')}
														</span>
													{:else if selectedFilters[filterKey]?.length === 1}
														<span class="font-medium">{selectedFilters[filterKey][0]}</span>
													{:else}
														<span class="font-medium">
															{selectedFilters[filterKey].length} selected
														</span>
													{/if}
												</span>
												<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										{/snippet}
									</Popover.Trigger>
									<Popover.Content class="w-50 p-0">
										<Command.Root>
											<Command.Input placeholder={`Search ${pluralize(filterKey)}...`} />
											<Command.List>
												<Command.Empty>No {pluralize(filterKey)} found.</Command.Empty>
												<Command.Group>
													{#each getDistinctValues(filterKey) as value}
														<Command.Item
															value={String(value)}
															onSelect={() => toggleFilterValue(filterKey, String(value))}
															class="flex cursor-pointer items-center gap-2"
														>
															<Checkbox.Root
																checked={isValueSelected(filterKey, String(value))}
																class="flex size-4 items-center justify-center rounded-sm border border-primary/50"
															>
																{#snippet children({ checked })}
																	{#if checked}
																		<Check class="size-3.5 text-primary" />
																	{/if}
																{/snippet}
															</Checkbox.Root>
															<span class="flex-1 capitalize">{value}</span>
															<span class="text-xs text-muted-foreground">
																({getCountForValue(filterKey, String(value))})
															</span>
														</Command.Item>
													{/each}
												</Command.Group>
											</Command.List>
										</Command.Root>
									</Popover.Content>
								</Popover.Root>

								<!-- Selected badges -->
								{#if selectedFilters[filterKey]?.length > 0}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each selectedFilters[filterKey] as selectedValue}
											<Badge variant="secondary" class="gap-1 pr-1">
												{selectedValue}
												<button
													class="ml-1 hover:text-destructive"
													onclick={() => toggleFilterValue(filterKey, selectedValue)}
												>
													<X class="size-3" />
												</button>
											</Badge>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Results Info -->
				<div class="mt-4 flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
					<p class="text-sm text-muted-foreground">
						Showing <span class="font-semibold text-foreground">{filteredList.length}</span> results
					</p>
					{#if activeFilterCount > 0}
						<p class="text-xs text-muted-foreground">
							Active filters: {activeFilterCount}
						</p>
					{/if}
				</div>
			</CardContent>
			<CardFooter></CardFooter>
		</Card>
	</div>
{/if}
