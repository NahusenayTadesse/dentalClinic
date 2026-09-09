<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import DatePicker2 from '$lib/formComponents/DatePicker2.svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { overtimeSchema as schema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import Errors from '$lib/formComponents/Errors.svelte';
	let { data } = $props();

	import InputComp from '$lib/formComponents/InputComp.svelte';

	const { form, errors, enhance, delayed, allErrors, capture, restore, message } = superForm(
		data.form,
		{
			taintedMessage: () => {
				return new Promise((resolve) => {
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
				});
			},
			validators: zod4Client(schema)
		}
	);

	export const snapshot: Snapshot = { capture, restore };
	import { toast } from 'svelte-sonner';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});

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
