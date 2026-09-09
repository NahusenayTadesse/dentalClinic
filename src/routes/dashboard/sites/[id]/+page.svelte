<script lang="ts">
	let { data } = $props();

	import SingleTable from '$lib/components/SingleTable.svelte';

	import { MapPin, Phone, Sheet } from '@lucide/svelte';

	import SingleView from '$lib/components/SingleView.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import Section from './section.svelte';
	import EditDetail from './editDetail.svelte';
	import EditAddress from './editAddress.svelte';
	import Contacts from './contacts.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import { systemInfoRows } from '$lib/systemInfo';
	import { Settings } from '@lucide/svelte';

	let singleTable = $derived([
		{ name: 'Name', value: data.customer?.name },
		{ name: 'Phone', value: data.customer?.phone },
		{ name: 'Status', value: data.customer?.status ? 'Active' : 'Inactive' },
		{ name: 'Customer Name', value: data.customer?.customerName },
		{ name: 'Added On', value: formatEthiopianDate(new Date(data?.customer?.startedOn)) }
	]);

	let systemInformation = $derived(
		systemInfoRows({
			approvalStatus: data?.customer?.approvalStatus,
			requestedBy: data?.customer?.requestedBy,
			addedBy: data?.customer?.addedBy,
			approvedBy: data?.customer?.approvedBy,
			approvedAt: data?.customer?.approvedAt,
			updatedBy: data?.customer?.updatedBy
		})
	);

	let customerAddress = $derived([
		{ name: 'Subcity', value: data.customerAddress?.subcity },
		{ name: 'Street', value: data.customerAddress?.street },
		{ name: 'Kebele', value: data.customerAddress?.kebele },
		{ name: 'Building', value: data.customerAddress?.buildingNumber },
		{ name: 'Floor', value: data.customerAddress?.floor },
		{ name: 'House Number', value: data.customerAddress?.houseNumber }
	]);
</script>

<svelte:head>
	<title>Site Details</title>
</svelte:head>

<SingleView title="Site Details" class="w-full!">
	<div
		class="mt-4 grid w-full grid-cols-1 items-start justify-start gap-4 px-4 py-4 lg:grid-cols-2"
	>
		{#key data?.customer}
			<Section title="Site Details" IconComp={Sheet} style="identityIcon" class="h-full!">
				{#snippet editDialog()}
					<EditDetail
						data={data?.detailForm}
						name={data?.customer?.name}
						phone={data?.customer?.phone}
						officeCommission={data?.customer?.officeCommission}
						customerId={data?.customer?.customerId}
						customerList={data?.customerList}
						status={data?.customer?.status}
					/>
				{/snippet}
				<SingleTable {singleTable} />
			</Section>
		{/key}

		<Section title="Site Address" IconComp={MapPin} style="addressIcon" class="h-full!">
			{#snippet editDialog()}
				{#key data?.customerAddress}
					<EditAddress
						data={data?.addressForm}
						address={data?.customerAddress}
						subcityList={data?.subcityList}
					/>
				{/key}
			{/snippet}
			<SingleTable singleTable={customerAddress} />
		</Section>
		<Section
			title="Contact Information"
			class="lg:col-span-2"
			IconComp={Phone}
			style="identityIcon"
		>
			<Contacts
				data={data?.contacts}
				form={data?.editContactForm}
				addForm={data?.addContactForm}
				canDelete={data?.isSuperAdmin}
			/>
		</Section>

		<Section title="System Information" IconComp={Settings} style="systemIcon">
			<SingleTable singleTable={systemInformation} />
		</Section>

		{#if data?.isSuperAdmin}
			<div class="flex justify-end lg:col-span-2">
				<DeleteEntity
					entity="Site"
					name={data?.customer?.name}
					consequence="Its contracts are removed with it."
					canDelete={data?.isSuperAdmin}
				/>
			</div>
		{/if}
	</div></SingleView
>
