<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import Plus from '@lucide/svelte/icons/plus';
	import { page } from '$app/state';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import CheckboxComp from '@nahu/admin-kit/formComponents/CheckboxComp.svelte';
	import { clinicToday } from '$lib/clinicTime';
	import { LEDGER, LEDGER_KINDS, ledgerHref } from '$lib/payrollLedger';
	import { ledgerEdit, ledgerEntry, type LedgerEdit } from '$lib/forms/payrollLedger';
	import { ledgerColumns } from './columns';
	import AdjustmentFields from './AdjustmentFields.svelte';

	/**
	 * A pay-adjustment ledger: every overtime, bonus or deduction entry in any period, filtered and
	 * counted on the server. Recording one for several employees at once is one dialog; an entry
	 * inside a period already paid is closed (`payrollLedgerWrites.ts`).
	 */
	let { data } = $props();

	const meta = $derived(data.meta);
	const q = $derived(data.currentQuery);

	// Arriving from an employee's page (`?staffId=`) opens the record dialog on that employee.
	let addOpen = $state(Boolean(page.url.searchParams.get('staffId')));
	const recordSeed = $derived({
		date: clinicToday(),
		...(q.staffId ? { staffIds: [Number(q.staffId)] } : {})
	});
	let editOpen = $state(false);
	let editSeed = $state<Partial<LedgerEdit>>({});

	const columns = $derived(
		ledgerColumns(
			meta,
			(row) => {
				editSeed = {
					id: row.id,
					date: row.date,
					typeId: row.typeId ?? '',
					type: row.type ?? '',
					hours: row.hours ?? undefined,
					amount: row.amount,
					reason: row.reason ?? ''
				};
				editOpen = true;
			},
			data.canDelete ? data.forms.remove : null
		)
	);

	/** The other kinds, keeping the period and the search, so a month reads across all three. */
	function kindLink(kind: (typeof LEDGER_KINDS)[number]) {
		const query = ['dateStart', 'dateEnd', 'search']
			.map((key) => [key, page.url.searchParams.get(key)] as const)
			.filter(([, value]) => value)
			.map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`)
			.join('&');
		return `${ledgerHref(kind)}${query ? `?${query}` : ''}`;
	}

	const unpaid = $derived(data.facets.paid.find((f) => f.value === 'no')?.count ?? 0);
	const TILES = $derived<Stat[]>([
		{ key: 'entries', label: 'Entries', value: data.totals.entries, format: 'count', group: 'pay' },
		{
			key: 'employees',
			label: 'Employees',
			value: data.totals.employees,
			format: 'count',
			group: 'pay'
		},
		...(meta.priced === 'hours'
			? [
					{
						key: 'hours',
						label: 'Hours',
						value: data.totals.hours,
						format: 'hours',
						group: 'pay'
					} satisfies Stat
				]
			: []),
		{
			key: 'amount',
			label: meta.effect === 'takes' ? 'Total taken' : 'Total paid',
			value: data.totals.amount,
			format: 'money',
			group: 'pay'
		},
		{ key: 'unpaid', label: 'Not paid yet', value: unpaid, format: 'count', group: 'pay' }
	]);
</script>

<svelte:head>
	<title>{meta.title}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">{meta.title}</h1>
			<p class="text-muted-foreground">{meta.blurb}</p>
		</div>
		<Button onclick={() => (addOpen = true)} disabled={!data.employees.length}>
			<Plus class="size-4" /> Record {meta.singular}
		</Button>
	</header>

	<nav class="flex gap-1 border-b" aria-label="Pay adjustments">
		{#each LEDGER_KINDS as kind (kind)}
			<a
				href={kindLink(kind)}
				aria-current={kind === data.kind ? 'page' : undefined}
				class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {kind === data.kind
					? 'border-primary text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{LEDGER[kind].title}
			</a>
		{/each}
	</nav>

	<section class="grid grid-cols-2 gap-4 sm:grid-cols-5" aria-label="{meta.title} at a glance">
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>

	<DataTable
		data={data.rows}
		{columns}
		fileName={meta.title}
		search
		charts
		dateFilter="Date"
		facetKeys={['department', 'position', ...(meta.typeLabel ? ['type'] : []), 'paid']}
		facetLabels={{
			department: 'Department',
			position: 'Position',
			type: meta.typeLabel ?? 'Type',
			paid: 'Payroll'
		}}
		facetParams={{ department: 'departmentId', position: 'positionId', type: 'typeId' }}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: q.search,
				sort: q.sort,
				dir: q.dir,
				dateStart: q.dateStart,
				dateEnd: q.dateEnd,
				department: q.departmentId,
				position: q.positionId,
				type: q.typeId,
				paid: q.paid
			}
		}}
	/>
</div>

<FormDialog
	title="Record {meta.singular}"
	description={meta.priced === 'hours'
		? 'Priced for each employee from their salary on that day and the type’s rate.'
		: 'One entry for each employee chosen.'}
	action="?/add"
	data={data.forms.add}
	schema={ledgerEntry}
	bind:open={addOpen}
	seed={recordSeed}
	hideTrigger
	resetOnSuccess
	submitLabel="Record"
>
	{#snippet fields({ form, errors, values })}
		<div class="flex flex-col gap-2">
			<span class="text-sm font-medium">Employees</span>
			<CheckboxComp
				id="ledger-staff"
				searchable
				items={data.employees}
				bind:checkedValues={
					(): number[] => (Array.isArray(values.staffIds) ? values.staffIds.map(Number) : []),
					(ids) => form.update((f) => ({ ...f, staffIds: ids }))
				}
			/>
			{#each Array.isArray(values.staffIds) ? values.staffIds : [] as id (id)}
				<input type="hidden" name="staffIds" value={id} />
			{/each}
		</div>
		<AdjustmentFields {meta} types={data.types} {form} {errors} />
	{/snippet}
</FormDialog>

<FormDialog
	title="Change this {meta.singular}"
	action="?/edit"
	data={data.forms.edit}
	schema={ledgerEdit}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		<AdjustmentFields {meta} types={data.types} {form} {errors} />
	{/snippet}
</FormDialog>
