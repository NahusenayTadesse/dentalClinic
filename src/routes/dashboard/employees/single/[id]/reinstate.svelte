<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { reinstate, type Reinstate } from './schema';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { RotateCcw } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { type Item } from '$lib/global.svelte';

	let {
		data,
		employee,
		statusList
	}: { data: SuperValidated<Reinstate>; employee: string; statusList: Item[] } = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, reinstate, {
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});
</script>

<DialogComp
	bind:open
	title="Reinstate {employee}"
	variant="default"
	class="flex w-full flex-col items-center justify-center"
	IconComp={RotateCcw}
>
	<form
		id="main"
		action="?/reinstate"
		class="flex w-full flex-col items-center justify-center gap-2 space-y-4"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<p class="text-center">
			Reinstate employee, this will reinclude the employee in lists, salary calculations.
		</p>
		<InputComp
			label="New Status"
			name="newStatus"
			type="select"
			{form}
			{errors}
			required
			items={statusList}
		/>

		<Errors allErrors={$allErrors} />
		<Button type="submit" class="w-full" form="main" variant="default">
			{#if $delayed}
				<LoadingBtn name="Reinstating Employee" />
			{:else}
				<RotateCcw class="h-4 w-4" />
				Reinstate Employee
			{/if}
		</Button>
	</form>
</DialogComp>
