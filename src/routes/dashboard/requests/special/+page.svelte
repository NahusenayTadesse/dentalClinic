<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { Save } from '@lucide/svelte';
	import MonthYearMul from '$lib/formComponents/MonthYearMul.svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { add } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { toast } from 'svelte-sonner';
	import Receipt from '../Receipt.svelte';

	let { data } = $props();

	// FilterMenu still filters which invoices are *shown*; requests are driven by $form.items
	let filteredList = $derived(data?.sitesList);
	let thingy = $state('');

	// --- Helpers ---
	const monthYearLabel = (my: string) => my.split('_').join(' ');

	/** "ሰኔ_2018" -> what the shared receipt renders from. */
	const toPeriod = (my: string) => {
		const [month, year] = my.split('_');
		return { month, year: Number(year) };
	};

	const generateUniqueInvoiceNo = (siteId: number) => {
		const prefix = 'INV';
		const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
		return `${prefix}-${siteId}-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;
	};

	const isRequested = (siteId: number, my: string) => {
		const [m, y] = my.split('_');
		return data?.existingRequests?.some(
			(r) => r.siteId === siteId && r.month === m && r.year === Number(y)
		);
	};

	const { form, errors, enhance, message, delayed, allErrors } = superForm(data.form, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		},
		validators: zod4Client(add),
		onChange(event) {
			// Rebuild the per-site items whenever the month selection changes
			if (event.paths.some((p) => p.startsWith('months'))) {
				rebuildItems();
			}
		},
		dataType: 'json'
	});

	function rebuildItems() {
		// keep invoice numbers / penalities stable across re-selections
		const previous = new Map(
			$form.items.map((i) => [i.siteId, { invoiceNumber: i.invoiceNumber, penality: i.penality }])
		);

		const items = [];
		for (const s of data.sitesList) {
			// only the selected months this site hasn't been requested for yet
			const pending = $form.months.filter((my) => !isRequested(s.value, my));
			if (pending.length) {
				items.push({
					siteId: s.value,
					invoiceNumber: previous.get(s.value)?.invoiceNumber ?? generateUniqueInvoiceNo(s.value),
					months: pending,
					penality: previous.get(s.value)?.penality ?? 0
				});
			}
		}
		$form.items = items;

		thingy = $form.months.length
			? `— pending invoices for ${$form.months.map(monthYearLabel).join(', ')}`
			: '';
	}

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	let disabled = $derived(!$form.months.length || !$form.requestor || !$form.items.length);
</script>

<svelte:head>
	<title>Add Requests</title>
</svelte:head>

<div class="min-h-screen p-4 lg:p-8">
	<!-- Control Panel -->
	<header
		class="mx-auto mb-8 max-w-305! rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-wrap items-center justify-between gap-6">
			<div>
				<h1 class="text-2xl font-black tracking-tight">Invoice Generator</h1>
				<p class="text-sm text-zinc-500">Generate and batch export site invoices.</p>
				<p class="text-sm text-zinc-500">
					Prepared Invoices: {$form.items?.length ?? 0}
					{thingy}
				</p>
			</div>
			<form use:enhance method="post" action="?/request" id="request" enctype="multipart/form-data">
				<Errors allErrors={$allErrors} />
				{#if $message}
					<p class="text-sm text-zinc-500">{@html $message.text}</p>
				{/if}

				<InputComp {form} {errors} type="date" label="Request Date" name="requestDate" />

				<div>
					<!-- Multi-select: binds to an array of "Month_Year" strings -->
					<MonthYearMul bind:value={$form.months} />
				</div>

				<InputComp
					type="combo"
					label="Requestor"
					name="requestor"
					{form}
					{errors}
					items={data?.employees}
				/>

				<!-- vat, withhold, months and items travel via dataType: 'json'; no hidden inputs needed -->

				<Button
					type="submit"
					{disabled}
					title={disabled ? 'Form is invalid' : 'Save Request'}
					class="w-full"
					form="request"
					variant="default"
				>
					{#if $delayed}
						<LoadingBtn name="Saving Changes" />
					{:else}
						<Save class="h-4 w-4" />
						Save Request
					{/if}
				</Button>
			</form>
		</div>
	</header>

	<FilterMenu bind:filteredList data={data?.sitesList} filterKeys={['name']} class="w-full!" />

	<!-- Invoices Preview: one invoice per site covering all its pending months -->
	<div class="mt-4 flex flex-col items-center gap-16 pb-20">
		{#each $form.items as item (item.siteId)}
			{@const site = data.sitesList.find((s) => s.value === item.siteId)}
			{#if site && filteredList?.some((s) => s.value === item.siteId)}
				<!-- <div class="grid w-lg gap-1.5">
					<Label class="text-[10px] font-bold uppercase">Penality</Label>
					<Input type="number" bind:value={$form.items[i].penality} />
				</div> -->
				<Receipt
					invoiceNumber={item.invoiceNumber}
					siteId={item.siteId}
					siteName={site.name}
					customerName={site.customerName}
					requestDate={$form.requestDate}
					months={item.months.map(toPeriod)}
					contracts={data.contracts}
					vat={data.vats.vat}
					withhold={data.vats.withHold}
					employees={data?.employees}
					requestedBy={$form.requestor}
					exportName={site.name.replace(/\s+/g, '-')}
				/>
			{/if}
		{/each}
	</div>
</div>
