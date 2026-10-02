<script lang="ts">
	import { untrack } from 'svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';

	import * as Dialog from '@nahu/admin-kit/components/ui/dialog/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import PatientPicker from '$lib/components/PatientPicker.svelte';
	import { createForm } from '$lib/forms/createForm';
	import { bookAppointment, type BookAppointment } from '$lib/forms/appointmentSchemas';
	import { ethiopianClock, fromClinic } from '$lib/clinicTime';

	type Option = { value: number; name: string; defaultMinutes?: number };

	/**
	 * Booking an appointment, or adding a walk-in.
	 *
	 * Opened three ways: the Book button, a click on an empty slot in the day view (which fills in
	 * the chair and the time), and a patient chart's "Book appointment" (which fills in the patient).
	 * `prefill` carries whichever of those applies and is written into the form each time the dialog
	 * opens — an effect, because the form's stores are created once and the slot clicked is not
	 * known until later.
	 */
	let {
		open = $bindable(false),
		data,
		action = '?/bookAppointment',
		prefill = {},
		patient = null,
		plan = null,
		providers,
		types,
		chairs
	}: {
		open?: boolean;
		data: SuperValidated<BookAppointment>;
		action?: string;
		prefill?: { date?: string; time?: string; operatoryId?: number; walkIn?: boolean };
		patient?: { id: number; name: string; fileNo: string | null } | null;
		/** Booking a treatment plan's agreed work: the plan, and the work the booking will take. */
		plan?: { id: number; work: string[] } | null;
		providers: Option[];
		types: Option[];
		chairs: { id: number; name: string }[];
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, bookAppointment, {
		resetForm: true,
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	$effect(() => {
		if (!open) return;
		const p = prefill;
		untrack(() => {
			if (patient) $form.patientId = patient.id;
			$form.walkIn = Boolean(p.walkIn);
			if (p.date) $form.date = p.date;
			if (p.time) $form.time = p.time;
			if (p.operatoryId) $form.operatoryId = p.operatoryId;
		});
	});

	/*
	 * Choosing a type sets the slot length it implies — the person booking is rarely the person who
	 * knows how long an extraction takes (see `appointment_type.defaultMinutes`). Only when the type
	 * changes, so a duration typed afterwards is left alone.
	 */
	let lastTypeId: number | undefined;
	$effect(() => {
		/*
		 * Compared against the last type seen, not just read. `$form.appointmentTypeId` subscribes to
		 * the whole form store, so writing the duration re-ran this effect and wrote it again —
		 * `effect_update_depth_exceeded` the moment a type was picked. It would also have reset a
		 * hand-typed duration on every keystroke anywhere in the form.
		 */
		const typeId = Number($form.appointmentTypeId) || undefined;
		if (typeId === lastTypeId) return;
		lastTypeId = typeId;
		const minutes = types.find((t) => t.value === typeId)?.defaultMinutes;
		if (minutes) untrack(() => ($form.durationMinutes = minutes));
	});

	const chairOptions = $derived(chairs.map((c) => ({ value: c.id, name: c.name })));

	const ethiopian = $derived(
		$form.date && $form.time && /^\d\d:\d\d$/.test(String($form.time))
			? ethiopianClock(fromClinic(String($form.date), String($form.time)))
			: null
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>{$form.walkIn ? 'Add a walk-in' : 'Book an appointment'}</Dialog.Title>
			<Dialog.Description>
				{$form.walkIn
					? 'The patient is here now. The appointment starts now and is marked arrived.'
					: 'The chair and the dentist are checked for clashes, and closed days are refused.'}
			</Dialog.Description>
		</Dialog.Header>

		<form method="post" {action} use:enhance id="book-appointment" class="flex flex-col gap-4">
			<Errors allErrors={$allErrors} />

			<PatientPicker {form} initial={patient} error={$errors.patientId} />

			{#if plan && patient && Number($form.patientId) === patient.id}
				<!-- The server re-reads the plan's work; the id only says which plan. -->
				<input type="hidden" name="planId" value={plan.id} />
				<div class="rounded-md border p-3 text-sm">
					<p class="font-medium">Booked for the agreed treatment:</p>
					<ul class="mt-1 list-disc pl-5 text-muted-foreground">
						{#each plan.work as line (line)}<li>{line}</li>{/each}
					</ul>
					<p class="mt-1 text-muted-foreground">
						It is reserved to this visit and ticked when the visit is completed.
					</p>
				</div>
			{/if}

			<InputComp
				{form}
				{errors}
				name="walkIn"
				type="checkboxSingle"
				label="Walk-in"
				placeholder="The patient is here now"
			/>

			{#if !$form.walkIn}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<InputComp {form} {errors} name="date" label="Date" type="date" year />
					<InputComp
						{form}
						{errors}
						name="time"
						label="Time"
						type="time"
						step={300}
						description={ethiopian ? `Ethiopian time: ${ethiopian}` : undefined}
					/>
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					name="appointmentTypeId"
					label="What for"
					type="select"
					items={types}
				/>
				<InputComp
					{form}
					{errors}
					name="durationMinutes"
					label="Minutes"
					type="number"
					min={5}
					max={720}
					step={5}
				/>
				<InputComp
					{form}
					{errors}
					name="providerId"
					label="Dentist"
					type="select"
					items={providers}
				/>
				<InputComp
					{form}
					{errors}
					name="operatoryId"
					label="Chair"
					type="select"
					items={chairOptions}
				/>
			</div>

			<InputComp {form} {errors} name="note" label="Note" type="textarea" rows={2} />

			<div class="flex flex-wrap gap-6">
				<InputComp
					{form}
					{errors}
					name="isNewPatient"
					type="checkboxSingle"
					label="First visit"
					placeholder="First visit to the clinic"
				/>
				<InputComp
					{form}
					{errors}
					name="isAsap"
					type="checkboxSingle"
					label="Short notice"
					placeholder="Will come earlier if a slot frees up"
				/>
			</div>

			<Button type="submit" form="book-appointment">
				{#if $delayed}
					<LoadingBtn name="Saving" />
				{:else}
					<CalendarPlus class="size-4" />
					{$form.walkIn ? 'Add walk-in' : 'Book'}
				{/if}
			</Button>
		</form>
	</Dialog.Content>
</Dialog.Root>
