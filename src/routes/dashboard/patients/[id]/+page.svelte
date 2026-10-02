<script lang="ts">
	import User from '@lucide/svelte/icons/user';
	import Phone from '@lucide/svelte/icons/phone';
	import HeartPulse from '@lucide/svelte/icons/heart-pulse';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Pill from '@lucide/svelte/icons/pill';
	import Stethoscope from '@lucide/svelte/icons/stethoscope';
	import Siren from '@lucide/svelte/icons/siren';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Settings from '@lucide/svelte/icons/settings';
	import Eye from '@lucide/svelte/icons/eye';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { clinicClock, clinicDate } from '$lib/clinicTime';
	import { STATUS_LABEL, isAppointmentStatus } from '$lib/appointmentStatus';

	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import Section from '$lib/components/Section.svelte';
	import SingleTable from '$lib/components/SingleTable.svelte';
	import LookupSection from '$lib/components/lookup/LookupSection.svelte';
	import { childActionPaths } from '@nahu/admin-kit/components/lookup/actions.js';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import MergeSection from './MergeSection.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { viewedLabel } from '$lib/accessLog';

	import {
		BLOOD_TYPE_OPTIONS,
		SEX_OPTIONS,
		addAllergy,
		addCondition,
		addContact,
		addEmergencyContact,
		addMedication,
		editAllergy,
		editCondition,
		editContact,
		editEmergencyContact,
		editHistory,
		editIdentity,
		editMedication,
		editReach
	} from '../schema';
	import {
		allergyConfig,
		conditionConfig,
		contactConfig,
		emergencyContactConfig,
		medicationConfig
	} from './configs';

	let { data } = $props();

	const p = $derived(data.patient);
	const base = $derived(`/dashboard/patients/${p.id}`);

	const dateOf = (value: Date | string | null | undefined) =>
		value ? formatEthiopianDate(new Date(value)) : '—';

	const ageText = $derived(
		p.age === null ? 'Not recorded' : `${p.birthDateEstimated ? 'About ' : ''}${p.age} years`
	);

	const identityRows = $derived([
		{ name: 'Full name', value: p.fullName },
		{ name: 'File number', value: p.fileNo ?? 'Not assigned' },
		{ name: 'Sex', value: p.sex === 'female' ? 'Female' : 'Male' },
		{
			name: 'Birth date',
			value: p.birthDate
				? `${dateOf(p.birthDate)}${p.birthDateEstimated ? ' (estimated from age)' : ''}`
				: 'Not recorded'
		},
		{ name: 'Age', value: ageText },
		{ name: 'Blood type', value: p.bloodType ?? 'Not recorded' }
	]);

	const reachRows = $derived([
		{ name: 'Phone', value: p.phone ?? '—' },
		{ name: 'Second phone', value: p.altPhone ?? '—' },
		{ name: 'Heard of us through', value: p.referral ?? 'Not asked' },
		{ name: 'Referred by', value: p.referredBy ?? '—' },
		{ name: 'Billed to', value: p.customer ?? 'Pays at the desk' },
		{ name: 'Registered at', value: p.branch ?? '—' }
	]);

	const summaryRows = $derived([
		{ name: 'Next appointment', value: dateOf(data.summary.nextAppointment) },
		{ name: 'Last visit', value: dateOf(data.summary.lastVisit) },
		{
			name: 'Visits',
			value: `${data.summary.completedVisits} completed of ${data.summary.visits} booked · ${data.summary.noShows} no-shows`
		},
		{ name: 'Open treatment plans', value: data.summary.openPlans },
		{ name: 'Prescriptions', value: data.summary.prescriptions },
		{ name: 'Billed', value: formatETB(data.summary.billed) },
		{ name: 'Paid', value: formatETB(data.summary.paid) },
		{ name: 'Balance', value: formatETB(data.summary.balance) },
		{
			name: 'Files · notes · consents',
			value: `${data.summary.files} · ${data.summary.notes} · ${data.summary.consents}`
		}
	]);

	const systemRows = $derived([
		{ name: 'Registered on', value: dateOf(p.createdAt) },
		{ name: 'Registered by', value: p.createdBy ?? 'Unknown' },
		{ name: 'Last updated', value: dateOf(p.updatedAt) },
		{ name: 'Last updated by', value: p.updatedBy ?? 'Never updated' }
	]);
</script>

<svelte:head>
	<title>{p.fullName} — Patient</title>
