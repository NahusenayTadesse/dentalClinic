<script lang="ts">
	import { page as pageState } from '$app/state';

	import { applyQueryToUrl } from '@nahu/admin-kit/queryFilters.js';

	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { CalendarRange, LayoutGrid, Funnel, X } from '@lucide/svelte';

	import { formatEthiopianDate } from '$lib/global.svelte';
	import { REPORT_PAGES } from './sections';
	import { canVisit } from '$lib/routeAccess';
	import { CUSTOM_FILTER_KEYS, defaultRange, type CustomFilterKey } from './filters';

	let { data, children } = $props();

	const filters = $derived(data.filters);

	const rangeLabel = $derived(
		`${formatEthiopianDate(new Date(filters.dateStart))} — ${formatEthiopianDate(new Date(filters.dateEnd))}`
	);

	const base = '/dashboard/reports';

	// Each report sits behind its own permission — HR reads people and leave, finance reads the
	// money ones, the audit log is its own. Only the reports this user may open are offered.
	const permList = $derived((pageState.data.permList ?? []) as string[]);
	const reportPages = $derived(REPORT_PAGES.filter((r) => canVisit(`${base}/${r.slug}`, permList)));
	const canSeeOverview = $derived(canVisit(base, permList));

	/** Keeps the whole query when moving between reports — only the path changes. */
	const suffix = $derived.by(() => {
		const params = new URLSearchParams(pageState.url.searchParams);
		// The open ledger and the page cursor belong to the report being left.
		params.delete('section');
		params.delete('page');
		const query = params.toString();
		return query ? `?${query}` : '';
	});

	const activeSlug = $derived(pageState.url.pathname.replace(`${base}/`, '').split('/')[0]);
	const isOverview = $derived(pageState.url.pathname === base);

	/**
	 * Twenty filters is a wall of controls to put above every report, so the
	 * panel starts closed and the button carries the count instead. The date
	 * range — the one filter that is always set — is spelled out in the header,
	 * so a closed panel never hides what the numbers are actually answering.
	 */
	let filtersOpen = $state(false);

	const fallbackRange = defaultRange();

	const activeFilterCount = $derived(
		[
			filters.search !== '',
			filters.dateStart !== fallbackRange.dateStart || filters.dateEnd !== fallbackRange.dateEnd,
			...CUSTOM_FILTER_KEYS.map((key) => {
				const value = filters[key as CustomFilterKey];
				return value !== null && value !== undefined && value !== '';
			})
		].filter(Boolean).length
	);

	const initialCustomFilters = $derived(
		Object.fromEntries(
			CUSTOM_FILTER_KEYS.map((key) => [key, String(filters[key as CustomFilterKey] ?? '')])
		) as Record<CustomFilterKey, string>
	);

	type Option = { id: number | string; name: string };

	function nameOf(options: Option[], value: string, fallback: string): string {
		if (!value) return fallback;
		return options.find((option) => String(option.id) === value)?.name ?? fallback;
	}

	const GENDERS: Option[] = [
		{ id: 'male', name: 'Male' },
		{ id: 'female', name: 'Female' }
	];
	const APPROVALS: Option[] = [
		{ id: 'pending', name: 'Pending' },
		{ id: 'approved', name: 'Approved' },
		{ id: 'rejected', name: 'Rejected' }
	];
	const PAYROLL_STATUSES: Option[] = [
		{ id: 'pending', name: 'Pending' },
		{ id: 'approved', name: 'Approved' },
		{ id: 'paid', name: 'Paid' }
	];
	const TRANSACTION_STATUSES: Option[] = [
		{ id: 'pending', name: 'Pending' },
		{ id: 'paid', name: 'Paid' },
		{ id: 'unpaid', name: 'Unpaid' },
		{ id: 'partially_paid', name: 'Partially paid' },
		{ id: 'overpaid', name: 'Overpaid' },
		{ id: 'refunded', name: 'Refunded' },
		{ id: 'partially_refunded', name: 'Partially refunded' },
		{ id: 'disputed', name: 'Disputed' }
	];
</script>

