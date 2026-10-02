<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BanknoteArrowUp from '@lucide/svelte/icons/banknote-arrow-up';
	import Landmark from '@lucide/svelte/icons/landmark';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import { bankColumns, payslipColumns } from './columns';
	import { payrollSchema } from './schema';

	/**
	 * Running a month's payroll: every unpaid payslip for the month, filtered and charted by the
	 * table itself, and paying the ticked ones. A run is a month by nature, so the month stays in the
	 * address — but the amounts on screen are only a preview: the action recomputes each payslip as
	 * it pays it, and the form carries nothing but who, how, when, and the receipt.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, payrollSchema, {
		dataType: 'json',
		onUpdated({ form }) {
			if (form.message?.type === 'success') {
				payOpen = false;
				selected = [];
			}
		}
	});

	type Row = (typeof data.payrollData)[number];
	let selected = $state<Row[]>([]);
	let payOpen = $state(false);
	let bankView = $state(false);
	// svelte-ignore state_referenced_locally
	let month = $state(data.month);

	/** The ticked payslips, or every one when none is ticked: what the figures describe. */
	const counted = $derived(selected.length ? selected : data.payrollData);
	const sum = (key: 'gross' | 'taxAmount' | 'penEm' | 'penOrg' | 'netPay') =>
		Math.round(counted.reduce((total, row) => total + row[key], 0) * 100) / 100;

	const TILES = $derived([
		{ label: selected.length ? 'Ticked' : 'Unpaid', value: counted.length.toLocaleString() },
		{ label: 'Gross', value: formatETB(sum('gross')) },
		{ label: 'Income tax', value: formatETB(sum('taxAmount')) },
		{ label: 'Pension (both shares)', value: formatETB(sum('penEm') + sum('penOrg')) },
		{ label: 'Net to pay', value: formatETB(sum('netPay')) }
	]);

	function openPay() {
		$form.staffIds = selected.map((row) => row.id);
		$form.month = data.month;
		payOpen = true;
	}

	const monthLabel = $derived(decodeURIComponent(data.month).replace('_', ' '));
</script>

<svelte:head>
	<title>Unpaid Salaries — {monthLabel}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Unpaid Salaries — {monthLabel}</h1>
			<p class="text-muted-foreground">
				Everyone not yet paid for the month. Tick who to pay; each payslip is worked out again as it
				is paid.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<label class="sr-only" for="month-select">Month</label>
			<MonthYear bind:value={month} />
			<Button variant="outline" href="/dashboard/salary/add-payroll/{month}">
				Go <ArrowRight class="size-4" />
			</Button>
		</div>
	</header>

	{#if data.payrollData.length === 0}
		<p class="rounded-lg border p-6 text-center text-muted-foreground">
			Everyone at this branch has been paid for {monthLabel}, or nobody is on the payroll yet. See
			<a class="underline" href="/dashboard/salary/paid-salaries">Paid Salaries</a> for what was paid.
		</p>
	{:else}
		{#if data.unrecorded.length}
			<!-- Deducted as absences unless someone is ticked or excused first (`$lib/attendance.ts`). -->
			<section
				class="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm"
				aria-label="Absences to check"
			>
				<p class="font-semibold text-destructive">
					{data.unrecorded.length}
					{data.unrecorded.length === 1 ? 'person has' : 'people have'} working days with nothing on the
					register. They will be paid as absences.
				</p>
				<ul class="mt-2 flex flex-col gap-1">
					{#each data.unrecorded.slice(0, 8) as person (person.id)}
						<li>
							{person.name} — {person.days.length}
							{person.days.length === 1 ? 'day' : 'days'}
						</li>
					{/each}
					{#if data.unrecorded.length > 8}
						<li class="text-muted-foreground">and {data.unrecorded.length - 8} more</li>
					{/if}
				</ul>
				<a
					class="mt-2 inline-block underline"
					href="/dashboard/employees/attendance/month?month={encodeURIComponent(
						decodeURIComponent(data.month)
					)}">Check the month’s attendance</a
				>
			</section>
		{/if}

		<section class="grid grid-cols-2 gap-4 sm:grid-cols-5" aria-label="Payroll at a glance">
			{#each TILES as tile (tile.label)}
				<div class="rounded-lg border bg-card p-4">
					<p class="text-sm text-muted-foreground">{tile.label}</p>
					<p class="text-xl font-bold tabular-nums">{tile.value}</p>
				</div>
			{/each}
		</section>

		<div class="flex flex-wrap gap-2">
			<Button disabled={!selected.length} onclick={openPay}>
				<BanknoteArrowUp class="size-4" />
				Pay {selected.length || ''}
				{selected.length === 1 ? 'employee' : 'employees'}
			</Button>
			<Button variant="outline" onclick={() => (bankView = !bankView)}>
				{#if bankView}
					<ListChecks class="size-4" /> Full payslips
				{:else}
					<Landmark class="size-4" /> What the bank needs
				{/if}
			</Button>
		</div>

		{#key bankView}
			<DataTable
				data={data.payrollData}
				columns={bankView ? bankColumns : payslipColumns}
				bind:selected
				search
				charts
				facetKeys={bankView ? ['bank'] : ['department', 'position', 'branch', 'employmentStatus']}
				facetLabels={{ employmentStatus: 'Employment' }}
				fileName={bankView ? `Bank transfer ${monthLabel}` : `Payroll ${monthLabel}`}
			/>
		{/key}
	{/if}
</div>

<DialogComp title="Pay {selected.length} for {monthLabel}" bind:open={payOpen} variant="ghost">
	{#snippet trigger()}{/snippet}
	<form
		method="POST"
		action="?/runPayroll"
		use:enhance
		enctype="multipart/form-data"
		id="payroll"
		class="flex flex-col gap-3 p-4"
	>
		<Errors allErrors={$allErrors} />
		<dl class="grid grid-cols-2 gap-1 rounded-md border p-3 text-sm">
			<dt class="text-muted-foreground">Gross</dt>
			<dd class="text-right tabular-nums">{formatETB(sum('gross'))}</dd>
			<dt class="text-muted-foreground">Tax and pension</dt>
			<dd class="text-right tabular-nums">
				−{formatETB(sum('taxAmount') + sum('penEm'))}
			</dd>
			<dt class="font-semibold">Net to transfer</dt>
			<dd class="text-right font-semibold tabular-nums">{formatETB(sum('netPay'))}</dd>
		</dl>
		<p class="text-xs text-muted-foreground">
			A preview: each payslip is recomputed as it is paid, so an overtime entry added since this
			page loaded is included.
		</p>
		<InputComp label="Payment date" type="date" name="paymentDate" {form} {errors} />
		<InputComp
			label="Paid from"
			type="combo"
			items={data.paymentMethods}
			name="paymentMethod"
			{form}
			{errors}
		/>
		<InputComp
			label="Bank receipt"
			type="file"
			name="reciept"
			{form}
			{errors}
			placeholder="A PDF or photo of the transfer"
		/>
		<Button type="submit" form="payroll">
			{#if $delayed}
				<LoadingBtn name="Paying" />
			{:else}
				<BanknoteArrowUp class="size-4" /> Pay {selected.length}
				{selected.length === 1 ? 'employee' : 'employees'}
			{/if}
		</Button>
	</form>
</DialogComp>
