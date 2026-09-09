<script lang="ts">
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { type Reinstate } from './schema';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { RotateCcw } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { type Item } from '$lib/global.svelte';

	let {
		data,
		employee,
		statusList
	}: { data: SuperValidated<Infer<Reinstate>>; employee: string; statusList: Item[] } = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {});
	import { toast } from 'svelte-sonner';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
</script>

<DialogComp
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
