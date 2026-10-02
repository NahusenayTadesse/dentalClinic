<script lang="ts">
	let { data } = $props();

	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';

	import { MapPin, Phone, Sheet } from '@lucide/svelte';

	import SingleView from '@nahu/admin-kit/components/SingleView.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import { childActionPaths } from '@nahu/admin-kit/components/lookup/actions.js';
	import { editDetail, editAddress, addContact, editContact } from './schema';
	import { contactConfig } from './configs';
	import PayerAccount from './PayerAccount.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
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

	// A subcity with no name still has to be choosable, so it reads as blank rather than failing.
	const subcities = $derived(data.subcityList.map((s) => ({ value: s.value, name: s.name ?? '' })));

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
				{#if data.customerAddress}
					<FormDialog
						title="Edit the address"
						action="?/editAddress"
						data={data.addressForm}
						schema={editAddress}
					>
						{#snippet fields({ form, errors })}
							<InputComp
								label="Subcity"
								name="subcity"
								type="combo"
								items={subcities}
								{form}
								{errors}
							/>
							<InputComp label="Street" name="street" {form} {errors} />
							<InputComp label="Kebele" name="kebele" {form} {errors} />
							<InputComp label="Building" name="buildingNumber" {form} {errors} required={false} />
							<InputComp label="Floor" name="floor" {form} {errors} required={false} />
							<InputComp label="House number" name="houseNumber" {form} {errors} />
						{/snippet}
					</FormDialog>
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
			<LookupSection
				config={contactConfig}
				rows={data.contacts.rows}
				addForm={data.contacts.addForm}
				editForm={data.contacts.editForm}
				actions={childActionPaths('Contact')}
				schemas={{ add: addContact, edit: editContact }}
				canDelete={data.isSuperAdmin ?? false}
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