{#snippet pick(
	label: string,
	key: CustomFilterKey,
	options: Option[],
	anyLabel: string,
	values: Record<string, unknown>,
	update: (key: CustomFilterKey, value: string) => void
)}
	<div class="flex flex-col gap-2">
		<Label class="text-sm font-medium">{label}</Label>
		<Select
			type="single"
			value={String(values[key] ?? '')}
			onValueChange={(v: string) => update(key, v)}
		>
			<SelectTrigger class="w-full truncate">
				{nameOf(options, String(values[key] ?? ''), anyLabel)}
			</SelectTrigger>
			<SelectContent class="max-h-72">
				<SelectItem value="">{anyLabel}</SelectItem>
				{#each options as option (option.id)}
					<SelectItem value={String(option.id)}>{option.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>
{/snippet}

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Reports</h1>
			<p class="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
				<CalendarRange class="size-4" />
				{rangeLabel}
			</p>
		</div>

		<Button
			variant={filtersOpen ? 'secondary' : 'outline'}
			size="sm"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = !filtersOpen)}
		>
			{#if filtersOpen}
				<X class="size-4" />
				Hide filters
			{:else}
				<Funnel class="size-4" />
				Filters
			{/if}
			{#if activeFilterCount > 0}
				<Badge variant="secondary" class="ml-1">{activeFilterCount}</Badge>
			{/if}
		</Button>
	</div>

	<!-- The link map. Every report keeps the current query when you move to it,
	     so a filter set once follows you across the whole section. -->
	<nav aria-label="Reports" class="flex flex-wrap gap-2 border-b pb-4">
		{#if canSeeOverview}
			<Button
				href="{base}{suffix}"
				variant={isOverview ? 'default' : 'outline'}
				size="sm"
				aria-current={isOverview ? 'page' : undefined}
			>
				<LayoutGrid class="size-4" />
				Overview
			</Button>
		{/if}

		{#each reportPages as report (report.slug)}
			<Button
				href="{base}/{report.slug}{suffix}"
				variant={activeSlug === report.slug && !isOverview ? 'default' : 'outline'}
				size="sm"
				aria-current={activeSlug === report.slug && !isOverview ? 'page' : undefined}
			>
				{report.title}
			</Button>
		{/each}
	</nav>

	{#if filtersOpen}
		<QueryBuilder
			title="Report Query"
			description="Every figure, chart and row on this report answers to this query"
			showDate
			collapsible={false}
			searchPlaceholder="Search the open ledger..."
			initialSearch={filters.search}
			initialStart={filters.dateStart}
			initialEnd={filters.dateEnd}
			initialPageSize={filters.pageSize}
			defaultPageSize={25}
			defaultStart={fallbackRange.dateStart}
			defaultEnd={fallbackRange.dateEnd}
			pageSizes={[10, 25, 50, 100, 250]}
			{initialCustomFilters}
			onQueryChange={applyQueryToUrl}
		>
			{#snippet children(values, update)}
				{@render pick(
					'Department',
					'departmentId',
					data.filterOptions.departments,
					'All departments',
					values,
					update
				)}
				{@render pick(
					'Position',
					'positionId',
					data.filterOptions.positions,
					'All positions',
					values,
					update
				)}
				{@render pick(
					'Branch',
					'branchId',
					data.filterOptions.branches,
					'All branches',
					values,
					update
				)}
				{@render pick(
					'Customer',
					'customerId',
					data.filterOptions.customers,
					'All customers',
					values,
					update
				)}
				{@render pick(
					'Employment Status',
					'employmentStatusId',
					data.filterOptions.employmentStatuses,
					'All statuses',
					values,
					update
				)}
				{@render pick(
					'Education',
					'educationalLevelId',
					data.filterOptions.educationalLevels,
					'Any level',
					values,
					update
				)}
				{@render pick('Gender', 'gender', GENDERS, 'Any gender', values, update)}
				{@render pick(
					'Employee',
					'staffId',
					data.filterOptions.staff,
					'All employees',
					values,
					update
				)}
				{@render pick(
					'Payment Method',
					'paymentMethodId',
					data.filterOptions.paymentMethods,
					'All methods',
					values,
					update
				)}
				{@render pick(
					'Expense Type',
					'expenseTypeId',
					data.filterOptions.expenseTypes,
					'All expense types',
					values,
					update
				)}
				{@render pick(
					'Transaction Status',
					'transactionStatus',
					TRANSACTION_STATUSES,
					'Any status',
					values,
					update
				)}
				{@render pick(
					'Supply Type',
					'supplyTypeId',
					data.filterOptions.supplyTypes,
					'All supply types',
					values,
					update
				)}
				{@render pick(
					'Supplier',
					'supplierId',
					data.filterOptions.suppliers,
					'All suppliers',
					values,
					update
				)}
				{@render pick(
					'Service',
					'serviceId',
					data.filterOptions.services,
					'All services',
					values,
					update
				)}
				{@render pick(
					'Leave Type',
					'leaveTypeId',
					data.filterOptions.leaveTypes,
					'All leave types',
					values,
					update
				)}
				{@render pick(
					'Overtime Type',
					'overtimeTypeId',
					data.filterOptions.overtimeTypes,
					'All overtime types',
					values,
					update
				)}
				{@render pick('Approval', 'approvalStatus', APPROVALS, 'Any approval', values, update)}
				{@render pick(
					'Payroll Status',
					'payrollStatus',
					PAYROLL_STATUSES,
					'Any payroll status',
					values,
					update
				)}

				<div class="flex flex-col gap-2">
					<Label class="text-sm font-medium" for="min-amount">Minimum Amount</Label>
					<Input
						id="min-amount"
						type="number"
						inputmode="decimal"
						placeholder="No minimum"
						value={String(values.minAmount ?? '')}
						onchange={(event: Event) =>
							update('minAmount', (event.currentTarget as HTMLInputElement).value)}
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label class="text-sm font-medium" for="max-amount">Maximum Amount</Label>
					<Input
						id="max-amount"
						type="number"
						inputmode="decimal"
						placeholder="No maximum"
						value={String(values.maxAmount ?? '')}
						onchange={(event: Event) =>
							update('maxAmount', (event.currentTarget as HTMLInputElement).value)}
					/>
				</div>
			{/snippet}
		</QueryBuilder>
	{/if}

	{@render children?.()}
</div>
