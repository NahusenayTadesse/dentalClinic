<script lang="ts">
	/**
	 * Handing the goods over. This is the step that actually moves stock: each
	 * line writes a negative adjustment and drops `supplies.quantity`, so the
	 * quantities here are capped by both what was approved and what is on the
	 * shelf right now.
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
	import { PackageCheck, TriangleAlert } from '@lucide/svelte';

	let { data, items = [] }: { data: any; items: any[] } = $props();

	let isOpen = $state(false);

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		dataType: 'json',
		onUpdated({ form: result }) {
			if (result.message?.type === 'success') isOpen = false;
		}
	});

	/** Only lines with something still to hand over are worth showing. */
	const issuable = $derived(items.filter((item) => item.awaitingIssue > 0));

	const cap = (item: any) => Math.min(item.awaitingIssue, item.storeOnHand);

	$effect(() => {
		if (isOpen && !$form.items?.length) {
			$form.items = issuable.map((item) => ({ itemId: item.id, quantity: cap(item) }));
		}
	});

	const itemById = $derived(new Map(items.map((item) => [item.id, item])));

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') toast.error($message.text);
			else toast.success($message.text);
		}
	});

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
	title="Issue to Site"
	description="Record what physically left the store."
	variant="default"
	IconComp={PackageCheck}
	bind:open={isOpen}
>
	<form method="post" action="?/issue" use:enhance class="flex w-full flex-col gap-3 pt-2">
		<Errors allErrors={$allErrors} />

		{#each $form.items ?? [] as line, index (line.itemId)}
			{@const item = itemById.get(line.itemId)}
			<div class="flex flex-col gap-2 rounded-md border p-3">
				<Label class="text-base">{item?.name}</Label>
				<p class="text-xs text-muted-foreground">
					{item?.awaitingIssue} approved and not yet issued · {item?.storeOnHand} in store
					{#if item?.returnable}· expected back{:else}· consumed on site{/if}
				</p>
				<Input
					type="number"
					min="0"
					max={item ? cap(item) : undefined}
					bind:value={$form.items[index].quantity}
				/>
				{#if item && line.quantity > item.storeOnHand}
					<p class="flex items-center gap-2 text-red-500">
						<TriangleAlert class="size-4" /> Only {item.storeOnHand} are in the store.
					</p>
				{/if}
				{#if lineError(index, 'quantity')}
					<p class="text-red-500">{lineError(index, 'quantity')}</p>
				{/if}
			</div>
		{/each}

		<InputComp
			label="Received By"
			name="receivedByName"
			type="text"
			required
			placeholder="Who signed for it at the site"
			{form}
			{errors}
		/>

		<InputComp
			label="Their Phone"
			name="receivedByPhone"
			type="text"
			placeholder="Optional contact number"
			{form}
			{errors}
		/>

		<InputComp
			label="Note"
			name="note"
			type="textarea"
			rows={2}
			placeholder="Optional note kept on the audit trail"
			{form}
			{errors}
		/>

		<Button type="submit" size="lg">
			{#if $delayed}
				<LoadingBtn name="Issuing" />
			{:else}
				<PackageCheck /> Issue to Site
			{/if}
		</Button>
	</form>
</DialogComp>
