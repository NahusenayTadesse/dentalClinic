<script lang="ts">
	/**
	 * Approving sets the granted quantity per line — an approver may grant less
	 * than was asked for, which is why this is a per-item form and not a button.
	 *
	 * The cap shown against each row is what the store can still commit:
	 * on-hand minus everything already promised to other approved leases.
	 */
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { BadgeCheck, TriangleAlert } from '@lucide/svelte';

	let { data, items = [] }: { data: any; items: any[] } = $props();

	let isOpen = $state(false);

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		dataType: 'json',
		onUpdated({ form: result }) {
			if (result.message?.type === 'success') isOpen = false;
		}
	});

	// Default every line to the full requested amount, capped at what is free.
	$effect(() => {
		if (isOpen && !$form.items?.length) {
			$form.items = items.map((item) => ({
				itemId: item.id,
				quantity: Math.min(item.quantityRequested, item.available)
			}));
		}
	});

	const itemById = $derived(new Map(items.map((item) => [item.id, item])));

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

<DialogComp
	title="Approve Lease"
	description="Set how much of each item is granted."
	variant="default"
	IconComp={BadgeCheck}
	bind:open={isOpen}
>
	<form method="post" action="?/approve" use:enhance class="flex w-full flex-col gap-3 pt-2">
		<Errors allErrors={$allErrors} />

		{#each $form.items ?? [] as line, index (line.itemId)}
			{@const item = itemById.get(line.itemId)}
			<div class="flex flex-col gap-2 rounded-md border p-3">
				<Label class="text-base">{item?.name}</Label>
				<p class="text-xs text-muted-foreground">
					Requested {item?.quantityRequested}
					{item?.unitOfMeasure ?? ''} · {item?.available} free to claim of {item?.storeOnHand} in store
					· {item?.returnable ? 'expected back' : 'consumed on site'}
				</p>
				<Input
					type="number"
					min="0"
					max={item?.available}
					bind:value={$form.items[index].quantity}
				/>
				{#if item && line.quantity > item.available}
					<p class="flex items-center gap-2 text-red-500">
						<TriangleAlert class="size-4" /> Only {item.available} can be committed right now.
					</p>
				{/if}
				{#if lineError(index, 'quantity')}
					<p class="text-red-500">{lineError(index, 'quantity')}</p>
				{/if}
			</div>
		{/each}

		<InputComp
			label="Approval Note"
			name="note"
			type="textarea"
			rows={2}
			placeholder="Optional note kept on the audit trail"
			{form}
			{errors}
		/>

		<Button type="submit" size="lg">
			{#if $delayed}
				<LoadingBtn name="Approving" />
			{:else}
				<BadgeCheck /> Approve Lease
			{/if}
		</Button>
	</form>
</DialogComp>
