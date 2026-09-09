<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import { makeColumns } from './columns';

	let { data } = $props();

	let columns = $derived(makeColumns(data?.isSuperAdmin));
	import { fade, fly } from 'svelte/transition';

	import DataTable from '$lib/components/Table/data-table.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';

	import { BadgeCheck, Frown, Plus, X } from '@lucide/svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	let filteredList = $derived(data?.contracts);

	let selected = $state([]);

	import Errors from '$lib/formComponents/Errors.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data.form, {
		dataType: 'json'
	});
	import { toast } from 'svelte-sonner';
	import FormCard from '$lib/formComponents/FormCard.svelte';

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
</script>

<svelte:head>
	<title>Approved Payments</title>
</svelte:head>

{#if data?.contracts.length === 0 && !data.currentQuery.search}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16 animate-bounce" />
			No Active Payments added Yet
		</p>
		<Button href="/dashboard/payments/add-payment"><Plus /> Add Payment</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">No of Approved Payments: {data.pagination.total}</h2>

	{#if selected.length > 0}
		<div transition:fly={{ x: -200, duration: 600 }}>
			<FormCard title="Edit Approved Selected Monthly Payments" className="relative!">
				<p class="my-4 text-sm">Selected Contracts: {selected.length}</p>
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
						label="Select Status for selected Contracts"
						type="select"
						name="status"
						items={[
							{ value: 'pending', name: 'Pending Approval' },
							{ value: 'rejected', name: 'Reject Contract Payment' }
						]}
					/>
					<Button type="submit">
						<BadgeCheck /> Save Changes</Button
					>
				</form>
			</FormCard>
		</div>
	{/if}

	<QueryBuilder
		title="Payments Query"
		description="Server-side search across approved payments"
		showDate
		totalResults={data.pagination.total}
		initialSearch={data.currentQuery.search}
		initialStart={data.currentQuery.dateStart ?? undefined}
		initialEnd={data.currentQuery.dateEnd ?? undefined}
		initialPageSize={data.pagination.pageSize}
		initialCustomFilters={{
			serviceId: data.currentQuery.serviceId ?? '',
			paymentMethodId: data.currentQuery.paymentMethodId ?? '',
			contractYear: data.currentQuery.contractYear ?? '',
			month: data.currentQuery.month ?? '',
			year: data.currentQuery.year ?? ''
		}}
		onQueryChange={applyQueryToUrl}
	>
		{#snippet children(filters, update)}
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Service</Label>
				<Select
					type="single"
					value={filters.serviceId as string}
					onValueChange={(v) => update('serviceId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.services.find((s) => String(s.id) === filters.serviceId)?.name ??
							'All services'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All services</SelectItem>
						{#each data.filterOptions.services as svc (svc.id)}
							<SelectItem value={String(svc.id)}>{svc.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Payment Method</Label>
				<Select
					type="single"
					value={filters.paymentMethodId as string}
					onValueChange={(v) => update('paymentMethodId', v as never)}
				>
					<SelectTrigger class="w-full">
						{data.filterOptions.paymentMethods.find((m) => String(m.id) === filters.paymentMethodId)
							?.name ?? 'All methods'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">All methods</SelectItem>
						{#each data.filterOptions.paymentMethods as method (method.id)}
							<SelectItem value={String(method.id)}>{method.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>
		{/snippet}
	</QueryBuilder>

	{#key data?.contracts}
		<FilterMenu
			data={data?.contracts}
			bind:filteredList
			filterKeys={[
				'siteName',
				'month',
				'year',
				'serviceName',
				'requestAmount',
				'paymentAmount',
				'penalityAmount',
				'beforeVat',
				'withholdAmount',
				'approvedBy',
				'processedBy'
			]}
		/>
		<DataTable data={filteredList} {columns} bind:selected />
	{/key}

	{#if data.pagination.total > data.pagination.pageSize}
		<div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
			<span>
				Page {data.pagination.page} of {Math.ceil(data.pagination.total / data.pagination.pageSize)}
			</span>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page <= 1}
					onclick={() => {
						selected = [];
						navigateWithQuery({ page: data.pagination.page - 1 });
					}}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page >=
						Math.ceil(data.pagination.total / data.pagination.pageSize)}
					onclick={() => {
						selected = [];
						navigateWithQuery({ page: data.pagination.page + 1 });
					}}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
{/if}
