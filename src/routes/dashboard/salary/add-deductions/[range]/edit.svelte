<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Pen, PencilRuler, Save, SquarePen } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	interface OvertimeEntry {
		id: number;
		date: string;

		total: number;
		reason: string;
	}
	let {
		data,
		overTimeDetails,
		staffId
	}: {
		data: SuperValidated<Edit>;
		staffId: number;
		overTimeDetails: OvertimeEntry;
	} = $props();
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		onUpdate({ result }) {
			if (result.type === 'success') {
				open = false; // This will now trigger correctly
			}
		},
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
	$form.type = overTimeDetails?.reason;

	$form.amount = overTimeDetails?.total;
	$form.description = overTimeDetails?.description;
	$form.deductionDate = overTimeDetails?.date;
</script>

<DialogComp title="Edit Deduction" variant="default" bind:open>
	{#snippet trigger(props)}
		<Button variant="default" {...props}>
			<SquarePen /> Edit
		</Button>
	{/snippet}
	<form action="?/edit" use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<InputComp {form} {errors} label="" name="id" type="hidden" />
		<InputComp {form} {errors} label="" name="staffId" type="hidden" />

		<InputComp {form} {errors} name="deductionDate" type="date" label="Deduction Date" required />
		<InputComp
			{form}
			{errors}
			name="type"
			type="select"
			label="Deduction Type"
			items={[
				{ value: 'Savings', name: 'Savings' },
				{ value: 'Penality', name: 'Penality' },
				{ value: 'Loan', name: 'Loan' }
			]}
			required
		/>

		<InputComp
			{form}
			{errors}
			name="amount"
			type="number"
			label="Amount Deducted"
			items={[
				{ value: 'Savings', name: 'Savings' },
				{ value: 'Penality', name: 'Penality' },
				{ value: 'Loan', name: 'Loan' }
			]}
			required
			placeholder="Enter the total amount of the deduction"
		/>
		<InputComp
			{form}
			{errors}
			name="description"
			type="textarea"
			label="Deduction Description(Optional)"
			placeholder="Enter added product description"
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
