<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import type { AddPen as Add } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		contracts
	}: {
		data: SuperValidated<Infer<Add>>;
		contracts: Item[];
	} = $props();
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
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

<DialogComp title="Add Penality" IconComp={Plus} variant="destructive">
	<form
		action="?/penality"
		use:enhance
		method="post"
		id="pen"
		class="flex w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />
		<InputComp {form} {errors} label="" name="staffId" type="hidden" />
		<InputComp
			label="Contract"
			name="contract"
			type="combo"
			{form}
			{errors}
			required
			items={contracts}
		/>

		<div>
			<InputComp type="hidden" label="Month" name="month" {form} {errors} required />
			<MonthYear bind:value={$form.month} />
		</div>
		<InputComp {form} {errors} name="peanlityDate" type="date" label="Penality Date" required />

		<InputComp
			{form}
			{errors}
			name="penalityAmount"
			type="number"
			label="Penality Amount"
			required
		/>

		<InputComp
			{form}
			{errors}
			name="reason"
			type="textarea"
			label="Penality Reason"
			placeholder="Enter penality reason"
		/>
		<Button type="submit" class="mt-4" form="add">
			{#if $delayed}
				<LoadingBtn name="Adding Penality" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Penality
			{/if}
		</Button>
	</form>
</DialogComp>
