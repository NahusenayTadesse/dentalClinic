<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Save from '@lucide/svelte/icons/save';
	import Trash from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import RiskAcknowledgement from '$lib/formComponents/RiskAcknowledgement.svelte';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';
	import { createForm } from '$lib/forms/createForm';
	import { allergyClashes, type ChartAllergy } from '$lib/allergyClash';
	import { newPrescription, type NewPrescription, type PrescriptionItem } from './schema';

	/**
	 * Writing a prescription: the allergies and current medicines to read first, then who, why, and
	 * each medicine with how to take it.
	 *
	 * The allergy check runs as each medicine is chosen, by the rule the server refuses with
	 * (`$lib/allergyClash.ts`), so a clash is seen at the moment of choosing rather than on submit.
	 * Writing through a clash takes a tick, which the server records.
	 */
	type Medicine = {
		id: number;
		genericName: string;
		strength: string | null;
		form: string;
		isAntibiotic: boolean;
		allergenId: number | null;
		notes: string | null;
	};

	let {
		data,
		medicines,
		allergies,
		currentMedicines,
		prescribers,
		visits,
		onsaved
	}: {
		data: SuperValidated<NewPrescription>;
		medicines: Medicine[];
		allergies: ChartAllergy[];
		currentMedicines: { name: string; detail: string | null }[];
		prescribers: { value: string; name: string }[];
		visits: { value: string; name: string }[];
		/** Called once the prescription is written — the dialog closes itself with it. */
		onsaved?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, newPrescription, {
		dataType: 'json',
		resetForm: true,
		onUpdated({ form }) {
			if (form.message?.type === 'success') onsaved?.();
		}
	});

	const blank = (): PrescriptionItem => ({
		medicineId: 0,
		dose: '',
		frequency: '',
		durationDays: 0,
		quantity: '',
		instructions: ''
	});

	function setItem(index: number, change: Partial<PrescriptionItem>) {
		form.update((f) => ({
			...f,
			items: f.items.map((item, i) => (i === index ? { ...item, ...change } : item))
		}));
	}
	const addItem = () => form.update((f) => ({ ...f, items: [...f.items, blank()] }));
	const removeItem = (index: number) =>
		form.update((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));

	// A new sheet starts with one empty line.
	$effect(() => {
		if (!$form.items.length) form.update((f) => ({ ...f, items: [blank()] }), { taint: false });
	});

	const medicineItems = $derived(
		medicines.map((m) => ({
			value: String(m.id),
			name: [m.genericName, m.strength, m.form].filter(Boolean).join(' · ')
		}))
	);
	const byId = $derived(new Map(medicines.map((m) => [m.id, m])));

	/** Each line's clash with the chart, as the server will judge it. */
	const clashes = $derived(
		$form.items.map((item) => {
			const med = byId.get(item.medicineId);
			return med ? allergyClashes(allergies, med) : [];
		})
	);
	const anyClash = $derived(clashes.some((c) => c.length));
	const visitItems = $derived([{ value: '', name: 'Not from one visit' }, ...visits]);
</script>

