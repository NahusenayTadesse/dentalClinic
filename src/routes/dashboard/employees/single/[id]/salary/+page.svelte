<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { addLeavePayrollSchema as schema } from './schema';
	import { fileProxy, superForm } from 'sveltekit-superforms/client';
	import DatePicker2 from '$lib/formComponents/DatePicker2.svelte';
	import ComboboxComp from '$lib/formComponents/ComboboxComp.svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import FileUpload from '$lib/formComponents/FileUpload.svelte';
	import { type DateValue } from '@internationalized/date';
	import { CalendarIcon } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';

	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';

	let { data } = $props();

	import { updateFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';

	const { form, errors, enhance, delayed, allErrors, capture, restore, message } = superForm(
		data.form,
		{
			validators: zod4Client(schema),

			onResult() {
				updateFlash(page);
			},

			onError() {
				updateFlash(page);
			}
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	$form.baseSalary = data.salaryDetail?.baseSalary;
	$form.commissions = data.salaryDetail?.commissions || 0;
	$form.overtime = data.salaryDetail?.overtime || 0;
	$form.deductions = data.salaryDetail?.deductions || 0;
	$form.bonus = data.salaryDetail?.bonus || 0;

	$form.paymentDate = new Date().toISOString().split('T')[0];
	$form.payPeriodStart = new Date().toISOString().split('T')[0];
	$form.payPeriodEnd = new Date().toISOString().split('T')[0];

	const file = fileProxy(form, 'reciept');

	// 1. reactive total
	const netAmount = $derived(
		Number($form.baseSalary ?? 0) +
			Number($form.commissions ?? 0) +
			Number($form.bonus ?? 0) +
			Number($form.overtime ?? 0) -
			Number($form.deductions ?? 0)
	);

	// 2. reactive “after-tax” amount
	const paidAmount = $derived(netAmount - Number($form.taxAmount ?? 0));

	// 3. (optional) copy the values back into the form object
	$effect(() => {
		$form.netAmount = netAmount.toString();
		$form.paidAmount = paidAmount.toString();
	});

	const now = new Date();
	$form.monthYear = `${new Intl.DateTimeFormat(undefined, { month: 'long' }).format(now)}_${now.getFullYear()}`;

	$form.taxAmount = 0;

	import { getLocalTimeZone, today } from '@internationalized/date';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';
	import Errors from '$lib/formComponents/Errors.svelte';

	const start = today(getLocalTimeZone());
	const end = start.add({ days: 30 });

	let value = $state({
		start,
		end
	});

	$effect(() => {
		(($form.payPeriodStart = value.start.toString()), ($form.payPeriodEnd = value.end.toString()));
	});

	function formatDate(input: DateValue | string | null | undefined) {
		if (!input || String(input).includes('Pick')) return 'Pick a date';
	}

	let contentRef = $state<HTMLElement | null>(null);
	let open = $state(false);

	import { toast } from 'svelte-sonner';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
</script>

<svelte:head>
	<title>Add New Salary</title>
</svelte:head>

{#snippet fe(
	label = '',
	name = '',
	type = '',
	placeholder = '',
	required = false,
	min = '',
	max = ''
)}
	<div class="flex w-full flex-col justify-start gap-2">
		{#if type !== 'hidden'}
			<Label for={name}>{label}</Label>
		{/if}
		<Input
			{type}
			{name}
			{placeholder}
			{required}
			{min}
			{max}
			bind:value={$form[name]}
			aria-invalid={$errors[name] ? 'true' : undefined}
		/>
		{#if $errors[name]}
			<span class="text-red-500">{$errors[name]}</span>
		{/if}
	</div>
{/snippet}

{#snippet months(label = '', name = '')}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name}>{label}</Label>

		<MonthYear bind:value={$form[name]} />

		<Input
			type="hidden"
			{name}
			bind:value={$form[name]}
			aria-invalid={$errors[name] ? 'true' : undefined}
		/>
		{#if $errors[name]}
			<span class="text-red-500">{$errors[name]}</span>
		{/if}
	</div>
{/snippet}

{#snippet date(name, title)}
	<Label for={name} class="capitalize">{title}</Label>

	<DatePicker2 bind:data={$form[name]} oldDays={true} />
	<input type="hidden" {name} bind:value={$form[name]} />
	{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
{/snippet}

{#snippet combo(name, items)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name} class="capitalize">{name.replace(/([a-z])([A-Z])/g, '$1 $2')}:</Label>

		<ComboboxComp {name} bind:value={$form[name]} {items} />
		{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
	</div>
{/snippet}

{#snippet totals(data = '', name = 'Tips')}
	<div
		class="mt-4 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<h5 class="text-sm text-gray-600 dark:text-gray-300">{name}</h5>
		<div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
			{name.includes('Deductions') ? '-' : ''}
			{new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: 'ETB',
				maximumFractionDigits: 2
			}).format(Number(data ?? 0))}
		</div>
	</div>
{/snippet}
<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add A New Salary for {data.salaryDetail?.name}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form
			use:enhance
			action="?/addSalary"
			id="main"
			class="flex flex-col gap-4"
			method="POST"
			enctype="multipart/form-data"
		>
			<Errors allErrors={$allErrors} />

			<div class="flex flex-col gap-0">
				{@render totals($form.baseSalary, 'Salary Amount')}
				{@render fe('Salary', 'baseSalary', 'hidden', 'Enter tax Amount', true)}

				{@render totals($form.commissions, 'Commissions Total')}
				{@render fe('Commissions Total', 'commissions', 'hidden', 'Enter tax Amount', true)}

				{@render totals($form.bonus, 'Bonuses Total')}
				{@render fe('Commissions Total', 'bonus', 'hidden', 'Enter tax Amount', true)}

				{@render totals($form.overtime, 'OverTime Total')}
				{@render fe('Commissions Total', 'overtime', 'hidden', 'Enter tax Amount', true)}

				{@render totals($form.deductions, 'Deductions Total')}
				{@render fe('Commissions Total', 'deductions', 'hidden', 'Enter tax Amount', true)}

				{@render totals($form.netAmount, 'Net Amount')}
				{@render fe('Commissions Total', 'netAmount', 'hidden', 'Enter tax Amount', true)}
			</div>

			{@render months('Payment Month', 'monthYear')}

			{@render fe('Tax Amount', 'taxAmount', 'number', 'Enter tax Amount', true)}

			{@render fe('Paid Amount', 'paidAmount', 'number', 'Enter paid Amount', true)}

			<Label>Payment Start Date - Payment End Date</Label>

			<Popover.Root bind:open>
				<Popover.Trigger
					class={cn(
						buttonVariants({
							variant: 'outline',
							class: 'w-full justify-start text-start font-normal'
						}),
						!value && 'text-muted-foreground'
					)}
				>
					<CalendarIcon />
					{#if value && value.start && value.end}
						<span>{String(value.start)} - {String(value.end)}</span>
					{:else if value && value.start}
						<span>{String(value.start)} - Pick an end date</span>
					{:else if value && value.end}
						<span>Pick a start date - {String(value.end)}</span>
					{:else}
						<span>Pick a date</span>
					{/if}
				</Popover.Trigger>
				<Popover.Content bind:ref={contentRef} class="w-full p-0">
					<RangeCalendar
						bind:value
						class="relative w-auto rounded-lg border pb-16 shadow-sm"
						numberOfMonths={2}
					/>
				</Popover.Content>
			</Popover.Root>
			{@render fe('Pay Period Start', 'payPeriodStart', 'hidden', 'Enter tax Amount', true)}
			{@render fe('Pay Period End', 'payPeriodEnd', 'hidden', 'Enter tax Amount', true)}

			{@render date('paymentDate', 'Date of Staff Member Payment')}
			{@render combo('paymentMethod', data.allMethods)}

			<div class="flex w-full flex-col justify-start gap-2">
				<Label for="notes">Additional Notes (optional)</Label>

				<Textarea
					name="notes"
					placeholder="Enter product description"
					bind:value={$form.notes}
					aria-invalid={$errors.notes ? 'true' : undefined}
				/>

				{#if $errors.notes}<span class="text-red-500">{$errors.notes}</span>{/if}
			</div>

			<!-- <div class="flex w-full flex-col justify-start gap-2">
				<Label for="image" class="capitalize">Upload Reciept or Screenshot of Salary Payment</Label>
				<div class="relative flex flex-row gap-2">
					<Upload class="absolute top-2 right-16 bottom-0.5 h-6 w-6" />
					<Input
						type="file"
						name="reciept"
						accept="image/*,application/pdf"
						bind:files={$file}
						multiple={false}
					/>
					<Button
						type="button"
						size="icon"
						variant="outline"
						title="Clear file input"
						onclick={() => ($file = 0)}
					>
						<X />
					</Button>
				</div>
				{#if $errors.reciept}
					<span class="text-red-500">{$errors.reciept}</span>
				{/if}
			</div> -->
			<FileUpload name="reciept" {form} {errors} />
			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Confirming Salary" />
				{:else}
					<Plus class="h-4 w-4" />

					Confirm Salary
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
