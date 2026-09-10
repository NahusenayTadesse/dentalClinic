<script lang="ts">
	import { makeColumns } from '$lib/components/leaves/columns';

	let { data } = $props();

	let columns = $derived(makeColumns('rejected', data?.isSuperAdmin));

	import DataTable from '$lib/components/Table/data-table.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { Frown, ArrowRight, ArrowBigLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/state';

	let month = $state(
		new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString(undefined, {
			month: 'long'
		}) +
			'_' +
			new Date().getFullYear()
	);

	let link = $derived(`${month}`);

	import { BadgeCheck, Plus, X } from '@lucide/svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	let selected = $state([]);

	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { fly } from 'svelte/transition';

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data.form, {
		dataType: 'json'
	});
	import { toast } from 'svelte-sonner';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import LeaveSelectionSummary from '../LeaveSelectionSummary.svelte';

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$effect(() => {
		if (selected.length > 0) {
			$form.ids = selected.map((id) => id.id);
		}
	});

	let filteredList = $derived(data?.salaryHistory);
</script>

<svelte:head>
	<title>Cancelled Leaves</title>
</svelte:head>

{#if data?.salaryHistory.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />
			No cancelled leaves
		</p>
		<!-- <Button href="/dashboard/services/add-services"><Plus />Add New Staff Members</Button> -->
	</div>
{:else}
	<div
		class="mx-auto my-4 max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
	>
		<div class="flex-1">
			<h2 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
				No of cancelled leaves taken: <span class="font-medium text-gray-800 dark:text-gray-100"
					>{data?.salaryHistory.length}</span
				>
			</h2>
		</div>
	</div>

	{#if selected.length > 0}
		<div transition:fly={{ x: -200, duration: 600 }}>
			<FormCard title="Approve or Change to Pending Leave Request" className="relative!">
				<LeaveSelectionSummary {selected} />
				<Button
					title="Unselect All"
					variant="outline"
					class="absolute top-2 right-2"
					size="icon"
					onclick={() => (selected = [])}
				>
					<X /></Button
				>

				<form action="?/approve" method="post" use:enhance class="my-4 flex flex-col gap-4">
					<Errors allErrors={$allErrors} />
					<InputComp {form} {errors} label="" type="hidden" name="ids" />
					<InputComp
						{form}
						{errors}
						label="Select Status for selected employees"
						type="select"
						name="status"
						items={[
							{ value: 'approved', name: 'Approve Contract Payment' },
							{ value: 'pending', name: 'Change to Pending Leave' }
						]}
					/>
					<Button type="submit">
						<BadgeCheck /> Save Changes</Button
					>
				</form>
			</FormCard>
		</div>
	{/if}
	{#key data?.salaryHistory}
		<FilterMenu
			data={data?.salaryHistory}
			bind:filteredList
			filterKeys={['department', 'branchName', 'name', 'numberOfDays', 'reason']}
		/>
		<DataTable
			data={filteredList}
			{columns}
			fileName="Pending Leaves"
			search={true}
			bind:selected
		/>
	{/key}
{/if}
