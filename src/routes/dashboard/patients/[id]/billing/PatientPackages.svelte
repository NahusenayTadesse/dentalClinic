<script lang="ts">
	import Package from '@lucide/svelte/icons/package';
	import Plus from '@lucide/svelte/icons/plus';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { sellPackageForm, type SellPackage } from './schema';

	/**
	 * The patient's prepaid packages — what each covers and how much of it is left — and selling
	 * another. Work a package covers is billed at nothing when a bill is raised from it
	 * (`packageCover.ts`), so this is where the desk sees why a line came to nothing.
	 */
	let {
		packages,
		offered,
		form
	}: {
		packages: {
			id: number;
			name: string;
			soldOn: string;
			expiresOn: string | null;
			expired: boolean;
			items: { service: string; total: number; used: number; left: number }[];
		}[];
		offered: { id: number; name: string; price: number }[];
		form: SuperValidated<SellPackage>;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.tab);
	let open = $state(false);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const items = $derived(
		offered.map((p) => ({ value: String(p.id), name: `${p.name} · ${formatETB(p.price)}` }))
	);
</script>

{#if packages.length || offered.length}
	<Section title={w.packages} IconComp={Package} style="identityIcon">
		{#snippet editDialog()}
			{#if offered.length}
				<Button size="sm" variant="outline" class="ml-auto" onclick={() => (open = true)}>
					<Plus class="size-4" />
					{w.sellPackage}
				</Button>
			{/if}
		{/snippet}
		{#if packages.length}
			<ul class="flex flex-col gap-3 text-sm">
				{#each packages as p (p.id)}
					<li class="rounded-md border p-3">
						<div class="mb-1 flex flex-wrap items-center gap-2">
							<span class="font-medium">{p.name}</span>
							<span class="text-muted-foreground">
								{day(p.soldOn)} · {p.expiresOn
									? w.packageExpires(day(p.expiresOn))
									: w.packageNoExpiry}
							</span>
							{#if p.expired}<Badge variant="outline">{w.packageExpired}</Badge>{/if}
						</div>
						<ul class="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
							{#each p.items as item (item.service)}
								<li>
									{item.service}:
									<span class="text-foreground">{w.packageLeft(item.left, item.total)}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">{w.sellDescription}</p>
		{/if}
	</Section>
{/if}

<FormDialog
	title={w.sellPackage}
	description={w.sellDescription}
	action="?/sellPackage"
	data={form}
	schema={sellPackageForm}
	bind:open
	hideTrigger
	submitLabel={w.sellPackage}
>
	{#snippet fields({ form: f, errors })}
		<InputComp label={w.packageField} name="packageId" type="select" {items} form={f} {errors} />
	{/snippet}
</FormDialog>
