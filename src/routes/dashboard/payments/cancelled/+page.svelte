<script lang="ts">
	import { makeColumns } from './columns';

	let { data } = $props();

	let columns = $derived(makeColumns(data?.isSuperAdmin));
	import { fade, fly } from 'svelte/transition';

	import DataTable from '$lib/components/Table/data-table.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

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
	<title>Unapproved Payments</title>
</svelte:head>

{#if data?.contracts.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />
			No Payments added Yet
		</p>
		<Button href="/dashboard/payments/add-payment"><Plus /> Add Payment</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">No of Unapproved Payments: {data.contracts?.length}</h2>
	{#if selected.length > 0}
		<div transition:fly={{ x: -200, duration: 600 }}>
			<FormCard title="Approve or Cancel Selected Monthly Payments" className="relative!">
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
							{ value: 'approved', name: 'Approve Site Payment' },
							{ value: 'pending', name: 'Pending Approval' }
						]}
					/>
					<Button type="submit">
						<BadgeCheck /> Save Changes</Button
					>
				</form>
			</FormCard>
		</div>
	{/if}
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
				'withholdAmount'
			]}
		/>
		<DataTable data={filteredList} {columns} bind:selected />
	{/key}
{/if}
