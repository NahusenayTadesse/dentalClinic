<script lang="ts">
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { add } from './schema';

	/** The VAT and withholding rates: one row, shown as two figures and changed in one dialog. */
	let { data } = $props();

	const RATES = $derived([
		{ label: 'VAT', hint: 'Value added tax applied to sales', value: data.allData?.vat },
		{ label: 'Withholding', hint: 'Tax withheld at source', value: data.allData?.withHold }
	]);
</script>

<svelte:head>
	<title>VAT and Withholding</title>
</svelte:head>

<section class="mx-auto mt-10 flex max-w-md flex-col gap-4 rounded-lg border bg-card p-6">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-semibold">Tax rates</h1>
			<p class="text-sm text-muted-foreground">
				In force as of {formatEthiopianDate(new Date())}
			</p>
		</div>
		<FormDialog
			title="Change VAT or withholding"
			action="?/add"
			data={data.form}
			schema={add}
			triggerLabel="Change"
		>
			{#snippet fields({ form, errors })}
				<InputComp {form} {errors} label="VAT (%)" type="number" name="vat" required />
				<InputComp {form} {errors} label="Withholding (%)" type="number" name="withHold" required />
			{/snippet}
		</FormDialog>
	</header>

	<dl class="flex flex-col divide-y">
		{#each RATES as rate (rate.label)}
			<div class="flex items-center justify-between py-4">
				<div>
					<dt class="text-sm font-medium">{rate.label}</dt>
					<dd class="text-xs text-muted-foreground">{rate.hint}</dd>
				</div>
				<dd class="text-2xl font-bold tabular-nums">{rate.value ?? '—'}%</dd>
			</div>
		{/each}
	</dl>

	<p class="text-xs text-muted-foreground">
		Changing a rate does not rewrite records already made with the old one.
	</p>
</section>
