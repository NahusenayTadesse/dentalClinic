<script lang="ts">
	import { makeColumns } from './columns';

	let { data } = $props();

	let columns = $derived(makeColumns(data?.isSuperAdmin));

	import DataTable from '$lib/components/Table/data-table.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Frown, Plus, ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.staffList);
	import { invalidateAll } from '$app/navigation';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import { page } from '$app/state';
	let month = $state(page.params.range);
	let link = $derived(month);
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	// const { form, errors, enhance, delayed, message, allErrors } = superForm(data.form, {
	// 	dataType: 'json'
	// });

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	// $effect(() => {
	// 	if ($message) {
	// 		if ($message.type === 'error') {
	// 			toast.error($message.text);
	// 		} else {
	// 			toast.success($message.text);
	// 		}
	// 	}
	// });

	import { onMount } from 'svelte';
	import BulkAdd from './bulkAdd.svelte';

	const channel = new BroadcastChannel('db_updates');

	let selected = $state([]);

	// $effect(() => {
	// 	if (selected.length > 0) {
	// 		$form.ids = selected.map((id) => id.id);
	// 	}
	// });
</script>

<svelte:head>
	<title>Overtime List</title>
</svelte:head>

{#if data.staffList.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />
			No Employees added yet
		</p>
		<Button href="/dashboard/employees/add-employee"><Plus />Add New Employees</Button>
	</div>
{:else}
	<h3 class="my-4 text-2xl">
		All Active Employees Overtime for {month?.replace('_', ' ')}
	</h3>
	<h4 class="mb-4">{data?.staffList.length} Employees</h4>
	<div class="mb-4 flex w-32 flex-row items-start gap-2">
		<label class="sr-only" for="month-select">Month</label>
		<MonthYear bind:value={month} />

		<Button
			href="/dashboard/salary/add-overtime/{link}"
			aria-label="Go to selected month and year"
			class="flex items-center gap-2"
		>
			Go
			<ArrowRight class="h-4 w-4" />
		</Button>
	</div>

	<div class="flex flex-col gap-4">
		<div class="max-w-sm">
			{#if selected.length}
				{#key data?.staffList}
					<BulkAdd bind:selected overtimeTypes={data?.types} data={data?.form} />
				{/key}
				<!-- <DialogComp
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
							items={data?.types}
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

						<Button type="submit" class="mt-4" form="bulkAdd">
							{#if $delayed}
								<LoadingBtn name="Adding Overtime for {selected.length} Employees" />
							{:else}
								<Plus class="h-4 w-4" />

								Add Overtime for {selected.length} Employees
							{/if}
						</Button>
					</form>
				</DialogComp> -->
			{/if}
		</div>

		<FilterMenu
			data={data?.staffList}
			bind:filteredList
			filterKeys={['department', 'position', 'branch']}
		/>
		<DataTable bind:selected data={filteredList} class="!" {columns} />
	</div>
{/if}
