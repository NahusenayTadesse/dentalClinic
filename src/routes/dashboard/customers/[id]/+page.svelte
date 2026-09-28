<script lang="ts">
	let { data } = $props();

	import SingleTable from '$lib/components/SingleTable.svelte';

	import { MapPin, Phone, Sheet } from '@lucide/svelte';

	import SingleView from '$lib/components/SingleView.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import Section from '$lib/components/Section.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { editDetail } from './schema';
	import EditAddress from './editAddress.svelte';
	import Contacts from './contacts.svelte';
	import PayerAccount from './PayerAccount.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import { systemInfoRows } from '$lib/systemInfo';
	import { Settings } from '@lucide/svelte';

	let singleTable = $derived([
		{ name: 'Name', value: data.customer?.name },
		{ name: 'Phone', value: data.customer?.phone },
		{ name: 'Email', value: data.customer?.email },
		{ name: 'Status', value: data.customer?.status ? 'Active' : 'Inactive' },
		{ name: 'Tin Number', value: data.customer?.tinNo },
		{ name: 'Added On', value: formatEthiopianDate(new Date(data?.customer?.joinedOn)) }
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
	<title>{data.customer.name} — Payer</title>
</svelte:head>

<SingleView title="Payer" class="w-full!">
	<div
		class="mt-4 grid w-full grid-cols-1 items-start justify-start gap-4 px-4 py-4 lg:grid-cols-2"
	>
		{#key data?.customer}
			<Section title="Details" IconComp={Sheet} style="identityIcon" class="h-full!">
				{#snippet editDialog()}
					<FormDialog
						title="Edit the payer"
						action="?/editDetail"
						data={data.detailForm}
						schema={editDetail}
					>
						{#snippet fields({ form, errors })}
							<InputComp label="Name" name="name" {form} {errors} />
							<InputComp label="Phone" name="phone" type="tel" {form} {errors} />
							<InputComp label="Email" name="email" type="email" {form} {errors} required={false} />
							<InputComp label="TIN" name="tinNo" {form} {errors} />
							<InputComp
								label="Status"
								name="status"
								type="select"
								{form}
								{errors}
								items={[
									{ value: true, name: 'Active' },
									{ value: false, name: 'Inactive' }
								]}
							/>
						{/snippet}
					</FormDialog>
				{/snippet}
				<SingleTable {singleTable} />
			</Section>
		{/key}

		<Section title="Address" IconComp={MapPin} style="addressIcon" class="h-full!">
			{#snippet editDialog()}
				<!-- Only with an address to edit: the dialog read `address.id` and crashed the page for a
				     customer without one. The action refuses too — it edits the customer's own address. -->
				{#if data?.customerAddress}
					{#key data.customerAddress}
						<EditAddress
							data={data?.addressForm}
							address={data.customerAddress}
							subcityList={data?.subcityList}
						/>
					{/key}
				{/if}
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

		{#if data.account}
			<PayerAccount account={data.account} form={data.account.form} />
		{/if}

		<Section title="System Information" IconComp={Settings} style="systemIcon">
			<SingleTable singleTable={systemInformation} />
		</Section>

		{#if data?.isSuperAdmin}
			<div class="flex justify-end lg:col-span-2">
				<DeleteEntity entity="Payer" name={data?.customer?.name} canDelete={data?.isSuperAdmin} />
			</div>
		{/if}
	</div></SingleView
>
