<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { navigateWithQuery } from '@nahu/admin-kit/queryFilters.js';
	import TableDateRange from '@nahu/admin-kit/components/Table/table-date-range.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import { CUSTOM_FILTER_KEYS, defaultRange, type CustomFilterKey } from './filters';

	/**
	 * What every figure, chart and ledger row on a report answers to: the period, and narrowings
	 * by who, where and what. Built from the kit's pieces — its date-range control and selects.
	 *
	 * **Why reports keep a filter panel** when every list moved its filters into the table: these
	 * filter the charts and tiles too, not one table, so they cannot live in a column header. It
	 * replaced `QueryBuilder`, a generic 544-line filter bar the kit does not carry, which reports
	 * were the last to use. Search and paging are the ledger table's own now.
	 *
	 * The period applies at once (the kit's control writes it to the address); the dropdowns are a
	 * draft applied together, so choosing three of them does not reload the report three times.
	 */
	type Option = { id: number | string; name: string | null };

	let {
		filters,
		options
	}: {
		/** The report query as `parseFilters` read it. */
		filters: Record<string, unknown> & { dateStart: string; dateEnd: string };
		/** The option lists, from `filterOptions()` in `details.server.ts`. */
		options: {
			departments: Option[];
			positions: Option[];
			branches: Option[];
			customers: Option[];
			employmentStatuses: Option[];
			educationalLevels: Option[];
			staff: Option[];
			paymentMethods: Option[];
			expenseTypes: Option[];
			supplyTypes: Option[];
			suppliers: Option[];
			services: Option[];
			leaveTypes: Option[];
			overtimeTypes: Option[];
		};
	} = $props();

	const asText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

	/** The dropdowns as they stand in the address, which a draft starts from and resets to. */
	const fromUrl = () =>
		Object.fromEntries(CUSTOM_FILTER_KEYS.map((key) => [key, asText(filters[key])])) as Record<
			CustomFilterKey,
			string
		>;

	// Follows the address (another report, Back) and is overwritten while choosing.
	let draft = $derived(fromUrl());

	/** Changes one dropdown in the draft — by reassigning it, which a `$derived` allows. */
	function set(key: CustomFilterKey, value: string) {
		draft = { ...draft, [key]: value };
	}

	const changed = $derived(CUSTOM_FILTER_KEYS.some((key) => draft[key] !== asText(filters[key])));

	function apply() {
		// The page cursor resets: page 4 of the old result is not page 4 of the new one.
		navigateWithQuery({ ...draft, page: 1 });
	}

	function clearAll() {
		const range = defaultRange();
		navigateWithQuery({
			...Object.fromEntries(CUSTOM_FILTER_KEYS.map((key) => [key, null])),
			dateStart: range.dateStart,
			dateEnd: range.dateEnd,
			search: null,
			page: 1
		});
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

	/** Each dropdown: its label, the param it writes, its choices, and what "none" reads as. */
	const PICKS = $derived<[string, CustomFilterKey, Option[], string][]>([
		['Department', 'departmentId', options.departments, 'All departments'],
		['Position', 'positionId', options.positions, 'All positions'],
		['Branch', 'branchId', options.branches, 'All branches'],
		['Payer', 'customerId', options.customers, 'All payers'],
		['Employment status', 'employmentStatusId', options.employmentStatuses, 'All statuses'],
		['Education', 'educationalLevelId', options.educationalLevels, 'Any level'],
		['Gender', 'gender', GENDERS, 'Any gender'],
		['Employee', 'staffId', options.staff, 'All employees'],
		['Payment method', 'paymentMethodId', options.paymentMethods, 'All methods'],
		['Expense type', 'expenseTypeId', options.expenseTypes, 'All expense types'],
		['Transaction status', 'transactionStatus', TRANSACTION_STATUSES, 'Any status'],
		['Supply type', 'supplyTypeId', options.supplyTypes, 'All supply types'],
		['Supplier', 'supplierId', options.suppliers, 'All suppliers'],
		['Service', 'serviceId', options.services, 'All services'],
		['Leave type', 'leaveTypeId', options.leaveTypes, 'All leave types'],
		['Overtime type', 'overtimeTypeId', options.overtimeTypes, 'All overtime types'],
		['Approval', 'approvalStatus', APPROVALS, 'Any approval'],
		['Payroll status', 'payrollStatus', PAYROLL_STATUSES, 'Any payroll status']
	]);

	const nameOf = (list: Option[], value: string, fallback: string) =>
		(value && list.find((option) => String(option.id) === value)?.name) || fallback;
</script>

<section class="flex flex-col gap-4 rounded-lg border bg-card p-4" aria-label="Report filters">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">
			Every figure, chart and row on this report answers to these.
		</p>
		<TableDateRange label="Period" start={filters.dateStart} end={filters.dateEnd} />
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each PICKS as [label, key, list, anyLabel] (key)}
			<div class="flex flex-col gap-1.5">
				<Label class="text-sm font-medium">{label}</Label>
				<Select type="single" value={draft[key]} onValueChange={(v: string) => set(key, v)}>
					<SelectTrigger class="w-full truncate">{nameOf(list, draft[key], anyLabel)}</SelectTrigger
					>
					<SelectContent class="max-h-72">
						<SelectItem value="">{anyLabel}</SelectItem>
						{#each list as option (option.id)}
							<SelectItem value={String(option.id)}>{option.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/each}
		<div class="flex flex-col gap-1.5">
			<Label class="text-sm font-medium" for="min-amount">Minimum amount</Label>
			<Input
				id="min-amount"
				type="number"
				inputmode="decimal"
				placeholder="No minimum"
				value={draft.minAmount}
				oninput={(event) => set('minAmount', event.currentTarget.value)}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<Label class="text-sm font-medium" for="max-amount">Maximum amount</Label>
			<Input
				id="max-amount"
				type="number"
				inputmode="decimal"
				placeholder="No maximum"
				value={draft.maxAmount}
				oninput={(event) => set('maxAmount', event.currentTarget.value)}
			/>
		</div>
	</div>

	<div class="flex flex-wrap justify-end gap-2">
		<Button variant="ghost" size="sm" onclick={clearAll}>
			<RotateCcw class="size-4" /> Clear all
		</Button>
		<Button size="sm" onclick={apply} disabled={!changed}>
			<Check class="size-4" /> Apply filters
		</Button>
	</div>
</section>
