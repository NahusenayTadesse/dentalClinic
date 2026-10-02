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
	import { isAppointmentStatus } from '$lib/appointmentStatus';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import { childActionPaths } from '@nahu/admin-kit/components/lookup/actions.js';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
	import MergeSection from './MergeSection.svelte';
	import HistoryFormLinks from './HistoryFormLinks.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { viewedLabel } from '$lib/accessLog';

	import {
		BLOOD_TYPE_OPTIONS,
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

	const t = useI18n();
	const pm = $derived(t.m.patients);
	const o = $derived(pm.overview);
	const r = $derived(o.rows);
	const sexOptions = $derived([
		{ value: 'female', name: pm.sex.female },
		{ value: 'male', name: pm.sex.male }
	]);
	// The sections' tables and forms, rebuilt when the language changes.
	const configs = $derived({
		allergy: allergyConfig(t.m),
		condition: conditionConfig(t.m),
		medication: medicationConfig(t.m),
		contact: contactConfig(t.m),
		emergency: emergencyContactConfig(t.m)
	});

	const p = $derived(data.patient);
	const base = $derived(`/dashboard/patients/${p.id}`);

	const dateOf = (value: Date | string | null | undefined) =>
		value ? formatEthiopianDate(new Date(value)) : '—';

	const ageText = $derived(
		p.age === null ? o.notRecordedShort : o.ageYears(p.age, p.birthDateEstimated)
	);

	const identityRows = $derived([
		{ name: r.fullName, value: p.fullName },
		{ name: r.fileNo, value: p.fileNo ?? o.notAssigned },
		{ name: r.sex, value: pm.sex[p.sex] },
		{
			name: r.birthDate,
			value: p.birthDate
				? `${dateOf(p.birthDate)}${p.birthDateEstimated ? o.estimatedFromAge : ''}`
				: o.notRecordedShort
		},
		{ name: r.age, value: ageText },
		{ name: r.bloodType, value: p.bloodType ?? o.notRecordedShort }
	]);

	const reachRows = $derived([
		{ name: r.phone, value: p.phone ?? '—' },
		{ name: r.altPhone, value: p.altPhone ?? '—' },
		{ name: r.textMessages, value: p.smsOptOut ? r.textsNo : r.textsYes },
		{ name: r.heardThrough, value: p.referral ?? o.notAsked },
		{ name: r.referredBy, value: p.referredBy ?? '—' },
		{ name: r.billedTo, value: p.customer ?? pm.payAtDesk },
		...(p.customer ? [{ name: r.memberNo, value: p.payerMemberNo ?? '—' }] : []),
		{ name: r.registeredAt, value: p.branch ?? '—' }
	]);

	const summaryRows = $derived([
		{ name: r.nextAppointment, value: dateOf(data.summary.nextAppointment) },
		{ name: r.lastVisit, value: dateOf(data.summary.lastVisit) },
		{
			name: r.visits,
			value: o.visitCounts(data.summary.completedVisits, data.summary.visits, data.summary.noShows)
		},
		{ name: r.openPlans, value: data.summary.openPlans },
		{ name: r.prescriptions, value: data.summary.prescriptions },
		{ name: r.billed, value: formatETB(data.summary.billed) },
		{ name: r.paid, value: formatETB(data.summary.paid) },
		{ name: r.balance, value: formatETB(data.summary.balance) },
		{
			name: r.filesNotesConsents,
			value: `${data.summary.files} · ${data.summary.notes} · ${data.summary.consents}`
		}
	]);

	const systemRows = $derived([
		{ name: r.registeredOn, value: dateOf(p.createdAt) },
		{ name: r.registeredBy, value: p.createdBy ?? o.unknown },
		{ name: r.lastUpdated, value: dateOf(p.updatedAt) },
		{ name: r.lastUpdatedBy, value: p.updatedBy ?? o.neverUpdated }
	]);
</script>

<svelte:head>
	<title>{o.pageTitle(p.fullName)}</title>
</svelte:head>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
	<Section title={o.sections.personal} IconComp={User} style="identityIcon">
		{#snippet editDialog()}
			<FormDialog
				title={o.sections.editPersonal}
				action="?/editIdentity"
				data={data.forms.identity}
				schema={editIdentity}
				disabled={!data.can.edit}
			>
				{#snippet fields({ form, errors, values })}
					<InputComp {form} {errors} name="name" label={pm.register.givenName} required />
					<InputComp {form} {errors} name="fatherName" label={pm.register.fatherName} required />
					<InputComp {form} {errors} name="grandFatherName" label={pm.register.grandFatherName} />
					<InputComp {form} {errors} name="fileNo" label={pm.register.fileNo} />
					<InputComp
						{form}
						{errors}
						name="sex"
						label={pm.register.sex}
						type="select"
						items={sexOptions}
					/>
					<InputComp
						{form}
						{errors}
						name="bloodType"
						label={pm.register.bloodType}
						type="select"
						items={BLOOD_TYPE_OPTIONS}
					/>
					<InputComp
						{form}
						{errors}
						name="knowsBirthDate"
						type="checkboxSingle"
						label={pm.register.birthDate}
						placeholder={pm.register.knowsBirthDate}
					/>
					{#if values.knowsBirthDate}
						<InputComp
							{form}
							{errors}
							name="birthDate"
							label={pm.register.dateOfBirth}
							type="date"
							year
						/>
					{:else}
						<InputComp
							{form}
							{errors}
							name="ageYears"
							label={pm.register.approxAge}
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

	<Section title={o.sections.reach} IconComp={Phone} style="employmentIcon">
		{#snippet editDialog()}
			<FormDialog
				title={o.sections.editReach}
				action="?/editReach"
				data={data.forms.reach}
				schema={editReach}
				disabled={!data.can.edit}
			>
				{#snippet fields({ form, errors })}
					<InputComp {form} {errors} name="phone" label={pm.register.phone} type="tel" />
					<InputComp {form} {errors} name="altPhone" label={pm.register.altPhone} type="tel" />
					<InputComp
						{form}
						{errors}
						name="smsOptOut"
						type="checkboxSingle"
						label={r.textMessages}
						placeholder={r.textsOptOut}
					/>
					<InputComp
						{form}
						{errors}
						name="referralSourceId"
						label={pm.register.heardThrough}
						type="combo"
						items={data.options.referrals}
					/>
					<InputComp {form} {errors} name="referredBy" label={pm.register.referredBy} />
					<InputComp
						{form}
						{errors}
						name="customerId"
						label={pm.register.billedTo}
						type="combo"
						items={data.options.customers}
					/>
					<InputComp
						{form}
						{errors}
						name="payerMemberNo"
						label={r.memberNo}
						required={false}
						placeholder={r.memberNoPlaceholder}
					/>
				{/snippet}
			</FormDialog>
		{/snippet}
		<SingleTable singleTable={reachRows} />
	</Section>

	<Section title={o.sections.history} IconComp={HeartPulse} style="addressIcon">
		{#snippet editDialog()}
			<FormDialog
				title={o.sections.history}
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
						label={o.historyNotes}
						type="textarea"
						rows={8}
						placeholder={o.historyNotesPlaceholder}
					/>
					<InputComp
						{form}
						{errors}
						name="markTaken"
						type="checkboxSingle"
						label={o.historyMark}
						placeholder={o.historyMarkConfirm}
					/>
				{/snippet}
			</FormDialog>
		{/snippet}
		<div class="flex flex-col gap-3">
			<p class="text-sm">
				{#if p.historyTakenAt}
					{o.historyTaken(dateOf(p.historyTakenAt), p.historyTakenBy)}
				{:else}
					<span class="font-semibold text-destructive">{o.historyNever}</span>
				{/if}
			</p>
			<p class="text-sm whitespace-pre-line text-muted-foreground">
				{p.medicalNotes || o.noOtherNotes}
			</p>
			<HistoryFormLinks patientId={p.id} />
		</div>
	</Section>

	<Section
		title={o.sections.allergies}
		IconComp={TriangleAlert}
		style="addressIcon"
		class="lg:col-span-3"
	>
		<LookupSection
			config={configs.allergy}
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

	<Section
		title={o.sections.conditions}
		IconComp={Stethoscope}
		style="personalIcon"
		class="lg:col-span-3"
	>
		<LookupSection
			config={configs.condition}
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

	<Section
		title={o.sections.medications}
		IconComp={Pill}
		style="personalIcon"
		class="lg:col-span-3"
	>
		<LookupSection
			config={configs.medication}
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

	<Section
		title={o.sections.contacts}
		IconComp={Phone}
		style="employmentIcon"
		class="lg:col-span-3"
	>
		<LookupSection
			config={configs.contact}
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

	<Section title={o.sections.emergency} IconComp={Siren} style="addressIcon" class="lg:col-span-3">
		<LookupSection
			config={configs.emergency}
			rows={data.sections.emergency.rows}
			addForm={data.sections.emergency.addForm}
			editForm={data.sections.emergency.editForm}
			actions={childActionPaths('EmergencyContact')}
			schemas={{ add: addEmergencyContact, edit: editEmergencyContact }}
			readonly={!data.can.edit}
			canDelete={data.can.edit}
		/>
	</Section>

	<Section
		title={o.sections.appointments}
		IconComp={CalendarDays}
		style="systemIcon"
		class="lg:col-span-3"
	>
		{#snippet editDialog()}
			{#if data.can.book}
				<Button size="sm" class="ml-auto" href="/dashboard/appointments?book={p.id}">
					<CalendarPlus class="size-4" />
					{o.bookAppointment}
				</Button>
			{/if}
		{/snippet}
		<!-- When they are next due back, so whoever has the chart open can book it there and then. -->
		<p class="mb-2 text-sm">
			{#if data.nextRecall}
				<span class="text-muted-foreground">{o.nextDue}</span>
				{data.nextRecall.visit ?? o.aVisit} · {dateOf(data.nextRecall.dueOn)}
				{#if data.nextRecall.status === 'booked'}
					<Badge variant="secondary">{o.booked}</Badge>
				{:else if data.nextRecall.dueOn < data.today}
					<Badge variant="destructive">{o.overdue}</Badge>
				{/if}
			{:else}
				<span class="text-muted-foreground">{o.noRecall}</span>
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
							{a.type ?? o.appointment}{a.provider ? ` · ${a.provider}` : ''}{a.chair
								? ` · ${a.chair}`
								: ''}
						</span>
						<Badge
							variant={a.status === 'cancelled' || a.status === 'noShow' ? 'outline' : 'secondary'}
						>
							{isAppointmentStatus(a.status) ? o.appointmentStatus[a.status] : a.status}
						</Badge>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">{o.noAppointments}</p>
		{/if}
	</Section>

	<Section
		title={o.sections.clinical}
		IconComp={ClipboardList}
		style="systemIcon"
		class="lg:col-span-2"
	>
		<!-- Counts only: each of these has its own tab, where it is read and changed. -->
		<SingleTable singleTable={summaryRows} />
	</Section>

	<Section title={o.sections.system} IconComp={Settings} style="systemIcon">
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
		<Section title={o.sections.views} IconComp={Eye} style="systemIcon" class="lg:col-span-3">
			<ul class="flex flex-col divide-y text-sm">
				{#each data.recentViews as view (view.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2">
						<DataTableLinks
							id={view.userId}
							name={view.user ?? o.deletedUser}
							entity="user"
							display="inline"
						/>
						<span class="text-muted-foreground">
							{viewedLabel(view.action, view.recordType, t.lang)} · {view.branch ?? o.noBranch} · {dateOf(
								view.viewedAt
							)}
							{clinicClock(view.viewedAt)}
						</span>
					</li>
				{:else}
					<li class="py-2 text-muted-foreground">{o.noViews}</li>
				{/each}
			</ul>
			<a class="mt-2 inline-block text-sm underline-offset-2 hover:underline" href="{base}/access">
				{o.wholeAccessLog}
			</a>
		</Section>
	{/if}
</div>
