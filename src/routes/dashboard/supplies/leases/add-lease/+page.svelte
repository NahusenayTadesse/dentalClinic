<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { Plus, Trash2, PackagePlus, CircleAlert } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms/client';
	import { leaseRequestSchema } from './schema';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { toast } from 'svelte-sonner';
	import { fly } from 'svelte/transition';

	let { data } = $props();

	const { form, errors, enhance, delayed, capture, restore, message, allErrors } = superForm(
		data.form,
		{
			// Item lines are nested, so the form posts JSON rather than flat fields.
			dataType: 'json',
			validators: zod4Client(leaseRequestSchema),
			taintedMessage: () =>
				new Promise((resolve) =>
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'))
				)
		}
	);

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') toast.error($message.text);
			else toast.success($message.text);
		}
	});

	export const snapshot: Snapshot = { capture, restore };

	// Start with one blank line so the form is usable straight away.
	if (!$form.items?.length) {
		$form.items = [{ supplyId: 0, quantity: 1, notes: '' }];
	}

	const supplyOptions = $derived(
		(data.itemList ?? []).map((item) => ({
			value: item.value,
			name: `${item.name} — ${item.available} available${item.returnable ? ' (returnable)' : ''}`
		}))
	);

	const supplyById = $derived(new Map((data.itemList ?? []).map((item) => [item.value, item])));

	/** A returnable line anywhere means the lease can carry a due-back date. */
	const anyReturnable = $derived(
		($form.items ?? []).some((line) => supplyById.get(Number(line.supplyId))?.returnable)
	);

	function addLine() {
		$form.items = [...$form.items, { supplyId: 0, quantity: 1, notes: '' }];
	}

	function removeLine(index: number) {
		$form.items = $form.items.filter((_, i) => i !== index);
	}

	/** Supplies already on another line, so the same item cannot be picked twice. */
	function optionsFor(index: number) {
		const taken = new Set(
			$form.items
				.map((line, i) => (i === index ? null : Number(line.supplyId)))
				.filter((id): id is number => Boolean(id))
		);
		return supplyOptions.filter((option) => !taken.has(Number(option.value)));
	}

	/**
	 * Superforms types errors on a nested array loosely, so reading one field of
	 * one line needs narrowing. Returns the first message, or undefined.
	 */
	function lineError(index: number, field: string): string | undefined {
		const line = ($errors.items as any)?.[index];
		const value = line?.[field];
		return Array.isArray(value) ? value[0] : value;
	}
</script>

<svelte:head>
	<title>Request a Supply Lease</title>
</svelte:head>

<FormCard title="Lease Supplies to a Site">
	<form use:enhance action="?/add" id="main" class="flex flex-col gap-4" method="POST">
		<Errors allErrors={$allErrors} />

		<InputComp
			label="Site"
			name="siteId"
			type="combo"
			required
			placeholder="Which site is this for?"
			{errors}
			{form}
			items={data?.siteList}
		/>

		<InputComp
			label="Reason"
			name="reason"
			type="textarea"
			required
			rows={3}
			placeholder="Why does the site need these supplies?"
			{errors}
			{form}
		/>

		<InputComp
			label="Reference Number"
			name="referenceNumber"
			type="text"
			placeholder="Gate pass or request number (optional)"
			{errors}
			{form}
		/>

		<div class="mt-2 flex flex-col gap-3">
			<div class="flex flex-row items-center justify-between">
				<Label class="text-base">Items</Label>
				<Button type="button" variant="outline" size="sm" onclick={addLine}>
					<Plus class="size-4" /> Add Item
				</Button>
			</div>

			{#if $errors.items?._errors}
				{#each $errors.items._errors as error}
					<p class="flex items-center gap-2 text-red-500"><CircleAlert class="size-4" /> {error}</p>
				{/each}
			{/if}

			{#each $form.items as line, index (index)}
				{@const supply = supplyById.get(Number(line.supplyId))}
				<div
					transition:fly={{ y: -8, duration: 200 }}
					class="flex flex-col gap-3 rounded-md border p-3"
				>
					<div class="flex flex-row items-end gap-2">
						<div class="flex w-full flex-col gap-2">
							<Label>Supply Item</Label>
							<SelectComp
								name="supplyId"
								bind:value={$form.items[index].supplyId}
								items={optionsFor(index)}
							/>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							title="Remove this item"
							aria-label="Remove item {index + 1}"
							disabled={$form.items.length === 1}
							onclick={() => removeLine(index)}
						>
							<Trash2 class="size-4 text-destructive" />
						</Button>
					</div>
					{#if lineError(index, 'supplyId')}
						<p class="text-red-500">{lineError(index, 'supplyId')}</p>
					{/if}

					<div class="flex flex-col gap-2">
						<Label>Quantity</Label>
						<Input
							type="number"
							min="1"
							max={supply?.available ?? undefined}
							bind:value={$form.items[index].quantity}
							placeholder="How many?"
						/>
						{#if supply}
							<p class="text-xs text-muted-foreground">
								{supply.available} of {supply.onHand} in store can be claimed
								{#if supply.reserved > 0}· {supply.reserved} already promised{/if}
								{#if supply.leasedOut > 0}· {supply.leasedOut} out at sites{/if}
								· {supply.returnable ? 'expected back' : 'consumed on site'}
							</p>
						{/if}
						{#if lineError(index, 'quantity')}
							<p class="text-red-500">{lineError(index, 'quantity')}</p>
						{/if}
					</div>

					<div class="flex flex-col gap-2">
						<Label>Note</Label>
						<Input
							bind:value={$form.items[index].notes}
							placeholder="Optional note for this item"
						/>
					</div>
				</div>
			{/each}
		</div>

		{#if anyReturnable}
			<div transition:fly={{ x: -20, duration: 300 }}>
				<InputComp
					label="Expected Return Date"
					name="expectedReturnDate"
					type="date"
					futureDays={true}
					oldDays={false}
					placeholder="When should the returnable items come back?"
					{errors}
					{form}
				/>
			</div>
		{/if}

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn name="Submitting Request" />
			{:else}
				<PackagePlus class="size-4" />
				Submit Lease Request
			{/if}
		</Button>
	</form>
</FormCard>
