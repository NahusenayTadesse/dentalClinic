<script lang="ts" generics="TData, TValue">
	import {
		type ColumnDef,
		type ColumnFiltersState,
		type PaginationState,
		type RowSelectionState,
		type SortingState,
		type VisibilityState,
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel
	} from '@tanstack/table-core';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import Frown from '@lucide/svelte/icons/frown';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import ResizableHandle from '../ui/resizable/resizable-handle.svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { isMobile } from '$lib/global.svelte';

	import Pdf from './pdf.svelte';
	import TableFacet from './table-facet.svelte';
	import TableCharts from './table-charts.svelte';
	import TablePagination from './table-pagination.svelte';
	import {
		applyFacets,
		facetsFromRows,
		gotoPage,
		selectionCount,
		setServerFacet,
		setServerPageSize,
		setServerSearch,
		toFacetList,
		type Facet,
		type ServerTable
	} from './table-state.svelte';

	/**
	 * The table: rows, per-column filters, a chart pane, and paging — in one component, in either
	 * of two modes.
	 *
	 * It replaces an arrangement of three: this table, a separate client-side facet menu, and a
	 * separate server-side filter bar. Four pages ran two of them at once, and on those pages the
	 * facet counts and the chart were computed from whichever rows the server had already
	 * paginated down to — so `/dashboard/employees` drew a chart of twenty-five people and
	 * presented it as the clinic. Two components cannot be kept honest about a number neither of
	 * them owns; one can.
	 *
	 * **Client mode** (no `server` prop) is the default and what every existing caller gets.
	 * TanStack filters, sorts and pages in memory and facets are counted off the rows.
	 *
	 * **Server mode** (`server` given) hands all of that to SQL. TanStack is told not to redo it,
	 * page moves become URL changes that `parseTableQuery` reads, and the facet tallies arrive
	 * from `facetCounts` describing the whole result set rather than the page.
	 *
	 * **Behaviour change worth knowing:** the default page size used to be `data.length`, so every
	 * table rendered every row into the DOM and the pager never appeared. It is now
	 * `defaultPageSize`. That was the point — a patient list cannot put four thousand rows on one
	 * page — but it is visible on every list in the app.
	 *
	 * Non-goal: exporting more than you can see. In server mode the PDF and CSV export the current
	 * page, because that is the only data the browser has. A whole-result export is a server
	 * endpoint, not a button on the client.
	 */
	type Props = {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
		search?: boolean;
		class?: string;
		fileName?: string;
		selected?: TData[];
		/** Rows per page in client mode, and the initial size offered in server mode. */
		defaultPageSize?: number;
		pageSizes?: number[];
		/**
		 * Row properties (client mode) or URL params (server mode) offered as column filters.
		 * Empty means no facets and no charts, which is what every existing caller gets.
		 */
		facetKeys?: string[];
		/** Human wording per facet key, when the de-camel-cased key is not good enough. */
		facetLabels?: Record<string, string>;
		/**
		 * Column id → URL param, for server mode only.
		 *
		 * Facets are keyed by column id everywhere else, because that is what puts a filter in the
		 * right header. The param that carries it is often spelled differently — the `department`
		 * column is filtered by `departmentId` — and only the code writing the URL needs to know.
		 * Defaults to the column id.
		 */
		facetParams?: Record<string, string>;
		/** Show the chart pane beside the table. Requires `facetKeys`. */
		charts?: boolean;
		/** Present when the load already filtered and paged. See `ServerTable`. */
		server?: ServerTable;
	};

	let {
		data,
		columns,
		search = true,
		class: className = '',
		fileName = 'File',
		selected = $bindable(),
		defaultPageSize = 20,
		pageSizes = [10, 20, 50, 100],
		facetKeys = [],
		facetLabels = {},
		facetParams = {},
		charts = false,
		server
	}: Props = $props();

	const isServer = $derived(Boolean(server));

	/* ── Facet selection ──────────────────────────────────────────────────────
	 * Client mode keeps it here and filters in memory. Server mode reads it back off the URL,
	 * because there the selection is a query param and the rows have already been narrowed.
	 */
	let clientFacets = $state<Record<string, string[]>>({});

	const selectedFacets = $derived.by<Record<string, string[]>>(() => {
		if (!server) return clientFacets;

		const out: Record<string, string[]> = {};
		for (const key of facetKeys) {
			const value = server.filters?.[key];
			out[key] = value ? [String(value)] : [];
		}
		return out;
	});

	/*
	 * Facet helpers read rows by key, which needs an index signature; `TData` deliberately has no
	 * constraint, because `ColumnDef` is invariant in it and constraining it here rejects every
	 * caller that types its own rows. The cast is confined to these two lines (CLAUDE.md §3).
	 */
	const indexable = $derived(data as readonly Record<string, unknown>[]);

	/* Client mode narrows the rows itself; server mode was handed rows already narrowed. */
	const rows = $derived(
		isServer ? data : (applyFacets([...indexable], clientFacets) as unknown as TData[])
	);

	const facets = $derived.by<Record<string, Facet[]>>(() => {
		if (!facetKeys.length) return {};

		// Server mode never counts its own rows — they are one page, and a tally of one page
		// presented as a tally of the result set is the bug this component was built to end.
		const tallies = server
			? (server.facets ?? {})
			: facetsFromRows([...indexable], facetKeys, clientFacets);

		const out: Record<string, Facet[]> = {};
		for (const key of facetKeys) out[key] = toFacetList(tallies[key]);
		return out;
	});

	function toggleFacet(key: string, value: string) {
		if (isServer) {
			// One string per key is all `parseTableQuery` reads, so this is a replace, not an add.
			const already = selectedFacets[key]?.includes(value);
			setServerFacet(facetParams[key] ?? key, already ? null : value);
			return;
		}

		const current = clientFacets[key] ?? [];
		clientFacets = {
			...clientFacets,
			[key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
		};
	}

	function clearFacet(key: string) {
		if (isServer) setServerFacet(facetParams[key] ?? key, null);
		else clientFacets = { ...clientFacets, [key]: [] };
	}

	function clearAllFacets() {
		if (isServer) for (const key of facetKeys) setServerFacet(facetParams[key] ?? key, null);
		else clientFacets = {};
	}

	const activeFacetCount = $derived(selectionCount(selectedFacets));

	/* ── TanStack state ─────────────────────────────────────────────────────── */
	/*
	 * Split rather than one `$state` object, because `{ pageSize: defaultPageSize }` in an
	 * initialiser captures the prop's first value and never sees another — the same shape of bug
	 * as the `pageSize: data.length` this replaces. `null` means "the reader has not chosen", so
	 * the prop stays live until they do and is then left alone.
	 */
	let pageIndex = $state(0);
	let chosenPageSize = $state<number | null>(null);

	const pagination = $derived<PaginationState>({
		pageIndex,
		pageSize: chosenPageSize ?? defaultPageSize
	});
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>({});
	let rowSelection = $state<RowSelectionState>({});
	/*
	 * In client mode this is TanStack's global filter over rows in memory. In server mode it is
	 * the `search` param, because filtering the twenty rows the server returned would search one
	 * page and look like it had searched the list — the same shape of lie the facet counts used
	 * to tell.
	 */
	// Both halves are strings: a search box cannot produce anything else, and typing this as
	// TanStack's wider `GlobalFilterColumn` made the shared binding below a union it could not set.
	let globalFilter = $state<string>('');
	let serverSearch = $state<string>('');

	$effect(() => {
		if (server) serverSearch = String(server.filters?.search ?? '');
	});

	function onSearchInput(value: string) {
		if (server) setServerSearch(value);
		else table.setGlobalFilter(value);
	}

	/*
	 * Server mode holds the page index at zero: the server already returned the right page, so
	 * letting TanStack slice it again would show the first N rows of page three.
	 */
	const tanstackPagination = $derived<PaginationState>(
		server ? { pageIndex: 0, pageSize: Math.max(1, server.pagination.pageSize) } : pagination
	);

	const table = createSvelteTable({
		get data() {
			return rows;
		},
		get columns() {
			return columns;
		},
		state: {
			get pagination() {
				return tanstackPagination;
			},
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get globalFilter() {
				return globalFilter;
			},
			get rowSelection() {
				return rowSelection;
			}
		},
		// Told once, so nothing downstream re-filters, re-sorts or re-slices what SQL already did.
		get manualPagination() {
			return Boolean(server);
		},
		get manualFiltering() {
			return Boolean(server);
		},
		get manualSorting() {
			return Boolean(server);
		},
		get rowCount() {
			return server?.pagination.total;
		},
		onPaginationChange: (updater) => {
			const next = typeof updater === 'function' ? updater(pagination) : updater;
			pageIndex = next.pageIndex;
			chosenPageSize = next.pageSize;
		},
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		},
		onColumnVisibilityChange: (updater) => {
			columnVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	if (selected) {
		$effect(() => {
			selected = table.getSelectedRowModel().rows.map((row) => row.original);
		});
	}

	/* ── What the pager shows, in whichever mode ─────────────────────────────── */
	const pagerPage = $derived(server ? server.pagination.page : pagination.pageIndex + 1);
	const pagerSize = $derived(server ? server.pagination.pageSize : pagination.pageSize);
	const pagerTotal = $derived(
		server ? server.pagination.total : table.getFilteredRowModel().rows.length
	);

	function goToPage(next: number) {
		if (server) gotoPage(next);
		else table.setPageIndex(next - 1);
	}

	function changePageSize(size: number) {
		if (server) setServerPageSize(size);
		else table.setPageSize(size);
	}

	const showCharts = $derived(charts && facetKeys.length > 0 && !isMobile());
</script>

<Resizable.PaneGroup
	direction="horizontal"
	class="mt-4 flex gap-0 rounded-lg lg:w-fit lg:min-w-2xl {className}"
>
	<Resizable.Pane defaultSize={showCharts ? 70 : 100} class="min-w-0 bg-background">
		<ScrollArea orientation="both" class="w-full rounded-lg p-2">
			<div class="flex min-w-full flex-col gap-2 rounded-md border-0 px-1">
				{#if search}
					<ScrollArea
						orientation="horizontal"
						class="flex flex-row items-start justify-start rounded-md border"
					>
						<div class="flex max-w-4xl flex-row items-center justify-start gap-2 p-4">
							<Input
								type="search"
								placeholder={isServer ? 'Search all rows…' : 'Search Table...'}
								class="w-64 lg:w-xl"
								bind:value={
									() => (isServer ? serverSearch : globalFilter),
									(v: string) => (isServer ? (serverSearch = v) : (globalFilter = v))
								}
								oninput={(e) => onSearchInput(e.currentTarget.value)}
							/>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="outline" class="ml-auto">
											Columns <ChevronDownIcon class="size-5" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									{#each table
										.getAllColumns()
										.filter((col) => col.getCanHide()) as column (column.id)}
										<DropdownMenu.CheckboxItem
											class="capitalize"
											bind:checked={
												() => column.getIsVisible(), (v) => column.toggleVisibility(!!v)
											}
										>
											{column.id.replace(/([a-z])([A-Z])/g, '$1 $2')}
										</DropdownMenu.CheckboxItem>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>

							{#if activeFacetCount}
								<Button variant="ghost" size="sm" class="gap-1" onclick={clearAllFacets}>
									<RotateCcw class="size-4" />
									Clear {activeFacetCount}
								</Button>
							{/if}

							<Pdf {fileName} {table} />

							<Button variant="outline">
								<ListOrdered />
								{pagerTotal.toLocaleString()} Results
							</Button>
						</div>
					</ScrollArea>
				{/if}

				<div class="rounded-md border">
					<div class="max-h-[45vh] overflow-auto">
						<Table.Root class="relative">
							<Table.Header>
								{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
									<Table.Row>
										{#each headerGroup.headers as header (header.id)}
											<Table.Head colspan={header.colSpan}>
												{#if !header.isPlaceholder}
													<div class="flex items-center gap-1">
														<FlexRender
															content={header.column.columnDef.header}
															context={header.getContext()}
														/>
														<!-- The filter belongs on the column it filters, not in a panel
														     the reader has to look away from the data to open. -->
														{#if facetKeys.includes(header.column.id)}
															<TableFacet
																label={facetLabels[header.column.id] ?? header.column.id}
																facets={facets[header.column.id] ?? []}
																selected={selectedFacets[header.column.id] ?? []}
																multi={!isServer}
																onToggle={(v) => toggleFacet(header.column.id, v)}
																onClear={() => clearFacet(header.column.id)}
															/>
														{/if}
													</div>
												{/if}
											</Table.Head>
										{/each}
									</Table.Row>
								{/each}
							</Table.Header>

							<Table.Body>
								{#each table.getRowModel().rows as row (row.id)}
									<Table.Row data-state={row.getIsSelected() && 'selected'}>
										{#each row.getVisibleCells() as cell (cell.id)}
											<Table.Cell>
												<FlexRender
													content={cell.column.columnDef.cell}
													context={cell.getContext()}
												/>
											</Table.Cell>
										{/each}
									</Table.Row>
								{:else}
									<Table.Row>
										<Table.Cell colspan={columns.length} class="text-center font-2xl">
											<div class="flex flex-row items-center justify-center gap-2">
												<Frown class="animate-bounce" /> Nothing found here.
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>

					<TablePagination
						page={pagerPage}
						pageSize={pagerSize}
						total={pagerTotal}
						{pageSizes}
						onPage={goToPage}
						onPageSize={changePageSize}
					/>
				</div>
			</div>
		</ScrollArea>
	</Resizable.Pane>

	{#if showCharts}
		<ResizableHandle withHandle />
		<Resizable.Pane defaultSize={30} class="min-w-0">
			<TableCharts {facets} labels={facetLabels} selected={selectedFacets} onToggle={toggleFacet} />
		</Resizable.Pane>
	{/if}
</Resizable.PaneGroup>
