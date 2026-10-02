<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { accountCodes, type AccountCodes } from './schema';

	/**
	 * The account codes, as one table to fill in from the accountant's chart of accounts: grouped by
	 * what they are for, and saved together. Posted as JSON — a list of codes is not a set of fields.
	 */
	let {
		data,
		targets
	}: {
		data: SuperValidated<AccountCodes>;
		targets: { target: string; label: string; group: string }[];
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, enhance, delayed } = createForm(data, accountCodes, {
		dataType: 'json',
		resetForm: false
	});

	const groups = $derived([...new Set(targets.map((t) => t.group))]);
	const index = (target: string) => $form.codes.findIndex((c) => c.target === target);
</script>

<form method="post" action="?/accounts" use:enhance class="flex flex-col gap-4">
	{#each groups as group (group)}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-1 text-sm font-semibold">{group}</legend>
			{#each targets.filter((t) => t.group === group) as t (t.target)}
				{@const i = index(t.target)}
				<label class="grid grid-cols-[1fr_10rem] items-center gap-3 text-sm">
					<span>{t.label}</span>
					{#if i >= 0}
						<Input
							bind:value={$form.codes[i].code}
							placeholder="Code"
							aria-label="Account code for {t.label}"
							class="h-8 font-mono"
						/>
					{/if}
				</label>
			{/each}
		</fieldset>
	{/each}
	<Button type="submit" class="self-end" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save the codes{/if}
	</Button>
</form>
