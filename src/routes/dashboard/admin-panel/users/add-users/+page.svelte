<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { addUserSchema } from '$lib/ZodSchema';
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, capture, restore } = createForm(
		data.form,
		addUserSchema,
		{
			taintedMessage: confirmLeave
		}
	);

	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import PasswordGenerator from '$lib/components/password-generator.svelte';

	export const snapshot: Snapshot = { capture, restore };
</script>

<svelte:head>
	<title>Add New User</title>
</svelte:head>

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add New User</Card.Title>
	</Card.Header>
	<Card.Content>
		<form use:enhance action="?/addUser" id="main" class="flex flex-col gap-4" method="POST">
			<!-- <InputComp {form} {errors} type="text" name="name" placeholder="" label="Employee Name" /> -->
			<InputComp
				{form}
				{errors}
				type="select"
				items={data?.officeWorkers}
				name="name"
				placeholder=""
				label="Employee Name"
			/>
			<InputComp {form} {errors} type="email" name="email" placeholder="" label="Email" />

			<InputComp {form} {errors} type="password" name="password" placeholder="" label="Password" />
			<div class="w-sm">
				<PasswordGenerator bind:password={$form.password} />
			</div>

			<InputComp
				{form}
				{errors}
				type="select"
				name="role"
				placeholder=""
				label="Role"
				items={data?.allRoles}
			/>

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Service" />
				{:else}
					<Plus class="h-4 w-4" />

					Add User
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
