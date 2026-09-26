<script lang="ts">
	import Smile from '@lucide/svelte/icons/smile';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button/index.js';
	import Section from '$lib/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import { dentitionForAge, toothName, toothStates, type Dentition } from '$lib/teeth';
	import Odontogram from './Odontogram.svelte';
	import ProcedureFields from './ProcedureFields.svelte';
	import StatusCell from './StatusCell.svelte';
	import { procedureColumns, whereLabel, type ProcedureRow } from './columns';
	import { addProcedure, editProcedure, type AddProcedure, type EditProcedure } from './schema';

	/**
	 * The dental chart tab: the mouth, the tooth being looked at, and every procedure on record.
	 *
	 * Clicking a tooth selects it; charting from there opens the add dialog already on that tooth.
	 * The procedure list below edits any row through one shared dialog. Who may change anything is
	 * `can.clinical` from the layout — the actions check `patients.clinical` again on the server.
	 */
	let { data } = $props();

	// The dentition the patient's age suggests, until somebody picks another.
	let chosenDentition = $state<Dentition | null>(null);
	const dentition = $derived(chosenDentition ?? dentitionForAge(data.patient.age));

	let selectedTooth = $state<number | null>(null);

	const states = $derived(toothStates(data.procedures));

	/** Procedures touching the selected tooth, a span included. */
	const onSelected = $derived(
		selectedTooth === null
			? []
			: data.procedures.filter(
					(p) =>
						p.toothId === selectedTooth ||
						(p.toothRange ?? '')
							.split(',')
							.map(Number)
							.includes(selectedTooth ?? -1)
				)
	);

	let addOpen = $state(false);
	let addSeed = $state<Partial<AddProcedure>>({});

	function chart(tooth: number | null) {
		addSeed = {
			toothId: tooth === null ? '' : String(tooth),
			surfaces: '',
			status: 'condition'
		};
		addOpen = true;
	}

	let editOpen = $state(false);
	let editSeed = $state<Partial<EditProcedure>>({});

	function edit(row: ProcedureRow) {
		editSeed = {
			id: row.id,
			serviceId: row.serviceId,
			status: row.status,
			toothId: row.toothId === null ? '' : String(row.toothId),
			surfaces: row.surfaces ?? '',
			toothRange: row.toothRange ?? '',
			providerId: row.providerId === null ? '' : String(row.providerId),
			appointmentId: row.appointmentId === null ? '' : String(row.appointmentId),
			fee: row.fee === null ? '' : String(row.fee),
			note: row.note ?? ''
		};
		editOpen = true;
	}

	const columns = $derived(procedureColumns({ onedit: edit, canEdit: data.can.clinical }));

	const dentitions: { value: Dentition; label: string }[] = [
		{ value: 'permanent', label: 'Adult' },
		{ value: 'mixed', label: 'Mixed' },
		{ value: 'primary', label: 'Child' }
	];
</script>

<svelte:head>
	<title>{data.patient.fullName} — Dental chart</title>
</svelte:head>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
	<Section title="Dental chart" IconComp={Smile} style="identityIcon" class="lg:col-span-2">
		{#snippet editDialog()}
			<div class="ml-auto flex items-center gap-1" role="group" aria-label="Teeth shown">
				{#each dentitions as d (d.value)}
					<Button
						size="sm"
						variant={dentition === d.value ? 'secondary' : 'ghost'}
						aria-pressed={dentition === d.value}
						onclick={() => (chosenDentition = d.value)}
					>
						{d.label}
					</Button>
				{/each}
			</div>
		{/snippet}
		<div class="flex flex-col gap-4">
			<Odontogram
				{dentition}
				{states}
				selected={selectedTooth}
				onselect={(tooth) => (selectedTooth = selectedTooth === tooth ? null : tooth)}
			/>
		</div>
	</Section>

	<Section
		title={selectedTooth ? `Tooth ${selectedTooth}` : 'Choose a tooth'}
		IconComp={ListChecks}
		style="personalIcon"
	>
		<div class="flex flex-col gap-3">
			{#if selectedTooth}
				<p class="text-sm text-muted-foreground">{toothName(selectedTooth)}</p>
				{#if onSelected.length}
					<ul class="flex flex-col divide-y text-sm">
						{#each onSelected as p (p.id)}
							<li class="flex items-center justify-between gap-2 py-2">
								{#if data.can.clinical}
									<button
										type="button"
										class="text-left underline-offset-2 hover:underline"
										onclick={() => edit(p)}
									>
										{p.service ?? 'Retired service'}
										<span class="text-muted-foreground">{whereLabel(p)}</span>
									</button>
								{:else}
									<span>
										{p.service ?? 'Retired service'}
										<span class="text-muted-foreground">{whereLabel(p)}</span>
									</span>
								{/if}
								<StatusCell status={p.status} />
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-muted-foreground">Nothing charted on this tooth.</p>
				{/if}
				{#if data.can.clinical}
					<Button size="sm" onclick={() => chart(selectedTooth)}>
						<Plus class="size-4" /> Chart on tooth {selectedTooth}
					</Button>
				{/if}
			{:else}
				<p class="text-sm text-muted-foreground">
					Click a tooth to see what is charted on it, or to chart a finding or treatment there.
				</p>
			{/if}
			{#if data.can.clinical}
				<Button size="sm" variant="outline" onclick={() => chart(null)}>
					<Plus class="size-4" /> Chart a whole-mouth procedure
				</Button>
			{/if}
		</div>
	</Section>

	<Section title="Procedures" IconComp={ListChecks} style="systemIcon" class="lg:col-span-3">
		<DataTable
			{columns}
			data={data.procedures}
			search
			facetKeys={['status', 'service']}
			fileName="procedures"
		/>
	</Section>
</div>

<FormDialog
	title="Chart a procedure"
	action="?/addProcedure"
	data={data.forms.add}
	schema={addProcedure}
	bind:open={addOpen}
	seed={addSeed}
	hideTrigger
	resetOnSuccess
	submitLabel="Chart it"
	disabled={!data.can.clinical}
>
	{#snippet fields({ form, errors, values })}
		<ProcedureFields
			{form}
			{errors}
			{values}
			services={data.services}
			providers={data.providers}
			visits={data.visits}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Edit procedure"
	action="?/editProcedure"
	data={data.forms.edit}
	schema={editProcedure}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
	disabled={!data.can.clinical}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		<ProcedureFields
			{form}
			{errors}
			{values}
			services={data.services}
			providers={data.providers}
			visits={data.visits}
		/>
	{/snippet}
</FormDialog>
