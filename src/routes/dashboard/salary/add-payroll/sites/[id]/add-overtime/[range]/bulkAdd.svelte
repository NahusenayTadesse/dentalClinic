<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import type { BulkAdd } from './schema';
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
		selected = $bindable([]),
		overtimeTypes
	}: {
		data: SuperValidated<Infer<BulkAdd>>;
		selected: any[];
		overtimeTypes: Item[];
	} = $props();
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		dataType: 'json'
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
	$effect(() => {
		if (selected.length > 0) {
			$form.ids = selected.map((id) => id.id);
		}
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				selected = [];
				toast.success($message.text);
			}
		}
	});
</script>

<DialogComp
	IconComp={Plus}
	variant="default"
	title="Bulk Add Overtime for {selected.length} Employees"
	description="{selected.length} Employees Selected"
>
	<form
		action="?/bulkAdd"
		use:enhance
		method="post"
		id="bulkAdd"
		class="flex w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />

		<InputComp {form} {errors} label="" name="ids" type="hidden" />

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
		<!-- {#if $form.hours > overtimeTypes.find((type) => type.value === $form.overtimeType)?.maxhours}
			<p class="text-destructive">
				Hours worked exceeds the maximum allowed for this overtime type.
			</p>
		{/if} -->

		<InputComp
			{form}
			{errors}
			name="reason"
			type="textarea"
			label="Overtime Reason"
			placeholder="Enter overtime reason"
		/>

		<Button type="submit" class="mt-4" form="bulkAdd">
			{#if $delayed}
				<LoadingBtn name="Adding Overtime for {selected.length} Employees" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Overtime for {selected.length} Employees
			{/if}
		</Button>
	</form>
</DialogComp>
