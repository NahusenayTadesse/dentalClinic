<script lang="ts">
	/**
	 * Taking stock back. Only `good` units go back on the shelf; `damaged` and
	 * `lost` are written off, because those never re-enter the store and total
	 * owned should drop accordingly.
	 */
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { PackageOpen, TriangleAlert } from '@lucide/svelte';

	let { data, items = [] }: { data: any; items: any[] } = $props();

	let isOpen = $state(false);

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		dataType: 'json',
		onUpdated({ form: result }) {
			if (result.message?.type === 'success') isOpen = false;
		}
	});

	/** Consumables are never expected back, so they are not listed. */
	const returnable = $derived(items.filter((item) => item.outstanding > 0));

	$effect(() => {
		if (isOpen && !$form.items?.length) {
			$form.items = returnable.map((item) => ({
				itemId: item.id,
				quantity: item.outstanding,
				condition: 'good'
			}));
		}
	});

	const itemById = $derived(new Map(items.map((item) => [item.id, item])));

	const conditions = [
		{ value: 'good', name: 'Good — back on the shelf' },
		{ value: 'damaged', name: 'Damaged — written off' },
		{ value: 'lost', name: 'Lost — written off' }
	];

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') toast.error($message.text);
			else toast.success($message.text);
		}
	});
</script>

<DialogComp
	title="Record Return"
	description="What came back from the site, and in what state."
	variant="outline"
	IconComp={PackageOpen}
	bind:open={isOpen}
>
	<form method="post" action="?/return" use:enhance class="flex w-full flex-col gap-3 pt-2">
		<Errors allErrors={$allErrors} />

		{#if returnable.length === 0}
			<p class="py-4 text-center text-muted-foreground">Nothing on this lease is still out.</p>
		{/if}

		{#each $form.items ?? [] as line, index (line.itemId)}
			{@const item = itemById.get(line.itemId)}
			<div class="flex flex-col gap-2 rounded-md border p-3">
				<Label class="text-base">{item?.name}</Label>
				<p class="text-xs text-muted-foreground">{item?.outstanding} still out at the site</p>

				<Input
					type="number"
					min="0"
					max={item?.outstanding}
					bind:value={$form.items[index].quantity}
				/>
				{#if item && line.quantity > item.outstanding}
					<p class="flex items-center gap-2 text-red-500">
						<TriangleAlert class="size-4" /> Only {item.outstanding} are still out.
					</p>
				{/if}

				<Label>Condition</Label>
				<SelectComp name="condition" bind:value={$form.items[index].condition} items={conditions} />
				{#if line.condition !== 'good' && line.quantity > 0}
					<p class="text-xs text-muted-foreground">
						These {line.quantity} will be written off — they do not go back into store stock.
					</p>
				{/if}
			</div>
		{/each}

		<InputComp
			label="Note"
			name="reason"
			type="textarea"
			rows={2}
			placeholder="Optional note kept on the audit trail"
			{form}
			{errors}
		/>

		<Button type="submit" size="lg" disabled={returnable.length === 0}>
			{#if $delayed}
				<LoadingBtn name="Recording Return" />
			{:else}
				<PackageOpen /> Record Return
			{/if}
		</Button>
	</form>
</DialogComp>
