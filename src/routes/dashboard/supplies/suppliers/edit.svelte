<script lang="ts">
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	type Item = {
		value: number;
		name: string;
	};

	let {
		data,
		action = '?/edit',
		id,
		name,
		subcity,
		street,
		kebele,
		buildingNumber,
		floor,
		houseNumber,
		phone,
		description,
		icon = false,
		status = true
	}: {
		data: SuperValidated<Edit>;
		action: string;
		id: number;
		name: string;
		icon: boolean;
		subcity?: string | null;
		street?: string | null;
		kebele?: string | null;
		buildingNumber?: string | null;
		floor?: string | null;
		houseNumber?: string | null;
		phone: string;
		description: string;
		status: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.name = name;
	$form.subcity = subcity;
	$form.street = street;
	$form.kebele = kebele;
	$form.buildingNumber = buildingNumber;
	$form.floor = floor;
	$form.houseNumber = houseNumber;
	$form.phone = phone;
	$form.description = description;
	$form.status = status;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Messages from '@nahu/admin-kit/formComponents/Messages.svelte';
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
			class="flex w-auto flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{name}
			{/if}
		</Button>
	{/snippet}
	<form {action} use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<Messages {message} />
		<InputComp {form} {errors} label="name" type="text" name="name" required={true} />
		<InputComp {form} {errors} label="phone" type="tel" name="phone" required={true} />
		<InputComp {form} {errors} label="email" type="email" name="email" required={false} />
		<InputComp
			{form}
			{errors}
			label="description"
			type="textarea"
			name="description"
			required={false}
		/>

		<h3>Supplier Address</h3>

		<InputComp
			{form}
			{errors}
			label="Subcity  "
			type="combo"
			name="subcity"
			placeholder="Enter Department Location"
			required={true}
			items={data?.subcitiesList}
		/>
		<InputComp
			{form}
			{errors}
			label="Street"
			type="text"
			name="street"
			placeholder="Enter Street Name"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Kebele"
			type="text"
			name="kebele"
			placeholder="Enter Kebele"
			required={true}
			rows={10}
		/>

		<InputComp
			{form}
			{errors}
			label="Building"
			type="text"
			name="buildingNumber"
			placeholder="Enter Building Name or Number"
			required={false}
		/>

		<InputComp
			{form}
			{errors}
			label="House Number"
			type="text"
			name="houseNumber"
			placeholder="Enter House Number"
			required={false}
		/>

		<InputComp
			{form}
			{errors}
			label="Floor"
			type="text"
			name="floor"
			placeholder="Enter Floor Number"
			required={false}
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
