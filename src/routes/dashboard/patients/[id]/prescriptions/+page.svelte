<script lang="ts">
	import Pill from '@lucide/svelte/icons/pill';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import { page } from '$app/state';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import PrescriptionForm from './PrescriptionForm.svelte';
	import { prescriptionColumns } from './columns';

	/**
	 * The prescriptions tab: what this patient has been prescribed, newest first, and writing a new
	 * one. A prescription is fixed once written — it is on paper in the patient's hand — so there is
	 * no edit; one written in error is cancelled by a super admin and written again.
	 */
	let { data } = $props();

	let writeOpen = $state(false);
	const columns = $derived(
		prescriptionColumns(data.patient.id, data.canCancel ? data.forms.cancel : null)
	);
	/** The one just written, to print — set by the redirect after writing it. */
	const written = $derived(Number(page.url.searchParams.get('written')) || null);
</script>

<svelte:head>
	<title>{data.patient.fullName} — Prescriptions</title>
</svelte:head>

<div class="flex flex-col gap-4">
	{#if written && data.prescriptions.some((p) => p.id === written)}
		<div class="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm" role="status">
			Prescription written.
			<Button
				href="/dashboard/patients/{data.patient.id}/prescriptions/{written}/print"
				target="_blank"
				size="sm"
			>
				<Printer class="size-4" /> Print it for the patient
			</Button>
		</div>
	{/if}

	<Section title="Prescriptions" IconComp={Pill} style="identityIcon">
		{#snippet editDialog()}
			{#if data.canWrite}
				<Button
					size="sm"
					class="ml-auto"
					disabled={!data.prescribers.length}
					onclick={() => (writeOpen = true)}
				>
					<Plus class="size-4" /> Write a prescription
				</Button>
			{/if}
		{/snippet}

		{#if data.canWrite && !data.prescribers.length}
			<p class="mb-3 text-sm text-muted-foreground">
				Nobody is recorded as able to prescribe. Tick <strong>Can prescribe</strong> on a clinician
				under <strong>Appointments → Dentists</strong> first.
			</p>
		{/if}

		{#if data.prescriptions.length}
			<DataTable
				{columns}
				data={data.prescriptions}
				facetKeys={['antibiotic']}
				fileName="prescriptions"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				Nothing has been prescribed for this patient here.
			</p>
		{/if}
	</Section>
</div>

<DialogComp title="Write a prescription" variant="ghost" bind:open={writeOpen}>
	{#snippet trigger()}{/snippet}
	<div class="p-4">
		<PrescriptionForm
			data={data.forms.add}
			medicines={data.medicines}
			allergies={data.allergies}
			currentMedicines={data.currentMedicines}
			prescribers={data.prescribers}
			visits={data.visits}
			onsaved={() => (writeOpen = false)}
		/>
	</div>
</DialogComp>
