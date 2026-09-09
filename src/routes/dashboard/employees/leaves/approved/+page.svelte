<script lang="ts">
	import { makeColumns } from '$lib/components/leaves/columns';

	let { data } = $props();

	let columns = $derived(makeColumns('approved', data?.isSuperAdmin));

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
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import LeaveFilters from '../LeaveFilters.svelte';
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';

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

	const totalPages = $derived(Math.ceil(data.pagination.total / data.pagination.pageSize));
</script>

<svelte:head>
	<title>Approved Leaves</title>
</svelte:head>

<div
	class="mx-auto my-4 max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
>
	<div class="flex-1">
		<h2 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
			No of Approved leaves taken: <span class="font-medium text-gray-800 dark:text-gray-100"
				>{data.pagination.total}</span
			>
		</h2>
		{#if totalPages > 1}
			<p class="text-sm text-muted-foreground">
				Showing {data.salaryHistory.length} on page {data.pagination.page} of {totalPages}
			</p>
		{/if}
	</div>
</div>

<QueryBuilder
	title="Leaves Query"
	description="Server-side search across every approved leave"
	showDate
	totalResults={data.pagination.total}
	searchPlaceholder="Search employee, site, department or reason..."
	initialSearch={data.currentQuery.search}
	initialStart={data.currentQuery.dateStart ?? undefined}
	initialEnd={data.currentQuery.dateEnd ?? undefined}
	initialPageSize={data.pagination.pageSize}
	defaultPageSize={20}
	initialCustomFilters={{
		leaveTypeId: data.currentQuery.leaveTypeId ?? '',
		departmentId: data.currentQuery.departmentId ?? '',
		siteId: data.currentQuery.siteId ?? '',
		approvedById: data.currentQuery.approvedById ?? '',
		duration: data.currentQuery.duration ?? ''
	}}
	onQueryChange={applyQueryToUrl}
>
	{#snippet children(filters, update)}
		<LeaveFilters {filters} {update} filterOptions={data.filterOptions} />
	{/snippet}
</QueryBuilder>

{#if data?.salaryHistory.length === 0}
	<div class="flex h-96 flex-col items-center justify-center gap-4">
		<p class="mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No approved leaves match this query
		</p>
		<p class="text-sm text-muted-foreground">Clear the filters in the query bar above.</p>
	</div>
{:else}
	{#if selected.length > 0}
		<div transition:fly={{ x: -200, duration: 600 }}>
			<FormCard title="Approve or Cancel Leave Request" className="relative!">
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
							{ value: 'pending', name: 'Change to Pending Leave' },
							{ value: 'rejected', name: 'Reject Leave Request' }
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
		<!--
			`FilterMenu` used to sit here. It filtered only the rows already in the
			browser, which was misleading once the page stopped loading all of them —
			the query bar above does the same job against the whole table.
		-->
		<DataTable
			data={data.salaryHistory}
			{columns}
			fileName="Approved Leaves"
			search={true}
			bind:selected
		/>
	{/key}

	{#if totalPages > 1}
		<div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
			<span>Page {data.pagination.page} of {totalPages} ({data.pagination.total} total)</span>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page <= 1}
					onclick={() => navigateWithQuery({ page: data.pagination.page - 1 })}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page >= totalPages}
					onclick={() => navigateWithQuery({ page: data.pagination.page + 1 })}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
{/if}
