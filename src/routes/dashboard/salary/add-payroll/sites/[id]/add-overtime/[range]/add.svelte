<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import type { Add } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	interface OvertimeEntry {
		id: number;
		date: string;
		overtimeTypeId: number;
		staffId: number;
		hours: number;
		total: number;
		reason: string;
	}
	let {
		data,
		staffId,
		overtimeTypes
	}: {
		data: SuperValidated<Infer<Add>>;
		staffId: number;
		overtimeTypes: Item[];
	} = $props();
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

	$form.staffId = staffId;
</script>

<DialogComp title="Add" IconComp={Plus} variant="default">
	<form action="?/add" use:enhance method="post" id="add" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<InputComp {form} {errors} label="" name="staffId" type="hidden" />
		<InputComp
			{form}
			{errors}
			name="overtimeType"
			type="combo"
			label="Overtime Type"
			required
			items={overtimeTypes}
		/>
		<InputComp {form} {errors} name="date" type="date" label="Overtime Date" required />

		<InputComp {form} {errors} name="hours" type="number" label="Hours Worked" required />
		<InputComp
			{form}
			{errors}
			name="reason"
			type="textarea"
			label="Overtime Reason"
			placeholder="Enter overtime reason"
		/>
		<Button type="submit" class="mt-4" form="add">
			{#if $delayed}
				<LoadingBtn name="Adding Overtime" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Overtime
			{/if}
		</Button>
	</form>
</DialogComp>
