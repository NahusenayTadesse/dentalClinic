<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import type { EditQualification } from './schema';

	let {
		data,
		id,
		field,
		educationalLevel,
		schoolName,
		graduationDate,
		eduLevel,
		certificate,
		icon = false
	}: {
		data: SuperValidated<Infer<EditQualification>>;
		id: number;
		field: string;
		schoolName: string;
		educationalLevel: number;
		graduationDate: Date;
		certificate?: string;
		eduLevel: Item[];
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.field = field;
	$form.schoolName = schoolName;
	$form.educationalLevel = educationalLevel;
	$form.graduationDate = graduationDate?.toLocaleDateString('en-CA');

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
				open = false;
			}
		}
	});
</script>

<DialogComp title="Edit {field}" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{field}
			{/if}
		</Button>
	{/snippet}
	<form
		action="?/editQualification"
		use:enhance
		method="post"
		id="edit"
		class="flex h-96 w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			label="Field"
			name="field"
			type="text"
			{form}
			{errors}
			placeholder="Enter Field Name"
		/>
		<InputComp
			label="Educational Level"
			name="educationalLevel"
			type="combo"
			{form}
			{errors}
			items={eduLevel}
			required
		/>

		<InputComp
			label="School Name "
			name="schoolName"
			type="text"
			{form}
			{errors}
			required
			placeholder="Enter School Name"
		/>
		<InputComp
			label="Graduation Date"
			name="graduationDate"
			type="date"
			{form}
			{errors}
			oldDays
			futureDays={false}
		/>
		<InputComp
			label="Certificate"
			name="certificate"
			type="file"
			image={certificate ? certificate : undefined}
			{form}
			{errors}
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
