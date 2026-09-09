<script lang="ts">
	import { columns, columns2 } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	import { ArrowRight, BanknoteArrowUp, Frown, Loader, Printer, Sheet } from '@lucide/svelte';
	import DateMonth from '$lib/formComponents/DateMonth.svelte';
	import Filter from '$lib/components/Table/FilterMenu.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	let filteredList = $derived(data?.payrollData);

	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { payrollSchema as schema, type EmployeeFormType } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import Errors from '$lib/formComponents/Errors.svelte';
	import type { Snapshot } from '@sveltejs/kit';

	const { form, errors, enhance, delayed, allErrors, capture, restore, message } = superForm(
		data.form,
		{
			validators: zod4Client(schema),
			dataType: 'json'
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	import { toast } from 'svelte-sonner';
	import PayrollTotals from './payroll-totals.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	$form.start = data?.start;
	$form.end = data?.end;

	let selected = $state([]);

	$effect(() => {
		if (filteredList.length > 0) {
			$form.employees = selected.map(
				(emp): EmployeeFormType => ({
					...emp,
					// Ensure numeric fields from LEFT JOINs aren't null
					id: emp.id,
					positionAllowance: Number(emp.positionAllowance) ?? 0,
					housingAllowance: Number(emp.housingAllowance) ?? 0,
					transportAllowance: Number(emp.transportAllowance) ?? 0,
					nonTaxable: emp.nonTaxable ?? 0,
					overtime: emp.overtime ?? 0,
					bonus: emp.bonus ?? 0,
					paymentMethodId: emp.paymentMethodId ?? null,
					absent: emp.absent ?? 0,
					attendancePenality: emp.attendancePenality ?? 0,
					deductions: emp.deductions ?? 0,
					gross: emp.gross ?? 0,
					taxable: emp.taxable ?? 0,
					taxAmount: Number(emp.taxAmount) ?? 0,
					netPay: emp.netPay ?? 0,
					penEm: emp.penEm ?? 0,
					penOrg: emp.penOrg ?? 0,
					// Ensure strings aren't null if the schema doesn't allow it
					account: emp.account ?? '',
					employmentStatus: emp.employmentStatus ?? ''
				})
			);
		}
	});

	const calculateTotal = (employees: any[], key: keyof EmployeeFormType): number => {
		// If employees hasn't been populated by the effect yet, return 0
		if (!employees || !Array.isArray(employees)) return 0;

		const total = employees.reduce((sum, emp) => {
			const value = emp[key];
			// Cast to number just in case they are stringified numbers from an input
			const numValue = typeof value === 'string' ? parseFloat(value) : value;
			return sum + (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0);
		}, 0);

		return Math.round(total * 100) / 100;
	};

	let calculatable = $derived(selected?.length === 0 ? filteredList : selected);

	let totals = $derived({
		gross: calculateTotal(calculatable, 'gross'),
		tax: calculateTotal(calculatable, 'taxAmount'),
		penEm: calculateTotal(calculatable, 'penEm'),
		penOrg: calculateTotal(calculatable, 'penOrg'),
		netPay: calculateTotal(calculatable, 'netPay')
	});

	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { formatETB, formatEthiopianYearMonth } from '$lib/global.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let month = $state(page.params.range);

	$form.month = page.params.range;
	$form.start = data?.start;
	$form.end = data?.end;

	let link = $derived(`${month}`);

	let bankColumn = $state(false);
	let column = $derived(bankColumn ? columns2 : columns);
	let Icon = $derived(bankColumn ? Sheet : Printer);
</script>

<svelte:head>
	<title>UnPaid Salaries for All Employees</title>
</svelte:head>

{#if data.payrollData.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<div class="mt-12 flex flex-col items-center justify-center px-4 text-center">
			<Frown class="mb-4 h-12 w-12 animate-bounce text-slate-400" />

			<h3 class="text-2xl font-semibold">No payroll records found</h3>

			<p class="mt-2 max-w-md">
				There are no salaries recorded for <strong>{data?.siteName}</strong> within the selected date
				range. Please try selecting a different period.
			</p>
		</div>
		<div class="flex h-96 w-5xl flex-col items-center justify-center">
			<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl"></p>
			<div class="flex items-center gap-2">
				<label class="sr-only" for="month-select">Month</label>
				<MonthYear bind:value={month} />
			</div>

			<Button
				onclick={() => goto(`/dashboard/salary/add-payroll/${link}`)}
				aria-label="Go to selected month and year"
				class="flex items-center gap-2"
			>
				Go
				<ArrowRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
{:else}
	{#if $form.employees.length}
		<DialogComp
			title="Finalise Payroll for Filtered Employees {selected?.length}"
			variant="default"
			IconComp={BanknoteArrowUp}
		>
			<Errors allErrors={$allErrors} />
			<div class="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<h3 class="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
					Payroll Summary for All Employees
				</h3>

				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-slate-600">Gross Pay </span>
						<span class="font-medium text-slate-900">{formatETB(totals.gross)}</span>
					</div>

					<div class="flex justify-between border-b border-slate-100 pb-2">
						<span class="text-slate-600">Tax & Penalties</span>
						<span class="font-medium text-rose-600">
							-{formatETB(totals.tax + totals.penEm + totals.penOrg)}
						</span>
					</div>

					<div class="flex justify-between pt-1">
						<span class="font-bold text-slate-900">Net Pay</span>
						<span class="text-base font-bold text-indigo-600">
							{formatETB(totals.netPay)}
						</span>
					</div>
				</div>
			</div>
			<form
				method="POST"
				action="?/runPayroll"
				use:enhance
				class="flex w-full flex-col gap-2"
				enctype="multipart/form-data"
				id="payroll"
			>
				<InputComp type="hidden" label="" name="start" {form} {errors} />
				<InputComp type="hidden" label="" name="end" {form} {errors} />
				<InputComp type="hidden" label="Month" name="month" {form} {errors} required />
				<MonthYear bind:value={$form.month} />

				<InputComp label="" type="hidden" name="employees" {form} {errors} />
				<InputComp label="Payment Date" type="date" name="paymentDate" {form} {errors} />
				<InputComp
					label="Bank Processed With"
					type="combo"
					items={data?.banks}
					name="bank"
					{form}
					{errors}
				/>
				<InputComp
					label="Upload Bank Statement"
					type="file"
					name="reciept"
					{form}
					{errors}
					placeholder="Upload a pdf or image of bank statemeent"
				/>

				<Button form="payroll" type="submit" class="text-md px-2 py-6">
					{#if $delayed}
						<LoadingBtn name="Finalising Payroll" />
					{:else}
						<BanknoteArrowUp class="size-6" />
						Finalise Payroll for Filtered Employees {selected?.length}
					{/if}
				</Button>
			</form>
		</DialogComp>
	{/if}
	<div class="mt-4 flex flex-col gap-4">
		<h3 class="my-4">No of Salaries for All Employees: {filteredList?.length}</h3>
		<div class="flex flex-col items-start justify-start">
			<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl"></p>
			<div class="flex flex-row items-start gap-2">
				<label class="sr-only" for="month-select">Month</label>
				<MonthYear bind:value={month} />

				<Button
					onclick={() => goto(`/dashboard/salary/add-payroll/${link}`)}
					aria-label="Go to selected month and year"
					class="flex items-center gap-2"
				>
					Go
					<ArrowRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
		<PayrollTotals {totals} />
		<Filter
			data={data?.payrollData}
			bind:filteredList
			filterKeys={[
				'employmentStatus',
				'site',
				'absent',
				'bank',
				'department',
				'position',
				'overtime',
				'basicSalary',
				'housingAllowance',
				'transportAllowance',
				'positionAllowance'
			]}
		/>

		<Button
			onclick={() => (bankColumn = !bankColumn)}
			aria-label="Toggle bank column visibility"
			class="w-64"
			variant={bankColumn ? 'default' : 'outline'}
		>
			<Icon />
			{bankColumn ? 'Detailed View' : 'Print for Bank View'}
		</Button>

		{#key bankColumn}
			<DataTable
				data={filteredList}
				bind:selected
				columns={column}
				fileName={bankColumn ? 'Bank Accounts' : 'Payroll Summary for ' + month}
			/>
		{/key}
	</div>
{/if}