<form method="post" action="?/add" use:enhance class="flex flex-col gap-4">
	<Errors allErrors={$allErrors} />

	<section class="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2" aria-label="Read first">
		<div>
			<p class="font-semibold">Allergies</p>
			{#if allergies.length}
				<div class="mt-1 flex flex-wrap gap-1">
					{#each allergies as allergy (allergy.allergenId)}
						<Badge variant={allergy.severity === 'severe' ? 'destructive' : 'outline'}>
							{allergy.name}{allergy.severity === 'unknown' ? '' : ` · ${allergy.severity}`}
						</Badge>
					{/each}
				</div>
			{:else}
				<p class="text-muted-foreground">None recorded — check the history is current.</p>
			{/if}
		</div>
		<div>
			<p class="font-semibold">Takes now</p>
			{#if currentMedicines.length}
				<ul class="mt-1 list-disc pl-4">
					{#each currentMedicines as med (med.name)}
						<li>{med.name}{med.detail ? ` — ${med.detail}` : ''}</li>
					{/each}
				</ul>
			{:else}
				<p class="text-muted-foreground">Nothing recorded.</p>
			{/if}
		</div>
	</section>

	<div class="grid gap-3 sm:grid-cols-2">
		<InputComp
			label="Prescriber"
			name="providerId"
			type="select"
			{form}
			{errors}
			items={prescribers}
		/>
		<InputComp
			label="Visit"
			name="appointmentId"
			type="select"
			{form}
			{errors}
			items={visitItems}
			required={false}
		/>
		<InputComp
			label="What it is for"
			name="indication"
			{form}
			{errors}
			placeholder="Acute apical abscess 36, facial swelling"
		/>
		<InputComp
			label="Weight (kg)"
			name="weightKg"
			type="number"
			{form}
			{errors}
			required={false}
			description="Taken today. Needed for a child's dose; leave 0 for an adult if not weighed."
		/>
	</div>

	<fieldset class="flex flex-col gap-3">
		<legend class="mb-2 text-sm font-semibold">Medicines</legend>
		{#each $form.items as item, i (i)}
			{@const med = byId.get(item.medicineId)}
			<div class="flex flex-col gap-2 rounded-md border p-3">
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<SelectComp
							name="medicine-{i}"
							label="medicine"
							items={medicineItems}
							value={item.medicineId ? String(item.medicineId) : ''}
							onValueChange={(v: string) => setItem(i, { medicineId: Number(v) || 0 })}
						/>
					</div>
					{#if med?.isAntibiotic}<Badge variant="secondary">Antibiotic</Badge>{/if}
					{#if $form.items.length > 1}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Take this medicine off"
							onclick={() => removeItem(i)}
						>
							<Trash class="size-4" />
						</Button>
					{/if}
				</div>
				{#if clashes[i]?.length}
					<p class="flex items-center gap-2 text-sm font-medium text-destructive" role="alert">
						<TriangleAlert class="size-4 shrink-0" />
						Allergy on the chart: {clashes[i].map((a) => a.name).join(', ')}
					</p>
				{/if}
				{#if med?.notes}<p class="text-xs text-muted-foreground">{med.notes}</p>{/if}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<Label class="flex flex-col items-start gap-1 text-xs">
						Dose
						<Input
							value={item.dose}
							placeholder="500mg"
							oninput={(e) => setItem(i, { dose: e.currentTarget.value })}
						/>
					</Label>
					<Label class="flex flex-col items-start gap-1 text-xs">
						How often
						<Input
							value={item.frequency}
							placeholder="Three times a day"
							oninput={(e) => setItem(i, { frequency: e.currentTarget.value })}
						/>
					</Label>
					<Label class="flex flex-col items-start gap-1 text-xs">
						Days
						<Input
							type="number"
							min="0"
							max="365"
							value={item.durationDays || ''}
							oninput={(e) => setItem(i, { durationDays: Number(e.currentTarget.value) || 0 })}
						/>
					</Label>
					<Label class="flex flex-col items-start gap-1 text-xs">
						Quantity
						<Input
							value={item.quantity}
							placeholder="21 capsules"
							oninput={(e) => setItem(i, { quantity: e.currentTarget.value })}
						/>
					</Label>
				</div>
				<Label class="flex flex-col items-start gap-1 text-xs">
					What the patient is told
					<Input
						value={item.instructions}
						placeholder="After food. Finish the course."
						oninput={(e) => setItem(i, { instructions: e.currentTarget.value })}
					/>
				</Label>
			</div>
		{/each}
		{#if $form.items.length < 10}
			<Button type="button" variant="outline" size="sm" class="self-start" onclick={addItem}>
				<Plus class="size-4" /> Another medicine
			</Button>
		{/if}
	</fieldset>

	<InputComp label="Notes" name="notes" type="textarea" rows={2} {form} {errors} required={false} />

	<RiskAcknowledgement
		show={anyClash}
		title="This prescription clashes with an allergy on the chart"
		message="Change the medicine, or confirm you have checked with the patient. Your confirmation is recorded."
		confirmLabel="I have checked, and prescribe it anyway"
		bind:checked={$form.allergyAcknowledged}
	/>

	<Button type="submit" disabled={$delayed || (anyClash && !$form.allergyAcknowledged)}>
		{#if $delayed}
			<LoadingBtn name="Writing" />
		{:else}
			<Save class="size-4" /> Write the prescription
		{/if}
	</Button>
</form>
