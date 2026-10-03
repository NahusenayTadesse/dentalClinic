<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import * as Select from '@nahu/admin-kit/components/ui/select/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import { packageItems, type PackageItems } from './schema';

	/**
	 * The services in one package, and how many of each — six cleanings, one examination. Opened
	 * from a package's row; posted as JSON because it is a list. The standard prices add up beside
	 * the package's own, so the saving is plain before it is offered.
	 */
	let {
		data,
		services,
		open = $bindable(false),
		seed,
		name,
		price
	}: {
		data: SuperValidated<PackageItems>;
		services: { value: number; name: string; price: number | null }[];
		open?: boolean;
		/** The package and its services as they are now, applied each time the dialog opens. */
		seed: PackageItems;
		name: string;
		price: number;
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, enhance, delayed } = createForm(data, packageItems, {
		dataType: 'json',
		resetForm: false,
		onUpdated: ({ form: f }) => {
			if (f.valid && f.message?.type === 'success') open = false;
		}
	});

	$effect(() => {
		if (open) form.set({ id: seed.id, items: seed.items.map((i) => ({ ...i })) }, { taint: false });
	});

	const serviceOf = (id: number) => services.find((s) => s.value === id);
	const listed = $derived(
		$form.items.reduce((sum, i) => sum + (serviceOf(i.serviceId)?.price ?? 0) * i.quantity, 0)
	);

	function add(value: string) {
		const id = Number(value);
		if (!id || $form.items.some((i) => i.serviceId === id)) return;
		$form.items = [...$form.items, { serviceId: id, quantity: 1 }];
	}
	const setQuantity = (index: number, raw: string) =>
		($form.items = $form.items.map((i, n) =>
			n === index ? { ...i, quantity: Math.max(1, Math.min(100, Math.round(Number(raw) || 1))) } : i
		));
	const remove = (index: number) => ($form.items = $form.items.filter((_, n) => n !== index));
</script>

<DialogComp title="Services in {name}" variant="ghost" bind:open>
	{#snippet trigger()}{/snippet}
	<form method="post" action="?/items" use:enhance class="flex flex-col gap-3 p-4">
		<Select.Root type="single" value="" onValueChange={add}>
			<Select.Trigger class="w-full" aria-label="Add a service">
				<span class="flex items-center gap-2"><Plus class="size-4" /> Add a service</span>
			</Select.Trigger>
			<Select.Content>
				{#each services.filter((s) => !$form.items.some((i) => i.serviceId === s.value)) as s (s.value)}
					<Select.Item value={String(s.value)}>
						{s.name}{s.price === null ? '' : ` · ${formatETB(s.price)}`}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		{#if $form.items.length}
			<ul class="flex flex-col divide-y rounded-md border text-sm">
				{#each $form.items as item, i (item.serviceId)}
					<li class="flex items-center gap-2 px-3 py-2">
						<span class="flex-1">{serviceOf(item.serviceId)?.name ?? 'Service'}</span>
						<Input
							type="number"
							min="1"
							max="100"
							class="h-8 w-20"
							aria-label="How many {serviceOf(item.serviceId)?.name}"
							value={item.quantity}
							oninput={(e) => setQuantity(i, e.currentTarget.value)}
						/>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							aria-label="Remove"
							onclick={() => remove(i)}
						>
							<X class="size-4" />
						</Button>
					</li>
				{/each}
			</ul>
			<p class="text-sm text-muted-foreground">
				At standard prices {formatETB(listed)}; the package is {formatETB(price)}.
			</p>
		{:else}
			<p class="text-sm text-muted-foreground">
				No services yet. A package with none is not offered.
			</p>
		{/if}

		<Button type="submit" class="self-end" disabled={$delayed}>
			{#if $delayed}<LoadingBtn name="Saving" />{:else}Save{/if}
		</Button>
	</form>
</DialogComp>
