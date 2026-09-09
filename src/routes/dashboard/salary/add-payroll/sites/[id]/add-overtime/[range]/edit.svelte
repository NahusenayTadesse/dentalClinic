<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Pen, PencilRuler, Save, SquarePen } from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	interface OvertimeEntry {
		id: number;
		date: string;
		overtimeTypeId: number;
		hours: number;
		total: number;
		reason: string;
	}
	let {
		data,
		overTimeDetails,
		staffId,
		overtimeTypes
	}: {
		data: SuperValidated<Infer<Edit>>;
		staffId: number;
		overTimeDetails: OvertimeEntry;
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
	$form.id = overTimeDetails?.id;
	$form.staffId = staffId;

	$form.hours = overTimeDetails?.hours;
	$form.reason = overTimeDetails?.reason;
	$form.date = overTimeDetails?.date;
	$form.overtimeType = overTimeDetails?.overtimeTypeId;
</script>

<DialogComp title="Edit" IconComp={SquarePen} variant="default">
	<form action="?/edit" use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<InputComp {form} {errors} label="" name="id" type="hidden" />
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
		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" />

				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
