<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { terminate, type Terminate } from './schema';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { X } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';

	let { data, employee }: { data: SuperValidated<Terminate>; employee: string } = $props();

	const { form, errors, enhance, delayed, allErrors } = createForm(data, terminate);
</script>

<DialogComp
	title="Terminate {employee}"
	variant="destructive"
	class="flex w-full flex-col items-center justify-center"
>
	<form
		id="main"
		action="?/terminate"
		class="flex w-full flex-col items-center justify-center gap-2 space-y-4"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<p class="text-center text-red-500">
			You are about to terminate {employee}, this will remove employee from lists, salary
			calculations.
		</p>
		<InputComp
			label="Reason"
			name="reason"
			type="textarea"
			{form}
			rows={5}
			{errors}
			required
			placeholder="Enter reason for termination"
		/>
		<InputComp
			label="Termination Date"
			name="terminationDate"
			type="date"
			{form}
			{errors}
			required
			oldDays
			futureDays
		/>
		<InputComp
			label="Termination Letter"
			placeholder="Upload termination letter"
			name="terminationLetter"
			type="file"
			required={false}
			{form}
			{errors}
		/>

		<Errors allErrors={$allErrors} />
		<Button type="submit" class="w-full" form="main" variant="destructive">
			{#if $delayed}
				<LoadingBtn name="Terminating Employee" />
			{:else}
				<X class="h-4 w-4" />
				Terminate Employee
			{/if}
		</Button>
	</form>
</DialogComp>
