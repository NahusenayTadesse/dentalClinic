<script lang="ts" generics="T extends Record<string, unknown> = Record<string, unknown>">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle
	} from '@nahu/admin-kit/components/ui/card/index.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Separator } from '@nahu/admin-kit/components/ui/separator/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';
	import DateMonth from './date-month.svelte';

	import {
		XIcon,
		Funnel,
		Calendar1,
		Search,
		List,
		SlidersHorizontal,
		Loader2
	} from '@lucide/svelte';

	import { getLocalTimeZone, today, parseDate, type CalendarDate } from '@internationalized/date';

	import { slide } from 'svelte/transition';

	import type { Snippet } from 'svelte';
	import type { QueryFilterPayload } from '$lib/queryFilters';

	interface Props {
		title?: string;
		description?: string;

		showDate?: boolean;
		showSearch?: boolean;
		showPageSize?: boolean;

		/**
		 * Collapse to a single button until it is asked for, so a filter set the
		 * user is not currently editing costs one row instead of a whole card.
		 *
		 * Pass `false` on a page that drives its own show/hide — the reports
		 * layout puts that button up in its title row.
		 */
		collapsible?: boolean;

		/** Start expanded. The panel stays open across filter changes either way. */
		defaultOpen?: boolean;

		/**
		 * What the URL currently says — these fill the controls in.
		 *
		 * They are *not* the baseline for "is anything filtered": see the
		 * `default*` props below for that.
		 */
		initialSearch?: string;
		initialPageSize?: number;
		initialStart?: string;
		initialEnd?: string;
		initialCustomFilters?: T;

		/**
		 * The unfiltered state — what the page shows when nothing is asked for.
		 * A filter counts as active when it differs from this, and `Clear all`
		 * returns here. Custom filters and the search box are always empty when
		 * unfiltered, so only the page size and date range need declaring.
		 */
		defaultPageSize?: number;
		defaultStart?: string;
		defaultEnd?: string;

		pageSizes?: number[];

		/**
		 * manual = emit only when search form is submitted, page size/date/custom filter changes, or clear all
		 * change = emit whenever search input changes too (debounced)
		 */
		submitMode?: 'manual' | 'change';

		/** Debounce delay (ms) for search input in `change` mode. */
		debounceMs?: number;

		searchPlaceholder?: string;

		/** Whether the query is currently active/fetching. */
		isLoading?: boolean;

		/** The total number of results returned by the query. */
		totalResults?: number;

		/** Text to display when the query is active. */
		loadingText?: string;

		onQueryChange?: (payload: QueryFilterPayload<T>) => void;

		/**
		 * Inject your module-specific filters here.
		 *
		 * Example:
		 * {#snippet children(filters, update)}
		 *   <Select value={filters.status as string} onValueChange={(v) => update('status', v)}>
		 *     ...
		 *   </Select>
		 * {/snippet}
		 */
		children?: Snippet<[T, <K extends keyof T>(key: K, value: T[K]) => void]>;
	}

	let {
		title = 'Query Builder',
		description = 'Filter, search, and manage dataset limits',

		showDate = false,
		showSearch = true,
		showPageSize = true,

		collapsible = true,
		defaultOpen = false,

		initialSearch = '',
		initialPageSize = 20,
		initialStart,
		initialEnd,
		initialCustomFilters = {} as T,

		defaultPageSize = 20,
		defaultStart,
		defaultEnd,

		pageSizes = [10, 20, 50, 100],

		submitMode = 'manual',
		debounceMs = 350,
		searchPlaceholder = 'Search rows...',

		isLoading = false,
		totalResults,
		loadingText = 'Searching...',

		onQueryChange,
		children
	}: Props = $props();

	/**
	 * Timezone-safe date parsing. `new Date('2024-01-15')` parses as UTC
	 * midnight, which shifts a day back in timezones behind UTC. Parse the
	 * ISO date portion directly instead, falling back to Date for other formats.
	 */
	function parseCalendarDate(value?: string): CalendarDate | null {
		if (!value) return null;

		const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
		if (isoMatch) {
			try {
				return parseDate(isoMatch[0]);
			} catch {
				return null;
			}
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;

		return parseDate(
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
				date.getDate()
			).padStart(2, '0')}`
		);
	}

	function toRange(
		start?: string,
		end?: string
	): { start: CalendarDate; end: CalendarDate } | null {
		if (!start || !end) return null;

		return {
			start: parseCalendarDate(start) ?? today(getLocalTimeZone()),
			end: parseCalendarDate(end) ?? today(getLocalTimeZone())
		};
	}

	/**
	 * The unfiltered state — what "no filters" looks like on this page.
	 *
	 * Kept separate from the `initial*` props on purpose. Those carry what the
	 * URL currently says, because that is what the controls have to show. Using
	 * them as the baseline as well made a filter arriving in the URL read as
	 * "unchanged": open a shared filtered link and the bar claimed nothing was
	 * active, and `Clear all` reset the filters to themselves.
	 */
	const defaultDates = $derived(toRange(defaultStart, defaultEnd));

	/** Same keys as the page's filters, every one of them empty. */
	function emptyFilters(): T {
		const empty: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(initialCustomFilters)) {
			empty[key] = Array.isArray(value) ? [] : '';
		}

		return empty as T;
	}

	let search = $state(initialSearch);
	let pageSize = $state(initialPageSize);
	let customFilters = $state<T>(structuredClone(initialCustomFilters));
	let dateRange = $state<{ start: CalendarDate; end: CalendarDate } | null>(
		toRange(initialStart, initialEnd)
	);

	/**
	 * Survives a filter change: applying a filter navigates, but SvelteKit keeps
	 * this component instance for the same route, so the panel does not slam
	 * shut every time the user picks something.
	 */
	let open = $state(defaultOpen);

	/**
	 * The controls are local state, so nothing pulls them back in line when the
	 * URL moves on its own — the browser Back button, a pagination link, a
	 * bookmark opened into a live instance. Without this the table would show
	 * one query and the bar another.
	 *
	 * Tracked as a plain string rather than `$state` so writing the controls
	 * below cannot re-trigger the effect that writes them.
	 */
	let syncedFrom = JSON.stringify([
		initialSearch,
		initialPageSize,
		initialStart,
		initialEnd,
		initialCustomFilters
	]);

	$effect(() => {
		const incoming = JSON.stringify([
			initialSearch,
			initialPageSize,
			initialStart,
			initialEnd,
			initialCustomFilters
		]);

		if (incoming === syncedFrom) return;
		syncedFrom = incoming;

		search = initialSearch;
		pageSize = initialPageSize;
		customFilters = structuredClone(initialCustomFilters);
		dateRange = toRange(initialStart, initialEnd);
	});

	const hasCustomFilters = $derived(Object.keys(customFilters).length > 0);

	/**
	 * A range narrows the data unless it is the one the page falls back to when
	 * nothing is asked for — reports always have a window, so counting theirs
	 * would mean permanently claiming one active filter.
	 */
	const dateActive = $derived(
		dateRange !== null &&
			(defaultDates === null ||
				dateRange.start.compare(defaultDates.start) !== 0 ||
				dateRange.end.compare(defaultDates.end) !== 0)
	);

	function isEmptyFilterValue(value: unknown): boolean {
		if (value === null || value === undefined || value === '') return true;
		if (Array.isArray(value) && value.length === 0) return true;
		return false;
	}

	const activeFilterCount = $derived(
		[
			showSearch && search.trim() !== '',
			showPageSize && pageSize !== defaultPageSize,
			showDate && dateActive,
			...Object.values(customFilters).map((value) => !isEmptyFilterValue(value))
		].filter(Boolean).length
	);

	function getPayload(): QueryFilterPayload<T> {
		return {
			search: search.trim(),
			pageSize,
			dateRange: showDate ? dateRange : null,
			customFilters: $state.snapshot(customFilters) as T
		};
	}

	function emitChange() {
		clearTimeout(debounceTimer);
		onQueryChange?.(getPayload());
	}

	// --- Debounced search (change mode only) ---
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => () => clearTimeout(debounceTimer));

	function handleSearchInput() {
		if (submitMode !== 'change') return;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(emitChange, debounceMs);
	}

	function handleSearchSubmit(event?: Event) {
		event?.preventDefault();
		emitChange();
	}

	function handlePageSizeChange(value: string) {
		const nextPageSize = Number(value);
		if (Number.isNaN(nextPageSize)) return;

		pageSize = nextPageSize;
		emitChange();
	}

	function handleDateChange(dates: { start: CalendarDate; end: CalendarDate }) {
		dateRange = dates;
		emitChange();
	}

	function updateCustomFilter<K extends keyof T>(key: K, value: T[K]) {
		customFilters[key] = value;
		emitChange();
	}

	/** Back to the unfiltered state, not back to whatever the URL arrived with. */
	function clearAllFilters() {
		search = '';
		pageSize = defaultPageSize;
		customFilters = emptyFilters();
		dateRange = defaultDates ? { ...defaultDates } : null;

		emitChange();
	}
</script>

{#snippet statusBadges()}
	{#if isLoading}
		<Badge variant="outline" class="gap-1.5 border-primary/50 bg-primary/10 text-primary">
			<Loader2 class="size-3.5 animate-spin" />
			{loadingText}
		</Badge>
	{/if}

	{#if typeof totalResults === 'number'}
		<Badge variant="secondary" class="font-medium">
			{totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}
		</Badge>
	{/if}
{/snippet}

<!--
	Collapsed, the whole bar is one button. The result count and the active
	filter count stay on show even then: how many rows a query returned is the
	answer the page exists to give, and hiding it behind the toggle would make
	the collapsed state cost information rather than just space.
-->
{#if collapsible && !open}
	<div class="mx-2 my-6 flex flex-wrap items-center gap-2">
		<Button
			type="button"
			variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
			size="sm"
			aria-expanded={false}
			onclick={() => (open = true)}
		>
			<Funnel class="size-4" />
			{title}
			{#if activeFilterCount > 0}
				<Badge variant="secondary" class="ml-1">{activeFilterCount}</Badge>
			{/if}
		</Button>

		{@render statusBadges()}

		{#if activeFilterCount > 0}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-8 px-2 text-muted-foreground hover:text-foreground"
				onclick={clearAllFilters}
			>
				<XIcon class="mr-1 size-3" />
				Clear all
			</Button>
		{/if}
	</div>
{:else}
	<!--
		Margins live on the card itself so every page that drops the bar in gets the
		same breathing room without repeating spacing classes. `w-full` is left off
		on purpose: the card is a block-level flex container and already fills its
		parent, and pinning it to 100% would make the horizontal margins overflow.

		The transition sits on a wrapping div because `transition:` is an element
		directive and `Card` is a component.
	-->
	<div class="mx-2 my-6" transition:slide={{ duration: 200 }}>
		<Card class="border-border/50 shadow-lg">
			<CardHeader class="pb-4">
				<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div class="flex items-center gap-3">
						<div class="flex size-9 items-center justify-center rounded-lg bg-primary/10">
							<Funnel class="size-4 text-primary" />
						</div>

						<div>
							<CardTitle class="text-lg">{title}</CardTitle>
							<p class="text-sm text-muted-foreground">{description}</p>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2 self-end sm:self-auto">
						{@render statusBadges()}

						{#if activeFilterCount > 0}
							<Badge variant="secondary" class="font-medium">
								{activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
							</Badge>

							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-8 px-2 text-muted-foreground hover:text-foreground"
								onclick={clearAllFilters}
							>
								<XIcon class="mr-1 size-3" />
								Clear all
							</Button>
						{/if}

						{#if collapsible}
							<Button
								type="button"
								variant="outline"
								size="sm"
								aria-expanded={true}
								onclick={() => (open = false)}
							>
								<XIcon class="size-3.5" />
								Hide
							</Button>
						{/if}
					</div>
				</div>
			</CardHeader>

			<Separator />

			<CardContent class="pt-6">
				<div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{#if showSearch}
						<div class="flex flex-col gap-2">
							<Label
								for="query-search"
								class="flex items-center gap-2 text-sm font-medium text-foreground"
							>
								<Search class="size-3.5 text-muted-foreground" />
								Search
							</Label>

							<form onsubmit={handleSearchSubmit}>
								<Input
									id="query-search"
									type="search"
									placeholder={searchPlaceholder}
									bind:value={search}
									oninput={handleSearchInput}
									class="w-full"
								/>
							</form>
						</div>
					{/if}

					{#if showPageSize}
						<div class="flex flex-col gap-2">
							<Label
								for="query-page-size"
								class="flex items-center gap-2 text-sm font-medium text-foreground"
							>
								<List class="size-3.5 text-muted-foreground" />
								Page Size
							</Label>

							<Select type="single" value={String(pageSize)} onValueChange={handlePageSizeChange}>
								<SelectTrigger id="query-page-size" class="w-full">
									{pageSize} per page
								</SelectTrigger>

								<SelectContent>
									{#each pageSizes as count (count)}
										<SelectItem value={String(count)}>
											{count} per page
										</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</div>
					{/if}

					{#if showDate}
						<div class="flex flex-col gap-2 sm:col-span-2 lg:col-span-2">
							<Label class="flex items-center gap-2 text-sm font-medium text-foreground">
								<Calendar1 class="size-3.5 text-muted-foreground" />
								Date Range
							</Label>

							<DateMonth
								start={dateRange?.start}
								end={dateRange?.end}
								link=""
								onDateChange={handleDateChange}
							/>
						</div>
					{/if}

					{#if children}
						{@render children(customFilters, updateCustomFilter)}
					{:else if hasCustomFilters}
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<SlidersHorizontal class="size-3.5" />
							Custom filters configured, but no filter UI provided.
						</div>
					{/if}
				</div>
			</CardContent>
		</Card>
	</div>
{/if}
