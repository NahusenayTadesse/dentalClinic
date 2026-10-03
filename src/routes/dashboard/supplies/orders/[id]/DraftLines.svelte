<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Save from '@lucide/svelte/icons/save';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import X from '@lucide/svelte/icons/x';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import * as Select from '@nahu/admin-kit/components/ui/select/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import { draftLines, type DraftLines } from '../schema';

	/**
	 * A draft order's lines: what, how many, at what price. Items running low are marked in the
	 * picker, and one button adds all of them at the quantity that brings each back to twice its
	 * reorder level (`suggestedQuantity`). Posted as JSON and saved together.
	 */
	let {
		data,
		items
	}: {
		data: SuperValidated<DraftLines>;
		items: {
			id: number;
			name: string;
			unit: string | null;
			onHand: number;
			low: boolean;
			suggested: number;
		}[];
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, draftLines, {
		dataType: 'json',
		resetForm: false
	});

	const item = (id: number) => items.find((i) => i.id === id);
	const onOrder = $derived(new Set($form.lines.map((l) => l.supplyId)));
	const total = $derived($form.lines.reduce((sum, l) => sum + l.quantity * (l.unitCost ?? 0), 0));

	function add(id: number, quantity?: number) {
		const it = item(id);
		if (!it || onOrder.has(id)) return;
		$form.lines = [
			...$form.lines,
			{ supplyId: id, quantity: quantity ?? it.suggested, unitCost: null }
		];
	}

	function addLow() {
		for (const it of items.filter((i) => i.low)) add(it.id, it.suggested);
	}

	function set(index: number, field: 'quantity' | 'unitCost', raw: string) {
		const n = raw.trim() === '' ? null : Number(raw);
		$form.lines = $form.lines.map((l, i) =>
			i === index
				? field === 'quantity'
					? { ...l, quantity: n ?? 0 }
					: { ...l, unitCost: n !== null && Number.isFinite(n) ? n : null }
				: l
		);
	}

	const remove = (index: number) => ($form.lines = $form.lines.filter((_, i) => i !== index));
</script>

<form method="post" action="?/save" use:enhance class="flex flex-col gap-4">
	<Errors allErrors={$allErrors} />
	<div class="flex flex-wrap items-center gap-2">
		<Select.Root type="single" value="" onValueChange={(v) => add(Number(v))}>
			<Select.Trigger class="w-72" aria-label="Add an item">
				<span class="flex items-center gap-2"><Plus class="size-4" /> Add an item</span>
			</Select.Trigger>
			<Select.Content>
				{#each items.filter((i) => !onOrder.has(i.id)) as it (it.id)}
					<Select.Item value={String(it.id)}>
						{it.name} · {it.onHand} on hand{it.low ? ' · low' : ''}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<Button
			type="button"
			variant="outline"
			onclick={addLow}
			disabled={!items.some((i) => i.low && !onOrder.has(i.id))}
		>
			<TrendingDown class="size-4" /> Add everything running low
		</Button>
	</div>

	{#if $form.lines.length}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b text-left text-xs text-muted-foreground">
						<th class="py-2 pr-3 font-normal">Item</th>
						<th class="pr-3 font-normal">On hand</th>
						<th class="w-28 pr-3 font-normal">Quantity</th>
						<th class="w-32 pr-3 font-normal">Unit price (Br)</th>
						<th class="pr-3 text-right font-normal">Line</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each $form.lines as line, i (line.supplyId)}
						{@const it = item(line.supplyId)}
						<tr class="border-b">
							<td class="py-2 pr-3">{it?.name ?? 'Item'}{it?.unit ? ` (${it.unit})` : ''}</td>
							<td class="pr-3 tabular-nums">{it?.onHand ?? '—'}</td>
							<td class="pr-3">
								<Input
									type="number"
									min="0"
									step="any"
									class="h-8"
									aria-label="Quantity of {it?.name}"
									value={line.quantity}
									oninput={(e) => set(i, 'quantity', e.currentTarget.value)}
								/>
							</td>
							<td class="pr-3">
								<Input
									type="number"
									min="0"
									step="any"
									class="h-8"
									placeholder="Unknown"
									aria-label="Unit price of {it?.name}"
									value={line.unitCost ?? ''}
									oninput={(e) => set(i, 'unitCost', e.currentTarget.value)}
								/>
							</td>
							<td class="pr-3 text-right tabular-nums">
								{line.unitCost === null ? '—' : formatETB(line.quantity * line.unitCost)}
							</td>
							<td>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									aria-label="Remove {it?.name}"
									onclick={() => remove(i)}
								>
									<X class="size-4" />
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td colspan="4" class="py-2 pr-3 text-right text-muted-foreground">Order value</td>
						<td class="pr-3 text-right font-semibold tabular-nums">{formatETB(total)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">Nothing on the order yet.</p>
	{/if}

	<div class="grid gap-3 sm:grid-cols-2">
		<InputComp
			label="Expected by"
			name="expectedOn"
			type="date"
			allowEmpty
			required={false}
			{form}
			{errors}
		/>
		<InputComp label="Note to the supplier" name="note" required={false} {form} {errors} />
	</div>
	<Button type="submit" class="self-end" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save the draft{/if}
	</Button>
</form>
