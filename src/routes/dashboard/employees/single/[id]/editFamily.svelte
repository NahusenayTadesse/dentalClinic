<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { EditFamily } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	type Gender = 'male' | 'female';

	type RelationShip =
		| 'mother'
		| 'father'
		| 'spouse'
		| 'son'
		| 'daughter'
		| 'grandchild'
		| 'grandfather'
		| 'grandmother'
		| 'uncle'
		| 'aunt'
		| 'brother'
		| 'sister'
		| 'other';

	const relationShips = [
		'mother',
		'father',
		'spouse',
		'son',
		'daughter',
		'grandchild',
		'grandfather',
		'grandmother',
		'uncle',
		'aunt',
		'brother',
		'sister',
		'other'
	].map((v) => ({
		value: v,
		name: v.charAt(0).toUpperCase() + v.slice(1)
	}));

	const genders = [
		{ value: 'male', name: 'Male' },
		{ value: 'female', name: 'Female' }
	];

	let {
		data,
		id,
		name,
		phone,
		email,
		gender,
		icon = false,
		relationship,
		emergencyContact,
		otherRelationship,
		status = true
	}: {
		data: SuperValidated<Infer<EditFamily>>;
		id: number;
		name: string;
		gender: string;
		phone?: string;
		email?: string;
		icon: boolean;
		relationship: RelationShip;
		otherRelationship?: string;
		emergencyContact: boolean;
		status: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.name = name;
	$form.gender = gender;
	$form.email = email;
	$form.phone = phone;
	$form.relationship = relationship;
	$form.emergencyContact = emergencyContact;
	$form.otherRelationship = otherRelationship;
	$form.status = status;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
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

<DialogComp title="Edit {name}" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
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
				{name}
			{/if}
		</Button>
	{/snippet}
	<form
		action="?/editFamily"
		use:enhance
		method="post"
		id="edit"
		class="flex h-96 w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			placeholder="Enter Name of Family Member"
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			placeholder="Enter Phone Number"
		/>

		<InputComp
			label="Email"
			name="email"
			type="email"
			{form}
			{errors}
			required={false}
			placeholder="Enter Email"
		/>
		<InputComp
			label="Gender"
			name="gender"
			type="select"
			{form}
			{errors}
			items={[
				{ value: 'male', name: 'Male' },
				{ value: 'female', name: 'Female' }
			]}
		/>

		<InputComp
			label="Relationship to Employee"
			name="relationship"
			type="combo"
			{form}
			{errors}
			items={relationShips}
		/>
		{#if $form.relationship === 'other'}
			<InputComp
				label="Relationship to Employee"
				name="otherRelationship"
				type="text"
				{form}
				{errors}
			/>
		{/if}

		<input hidden bind:value={$form.otherRelationship} name="otherRelationship" />

		<InputComp
			label="Is this Family Member an Emergency Contact?"
			name="emergencyContact"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: 'Emergency Contact' },
				{ value: false, name: 'Not Emergency Contact' }
			]}
		/>
		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: 'Active' },
				{ value: false, name: 'Inactive' }
			]}
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