</svelte:head>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
	<Section title="Personal details" IconComp={User} style="identityIcon">
		{#snippet editDialog()}
			<FormDialog
				title="Edit personal details"
				action="?/editIdentity"
				data={data.forms.identity}
				schema={editIdentity}
				disabled={!data.can.edit}
			>
				{#snippet fields({ form, errors, values })}
					<InputComp {form} {errors} name="name" label="Given name" required />
					<InputComp {form} {errors} name="fatherName" label="Father’s name" required />
					<InputComp {form} {errors} name="grandFatherName" label="Grandfather’s name" />
					<InputComp {form} {errors} name="fileNo" label="File number" />
					<InputComp {form} {errors} name="sex" label="Sex" type="select" items={SEX_OPTIONS} />
					<InputComp
						{form}
						{errors}
						name="bloodType"
						label="Blood type"
						type="select"
						items={BLOOD_TYPE_OPTIONS}
					/>
					<InputComp
						{form}
						{errors}
						name="knowsBirthDate"
						type="checkboxSingle"
						label="Birth date"
						placeholder="The patient knows their date of birth"
					/>
					{#if values.knowsBirthDate}
						<InputComp {form} {errors} name="birthDate" label="Date of birth" type="date" year />
					{:else}
						<InputComp
							{form}
							{errors}
							name="ageYears"
							label="Approximate age"
							type="number"
							min={0}
							max={120}
						/>
					{/if}
				{/snippet}
			</FormDialog>
		{/snippet}
		<SingleTable singleTable={identityRows} />
	</Section>

	<Section title="Reaching them, and billing" IconComp={Phone} style="employmentIcon">
		{#snippet editDialog()}
			<FormDialog
				title="Edit contact and billing"
				action="?/editReach"
				data={data.forms.reach}
				schema={editReach}
				disabled={!data.can.edit}
			>
				{#snippet fields({ form, errors })}
					<InputComp {form} {errors} name="phone" label="Phone" type="tel" />
					<InputComp {form} {errors} name="altPhone" label="Second phone" type="tel" />
					<InputComp
						{form}
						{errors}
						name="referralSourceId"
						label="Heard of us through"
						type="combo"
						items={data.options.referrals}
					/>
					<InputComp {form} {errors} name="referredBy" label="Referred by" />
					<InputComp
						{form}
						{errors}
						name="customerId"
						label="Billed to"
						type="combo"
						items={data.options.customers}
					/>
				{/snippet}
			</FormDialog>
		{/snippet}
		<SingleTable singleTable={reachRows} />
	</Section>

	<Section title="Medical history" IconComp={HeartPulse} style="addressIcon">
		{#snippet editDialog()}
			<FormDialog
				title="Medical history"
				action="?/editHistory"
				data={data.forms.history}
				schema={editHistory}
				disabled={!data.can.clinical}
			>
				{#snippet fields({ form, errors })}
					<InputComp
						{form}
						{errors}
						name="medicalNotes"
						label="Notes"
						type="textarea"
						rows={8}
						placeholder="Family history, past surgery — anything that is not an allergy, condition or medicine"
					/>
					<InputComp
						{form}
						{errors}
						name="markTaken"
						type="checkboxSingle"
						label="History"
						placeholder="I asked the medical history questions today"
					/>
				{/snippet}
			</FormDialog>
		{/snippet}
		<div class="flex flex-col gap-3">
			<p class="text-sm">
				{#if p.historyTakenAt}
					Taken {dateOf(p.historyTakenAt)}{p.historyTakenBy ? ` by ${p.historyTakenBy}` : ''}.
				{:else}
					<span class="font-semibold text-destructive">Never taken.</span>
				{/if}
			</p>
			<p class="text-sm whitespace-pre-line text-muted-foreground">
				{p.medicalNotes || 'No other notes.'}
			</p>
		</div>
	</Section>

	<Section title="Allergies" IconComp={TriangleAlert} style="addressIcon" class="lg:col-span-3">
		<LookupSection
			config={allergyConfig}
			rows={data.sections.allergy.rows}
			addForm={data.sections.allergy.addForm}
			editForm={data.sections.allergy.editForm}
			options={data.options.allergy}
			actions={childActionPaths('Allergy')}
			schemas={{ add: addAllergy, edit: editAllergy }}
			readonly={!data.can.clinical}
			canDelete={data.can.clinical}
		/>
	</Section>

	<Section title="Conditions" IconComp={Stethoscope} style="personalIcon" class="lg:col-span-3">
		<LookupSection
			config={conditionConfig}
			rows={data.sections.condition.rows}
			addForm={data.sections.condition.addForm}
			editForm={data.sections.condition.editForm}
			options={data.options.condition}
			actions={childActionPaths('Condition')}
			schemas={{ add: addCondition, edit: editCondition }}
			readonly={!data.can.clinical}
			canDelete={data.can.clinical}
		/>
	</Section>

	<Section title="Medications" IconComp={Pill} style="personalIcon" class="lg:col-span-3">
		<LookupSection
			config={medicationConfig}
			rows={data.sections.medication.rows}
			addForm={data.sections.medication.addForm}
			editForm={data.sections.medication.editForm}
			options={data.options.medication}
			actions={childActionPaths('Medication')}
			schemas={{ add: addMedication, edit: editMedication }}
			readonly={!data.can.clinical}
			canDelete={data.can.clinical}
		/>
	</Section>

	<Section title="Other contacts" IconComp={Phone} style="employmentIcon" class="lg:col-span-3">
		<LookupSection
			config={contactConfig}
			rows={data.sections.contact.rows}
			addForm={data.sections.contact.addForm}
			editForm={data.sections.contact.editForm}
			options={data.options.contact}
			actions={childActionPaths('Contact')}
			schemas={{ add: addContact, edit: editContact }}
			readonly={!data.can.edit}
			canDelete={data.can.edit}
		/>
	</Section>

	<Section title="Emergency contacts" IconComp={Siren} style="addressIcon" class="lg:col-span-3">
		<LookupSection
			config={emergencyContactConfig}
			rows={data.sections.emergency.rows}
			addForm={data.sections.emergency.addForm}
			editForm={data.sections.emergency.editForm}
			actions={childActionPaths('EmergencyContact')}
			schemas={{ add: addEmergencyContact, edit: editEmergencyContact }}
			readonly={!data.can.edit}
			canDelete={data.can.edit}
		/>
	</Section>

	<Section title="Appointments" IconComp={CalendarDays} style="systemIcon" class="lg:col-span-3">
		{#snippet editDialog()}
			{#if data.can.book}
				<Button size="sm" class="ml-auto" href="/dashboard/appointments?book={p.id}">
					<CalendarPlus class="size-4" /> Book appointment
				</Button>
			{/if}
		{/snippet}
		<!-- When they are next due back, so whoever has the chart open can book it there and then. -->
		<p class="mb-2 text-sm">
			{#if data.nextRecall}
				<span class="text-muted-foreground">Next due back:</span>
				{data.nextRecall.visit ?? 'A visit'} · {dateOf(data.nextRecall.dueOn)}
				{#if data.nextRecall.status === 'booked'}
					<Badge variant="secondary">Booked</Badge>
				{:else if data.nextRecall.dueOn < data.today}
					<Badge variant="destructive">Overdue</Badge>
				{/if}
			{:else}
				<span class="text-muted-foreground">No recall is set for this patient.</span>
			{/if}
		</p>
		{#if data.appointments.length}
			<ul class="flex flex-col divide-y text-sm">
				{#each data.appointments as a (a.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2">
						<a
							class="underline-offset-2 hover:underline"
							href="/dashboard/appointments?date={clinicDate(a.startsAt)}&open={a.id}"
						>
							{dateOf(a.startsAt)} · {clinicClock(a.startsAt)}
						</a>
						<span class="text-muted-foreground">
							{a.type ?? 'Appointment'}{a.provider ? ` · ${a.provider}` : ''}{a.chair
								? ` · ${a.chair}`
								: ''}
						</span>
						<Badge
							variant={a.status === 'cancelled' || a.status === 'noShow' ? 'outline' : 'secondary'}
						>
							{isAppointmentStatus(a.status) ? STATUS_LABEL[a.status].label : a.status}
						</Badge>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">No appointments yet.</p>
		{/if}
	</Section>

	<Section
		title="Clinical record"
		IconComp={ClipboardList}
		style="systemIcon"
		class="lg:col-span-2"
	>
		<!-- Counts only: each of these has its own tab, where it is read and changed. -->
		<SingleTable singleTable={summaryRows} />
	</Section>

	<Section title="System information" IconComp={Settings} style="systemIcon">
		<SingleTable singleTable={systemRows} />
	</Section>

	{#if data.merge}
		<MergeSection
			duplicates={data.merge.duplicates}
			form={data.merge.form}
			pick={data.merge.pick}
		/>
	{/if}

	{#if data.can.seeViews && data.recentViews}
		<Section title="Who opened this chart" IconComp={Eye} style="systemIcon" class="lg:col-span-3">
			<ul class="flex flex-col divide-y text-sm">
				{#each data.recentViews as view (view.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2">
						<DataTableLinks
							id={view.userId}
							name={view.user ?? 'Deleted user'}
							entity="user"
							display="inline"
						/>
						<span class="text-muted-foreground">
							{viewedLabel(view.action, view.recordType)} · {view.branch ?? 'no branch'} · {dateOf(
								view.viewedAt
							)}
							{clinicClock(view.viewedAt)}
						</span>
					</li>
				{:else}
					<li class="py-2 text-muted-foreground">No views recorded.</li>
				{/each}
			</ul>
			<a class="mt-2 inline-block text-sm underline-offset-2 hover:underline" href="{base}/access">
				The whole access log →
			</a>
		</Section>
	{/if}
</div>
