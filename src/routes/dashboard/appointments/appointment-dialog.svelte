<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	import * as Dialog from '@nahu/admin-kit/components/ui/dialog/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import RiskAcknowledgement from '@nahu/admin-kit/formComponents/RiskAcknowledgement.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import CompleteVisit from './complete-visit.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import {
		cancelAppointment,
		changeStatus,
		moveAppointment,
		type CancelAppointment,
		type ChangeStatus,
		type CompleteVisit as CompleteVisitForm,
		type MoveAppointment
	} from '$lib/forms/appointmentSchemas';
	import {
		NEXT_STATUS,
		STATUS_LABEL,
		isAppointmentStatus,
		isMovable,
		type AppointmentStatus
	} from '$lib/appointmentStatus';
	import { clinicClock, clinicDate, ethiopianClock } from '$lib/clinicTime';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { availabilityWarnings, type ProviderAvailability } from '$lib/providerHours';
	import type { DayAppointment } from './types';

	/**
	 * One appointment: what it is, and everything that can happen to it next.
	 *
	 * The status buttons are drawn from `NEXT_STATUS` — the same table the server checks — so a button
	 * here is a move the action will accept. Cancelling asks for a reason; completing asks what was
	 * done (`complete-visit.svelte`); moving is offered only until the visit starts.
	 *
	 * Rendered keyed by the appointment, so each opened appointment seeds its own forms.
	 */
	let {
		open = $bindable(false),
		appointment,
		forms,
		providers,
		availability = {},
		chairs,
		canBook,
		canChart = false
	}: {
		open?: boolean;
		appointment: DayAppointment;
		forms: {
			status: SuperValidated<ChangeStatus>;
			cancel: SuperValidated<CancelAppointment>;
			move: SuperValidated<MoveAppointment>;
			complete: SuperValidated<CompleteVisitForm>;
		};
		providers: { value: number; name: string }[];
		/** Each dentist's week and leave, keyed by provider id, for the hours warning. */
		availability?: Record<number, ProviderAvailability>;
		chairs: { id: number; name: string }[];
		canBook: boolean;
		/** Whether the viewer may record clinical work, which completing a visit offers. */
		canChart?: boolean;
	} = $props();

	const close = {
		onUpdated({ form }: { form: { message?: { type: string } } }) {
			if (form.message?.type === 'success') open = false;
		}
	};

	/* Seeded once from the appointment this dialog was keyed on. */
	// svelte-ignore state_referenced_locally
	const statusForm = createForm(forms.status, changeStatus, close);
	// svelte-ignore state_referenced_locally
	const cancelForm = createForm(forms.cancel, cancelAppointment, close);
	// svelte-ignore state_referenced_locally
	const moveForm = createForm(forms.move, moveAppointment, close);

	const { form: sForm, enhance: sEnhance, delayed: sDelayed } = statusForm;
	const { form: cForm, errors: cErrors, enhance: cEnhance, delayed: cDelayed } = cancelForm;
	const {
		form: mForm,
		errors: mErrors,
		enhance: mEnhance,
		delayed: mDelayed,
		allErrors: mAllErrors
	} = moveForm;

	// svelte-ignore state_referenced_locally
	const a = appointment;
	$sForm.id = a.id;
	$cForm.id = a.id;
	$mForm.id = a.id;
	$mForm.date = clinicDate(a.startsAt);
	$mForm.time = clinicClock(a.startsAt);
	$mForm.durationMinutes = a.durationMinutes;
	$mForm.providerId = a.providerId ?? undefined;
	$mForm.operatoryId = a.operatoryId ?? undefined;

	const status = $derived<AppointmentStatus>(
		isAppointmentStatus(appointment.status) ? appointment.status : 'scheduled'
	);
	// Cancelling and completing each open a panel of their own; the rest are one-click moves.
	const moves = $derived(NEXT_STATUS[status].filter((s) => s !== 'cancelled' && s !== 'completed'));
	const canComplete = $derived(NEXT_STATUS[status].includes('completed'));
	const canCancel = $derived(NEXT_STATUS[status].includes('cancelled'));

	let showCancel = $state(false);
	let showMove = $state(false);
	let showComplete = $state(false);

	/* The dentist's hours against the new slot, by the rule the server refuses with. */
	const hoursWarnings = $derived.by(() => {
		const who = availability[Number($mForm.providerId)];
		const time = String($mForm.time ?? '');
		if (!who || !$mForm.date || !/^\d\d:\d\d$/.test(time)) return [];
		return availabilityWarnings(
			who,
			String($mForm.date),
			time,
			Number($mForm.durationMinutes) || 30
		);
	});

	const chairOptions = $derived(chairs.map((c) => ({ value: c.id, name: c.name })));

	/** "12 min" between two instants, for waiting and chair time. */
	const gap = (from: Date | string | null, to: Date | string | null) =>
		from && to
			? `${Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000))} min`
			: null;
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title class="flex flex-wrap items-center gap-2">
				<DataTableLinks
					id={appointment.patientId}
					name={appointment.patient}
					entity="patient"
					display="inline"
				/>
				<Badge variant="secondary">{STATUS_LABEL[status].label}</Badge>
			</Dialog.Title>
			<Dialog.Description>
				{formatEthiopianDate(new Date(appointment.startsAt))} · {clinicClock(appointment.startsAt)}
				({ethiopianClock(appointment.startsAt)}) · {appointment.durationMinutes} min
			</Dialog.Description>
		</Dialog.Header>

		{#if appointment.severeAllergies.length || appointment.medicineAlerts.length}
			<div class="flex flex-wrap gap-2">
				{#each appointment.severeAllergies as allergy (allergy)}
					<Badge variant="destructive" class="gap-1"
						><TriangleAlert class="size-3" />Severe allergy: {allergy}</Badge
					>
				{/each}
				{#each appointment.medicineAlerts as alert (alert)}
					<Badge class="bg-amber-500 text-white">{alert}</Badge>
				{/each}
			</div>
		{/if}

		{#if appointment.lab}
			<!-- The lab work this visit may be for: back to fit, still out, or late. -->
			<a href="/dashboard/patients/{appointment.patientId}/lab" class="flex flex-wrap gap-2">
				{#if appointment.lab.ready}
					<Badge variant="secondary" class="gap-1"
						><FlaskConical class="size-3" />Lab work back — ready to fit ({appointment.lab
							.ready})</Badge
					>
				{/if}
				{#if appointment.lab.overdue}
					<Badge variant="destructive" class="gap-1"
						><FlaskConical class="size-3" />Overdue from the lab ({appointment.lab.overdue})</Badge
					>
				{:else if appointment.lab.out}
					<Badge variant="outline" class="gap-1"
						><FlaskConical class="size-3" />At the lab ({appointment.lab.out})</Badge
					>
				{/if}
			</a>
		{/if}

		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-muted-foreground">File</dt>
			<dd>{appointment.fileNo ?? '—'}{appointment.phone ? ` · ${appointment.phone}` : ''}</dd>
			<dt class="text-muted-foreground">For</dt>
			<dd>{appointment.type ?? 'Not given'}</dd>
			<dt class="text-muted-foreground">Dentist</dt>
			<dd>{appointment.provider ?? 'Not assigned'}</dd>
			<dt class="text-muted-foreground">Chair</dt>
			<dd>{appointment.chair ?? 'Not assigned'}</dd>
			{#if appointment.note}
				<dt class="text-muted-foreground">Note</dt>
				<dd class="whitespace-pre-line">{appointment.note}</dd>
			{/if}
			{#if appointment.arrivedAt}
				<dt class="text-muted-foreground">Arrived</dt>
				<dd>
					{clinicClock(appointment.arrivedAt)}
					{#if gap(appointment.arrivedAt, appointment.seatedAt)}· waited {gap(
							appointment.arrivedAt,
							appointment.seatedAt
						)}{/if}
				</dd>
			{/if}
			{#if appointment.dismissedAt}
				<dt class="text-muted-foreground">Finished</dt>
				<dd>
					{clinicClock(appointment.dismissedAt)}
					{#if gap(appointment.seatedAt, appointment.dismissedAt)}· in chair {gap(
							appointment.seatedAt,
							appointment.dismissedAt
						)}{/if}
				</dd>
			{/if}
			{#if appointment.cancelReason}
				<dt class="text-muted-foreground">Cancelled</dt>
				<dd>{appointment.cancelReason}</dd>
			{/if}
		</dl>

		<div class="flex flex-wrap gap-2">
			<Button variant="ghost" size="sm" href="/dashboard/patients/{appointment.patientId}">
				<ExternalLink class="size-4" /> Patient chart
			</Button>
		</div>

		{#if canBook}
			{#if moves.length}
				<form
					method="post"
					action="?/changeAppointmentStatus"
					use:sEnhance
					class="flex flex-wrap gap-2 border-t pt-4"
				>
					<input type="hidden" name="id" value={appointment.id} />
					{#each moves as next (next)}
						<Button
							type="submit"
							name="to"
							value={next}
							size="sm"
							variant={next === 'noShow' || next === 'scheduled' ? 'outline' : 'default'}
							disabled={$sDelayed}
							onclick={() => ($sForm.to = next)}
						>
							{STATUS_LABEL[next].action}
						</Button>
					{/each}
				</form>
			{/if}

			<div class="flex flex-wrap gap-2">
				{#if canComplete}
					<Button size="sm" onclick={() => (showComplete = !showComplete)}>
						{STATUS_LABEL.completed.action}
					</Button>
				{/if}
				{#if isMovable(status)}
					<Button variant="outline" size="sm" onclick={() => (showMove = !showMove)}>Move</Button>
				{/if}
				{#if canCancel}
					<Button variant="outline" size="sm" onclick={() => (showCancel = !showCancel)}>
						Cancel appointment
					</Button>
				{/if}
			</div>

			{#if showComplete}
				<CompleteVisit
					{appointment}
					data={forms.complete}
					{canChart}
					ondone={() => (open = false)}
				/>
			{/if}

			{#if showMove}
				<form
					method="post"
					action="?/moveAppointment"
					use:mEnhance
					id="move-{appointment.id}"
					class="flex flex-col gap-3 rounded-md border p-3"
				>
					<Errors allErrors={$mAllErrors} />
					<input type="hidden" name="id" value={appointment.id} />
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<InputComp form={mForm} errors={mErrors} name="date" label="Date" type="date" year />
						<InputComp
							form={mForm}
							errors={mErrors}
							name="time"
							label="Time"
							type="time"
							step={300}
						/>
						<InputComp
							form={mForm}
							errors={mErrors}
							name="durationMinutes"
							label="Minutes"
							type="number"
							min={5}
							step={5}
						/>
						<InputComp
							form={mForm}
							errors={mErrors}
							name="providerId"
							label="Dentist"
							type="select"
							items={providers}
						/>
						<InputComp
							form={mForm}
							errors={mErrors}
							name="operatoryId"
							label="Chair"
							type="select"
							items={chairOptions}
						/>
					</div>
					<RiskAcknowledgement
						show={hoursWarnings.length > 0}
						name="hoursAcknowledged"
						title="The dentist is not working then"
						message={hoursWarnings.join(' ')}
						confirmLabel="Book anyway"
						bind:checked={$mForm.hoursAcknowledged}
					/>
					<Button
						type="submit"
						size="sm"
						form="move-{appointment.id}"
						disabled={$mDelayed || (hoursWarnings.length > 0 && !$mForm.hoursAcknowledged)}
					>
						{#if $mDelayed}<LoadingBtn name="Moving" />{:else}Move appointment{/if}
					</Button>
				</form>
			{/if}

			{#if showCancel}
				<form
					method="post"
					action="?/cancelAppointment"
					use:cEnhance
					id="cancel-{appointment.id}"
					class="flex flex-col gap-3 rounded-md border border-destructive/40 p-3"
				>
					<input type="hidden" name="id" value={appointment.id} />
					<InputComp
						form={cForm}
						errors={cErrors}
						name="reason"
						label="Why is it cancelled?"
						type="textarea"
						rows={2}
						required
					/>
					<Button type="submit" size="sm" variant="destructive" form="cancel-{appointment.id}">
						{#if $cDelayed}<LoadingBtn name="Cancelling" />{:else}Cancel appointment{/if}
					</Button>
				</form>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
