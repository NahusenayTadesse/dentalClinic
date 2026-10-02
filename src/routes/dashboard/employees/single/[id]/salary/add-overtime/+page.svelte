<script lang="ts">
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '@nahu/admin-kit/components/ui/textarea/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';

	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { overtimeSchema as schema } from './schema';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	let { data } = $props();

	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	const { form, errors, enhance, delayed, allErrors, capture, restore } = createForm(
		data.form,
		schema,
		{
			taintedMessage: confirmLeave
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	$form.hours = 1;
</script>

<svelte:head>
	<title>Add New Overtime</title>
</svelte:head>

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add an Overtime for {data.salaryDetail.name}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form use:enhance action="?/addOvertime" id="main" class="flex flex-col gap-4" method="post">
			<Errors allErrors={$allErrors} />

			<InputComp
				{form}
				{errors}
				name="overtimeType"
				type="combo"
				label="Overtime Type"
				required
				items={data?.overtimeTypes}
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

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Overtime" />
				{:else}
					<Plus class="h-4 w-4" />
					Add Overtime
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
