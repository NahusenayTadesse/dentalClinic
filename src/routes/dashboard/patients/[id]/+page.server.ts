import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, count, desc, eq, gt, inArray, max, min, sql, sum } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	appointment,
	branch,
	clinicalNote,
	invoice,
	invoicePayment,
	patient,
	patientAccessLog,
	patientConsent,
	patientFile,
	prescription,
	treatmentPlan,
	user
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { requirePermission } from '$lib/server/permissions';
import { recordAudit } from '$lib/server/audit';
import { isDuplicateKey } from '$lib/server/dbErrors';
import { childActions } from '$lib/server/childCrud';
import { nowExpr } from '$lib/server/db/dialect';
import {
	allergens,
	conditions,
	contactTypeList,
	customerList,
	medicines,
	referralSources
} from '$lib/server/fastData';
import { birthDateFrom, livePatientId, logPatientView } from '$lib/server/patients';
import { editHistory, editIdentity, editReach } from '../schema';
import { SECTIONS } from './sections';
import { appointmentQuery } from '$lib/server/appointments';
import { openPlan } from '$lib/server/treatmentPlans';
import { patientBalance } from '$lib/server/billing';
import { clinicToday } from '$lib/clinicTime';
import { loadMerge, mergeAction } from './merge';
import { mergedInto } from '$lib/server/patientMerge';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/**
 * The chart's overview tab: who the patient is, how to reach them, their medical history, and a
 * count of everything else on the record.
 *
 * The patient row, the alerts and the permissions come from `+layout.server.ts`, which every tab
 * shares. What is here is what only this tab shows, and the actions that change it.
 */

export const load: PageServerLoad = async (event) => {
	const { patient: record, can } = await event.parent();
	const id = record.id;

	await logPatientView(id, 'summary', event);

	const [
		sections,
		options,
		summary,
		recentViews,
		identityForm,
		reachForm,
		historyForm,
		appointments,
		merge
	] = await Promise.all([
		loadSections(id),
		loadOptions(),
		loadSummary(id),
		can.seeViews ? loadRecentViews(id) : Promise.resolve(null),
		superValidate(
			{
				fileNo: record.fileNo ?? undefined,
				name: record.name,
				fatherName: record.fatherName,
				grandFatherName: record.grandFatherName ?? undefined,
				sex: record.sex,
				knowsBirthDate: Boolean(record.birthDate) && !record.birthDateEstimated,
				birthDate: record.birthDate ?? undefined,
				ageYears: record.birthDateEstimated && record.age !== null ? record.age : undefined,
				bloodType: record.bloodType ?? undefined
			},
			zod4(editIdentity),
			{ errors: false }
		),
		superValidate(
			{
				phone: record.phone ?? undefined,
				altPhone: record.altPhone ?? undefined,
				referralSourceId: record.referralSourceId ?? undefined,
				referredBy: record.referredBy ?? undefined,
				customerId: record.customerId ?? undefined
			},
			zod4(editReach),
			{ errors: false }
		),
		superValidate(
			{ medicalNotes: record.medicalNotes ?? undefined, markTaken: false },
			zod4(editHistory),
			{ errors: false }
		),
		// Every branch's: the chart is the patient's, not this branch's (§15). Latest first.
		appointmentQuery(eq(appointment.patientId, id)).orderBy(desc(appointment.startsAt)).limit(15),
		loadMerge(record, event.locals)
	]);

	return {
		sections,
		options,
		summary,
		appointments,
		recentViews,
		merge,
		forms: { identity: identityForm, reach: reachForm, history: historyForm }
	};
};

async function loadSections(id: number) {
	const [allergy, condition, medication, contact, emergency] = await Promise.all([
		SECTIONS.Allergy.load(id),
		SECTIONS.Condition.load(id),
		SECTIONS.Medication.load(id),
		SECTIONS.Contact.load(id),
		SECTIONS.EmergencyContact.load(id)
	]);
	return { allergy, condition, medication, contact, emergency };
}

/** Picker options, keyed by the field name each section's config uses. */
async function loadOptions() {
	const [allergenList, conditionList, medicineList, contactTypes, referrals, customerOptions] =
		await Promise.all([
			allergens(),
			conditions(),
			medicines(),
			contactTypeList(),
			referralSources(),
			customerList()
		]);

	return {
		allergy: { allergenId: allergenList },
		condition: { conditionId: conditionList },
		medication: { medicineId: medicineList },
		contact: { contactTypeId: contactTypes },
		referrals,
		customers: customerOptions
	};
}

/**
 * Counts from the parts of the record that have no screen of their own yet.
 *
 * Shown so the chart is honest about what exists — a patient with three lab cases should not look
 * like one with none because the lab screen is not built.
 */
async function loadSummary(patientId: number) {
	// Issued bills only: a draft is owed by nobody, a void by nobody.
	const OWED = ['issued', 'partly', 'paid'] as const;

	const [visits, next, plans, prescriptions, billed, paid, files, notes, consents] =
		await Promise.all([
			db
				.select({
					total: count(),
					completed: sql<number>`sum(${appointment.status} = 'completed')`,
					noShows: sql<number>`sum(${appointment.status} = 'noShow')`,
					lastVisit: max(
						sql`case when ${appointment.status} = 'completed' then ${appointment.startsAt} end`
					)
				})
				.from(appointment)
				.where(and(eq(appointment.patientId, patientId), notDeleted(appointment))),
			db
				.select({ at: min(appointment.startsAt) })
				.from(appointment)
				.where(
					and(
						eq(appointment.patientId, patientId),
						notDeleted(appointment),
						gt(appointment.startsAt, nowExpr()),
						inArray(appointment.status, ['scheduled', 'confirmed'])
					)
				),
			db
				.select({ total: count() })
				.from(treatmentPlan)
				.where(
					and(
						eq(treatmentPlan.patientId, patientId),
						notDeleted(treatmentPlan),
						// The plans module's own rule, so an expired quote is not counted as open here
						// while the plans tab calls it expired.
						openPlan(clinicToday())
					)
				),
			db
				.select({ total: count() })
				.from(prescription)
				.where(and(eq(prescription.patientId, patientId), notDeleted(prescription))),
			db
				.select({ total: sum(invoice.total) })
				.from(invoice)
				.where(
					and(eq(invoice.patientId, patientId), notDeleted(invoice), inArray(invoice.status, OWED))
				),
			db
				.select({ total: sum(invoicePayment.amount) })
				.from(invoicePayment)
				.innerJoin(
					invoice,
					and(
						eq(invoice.id, invoicePayment.invoiceId),
						notDeleted(invoice),
						inArray(invoice.status, OWED)
					)
				)
				.where(and(eq(invoice.patientId, patientId), notDeleted(invoicePayment))),
			db
				.select({ total: count() })
				.from(patientFile)
				.where(and(eq(patientFile.patientId, patientId), notDeleted(patientFile))),
			db
				.select({ total: count() })
				.from(clinicalNote)
				.where(and(eq(clinicalNote.patientId, patientId), notDeleted(clinicalNote))),
			db
				.select({ total: count() })
				.from(patientConsent)
				.where(and(eq(patientConsent.patientId, patientId), notDeleted(patientConsent)))
		]);

	// `SUM` of a decimal comes back as a string whatever the column's mode (§9), so it is converted
	// here, once, before any arithmetic touches it.
	const billedTotal = Number(billed[0]?.total ?? 0);
	const paidTotal = Number(paid[0]?.total ?? 0);

	return {
		visits: Number(visits[0]?.total ?? 0),
		completedVisits: Number(visits[0]?.completed ?? 0),
		noShows: Number(visits[0]?.noShows ?? 0),
		lastVisit: visits[0]?.lastVisit ? String(visits[0].lastVisit) : null,
		nextAppointment: next[0]?.at ?? null,
		openPlans: Number(plans[0]?.total ?? 0),
		prescriptions: Number(prescriptions[0]?.total ?? 0),
		billed: billedTotal,
		paid: paidTotal,
		// The billing module's own figure, so the overview, the header and the billing tab agree.
		balance: await patientBalance(patientId),
		files: Number(files[0]?.total ?? 0),
		notes: Number(notes[0]?.total ?? 0),
		consents: Number(consents[0]?.total ?? 0)
	};
}

/** The last people to open this chart — shown only to those who may read the audit trail. */
async function loadRecentViews(patientId: number) {
	// Views of records merged into this one are views of this patient: the log is not rewritten on a
	// merge (it is evidence), so it is read across them instead.
	const ids = [patientId, ...(await mergedInto(patientId))];
	return db
		.select({
			id: patientAccessLog.id,
			user: user.name,
			userId: user.id,
			action: patientAccessLog.action,
			branch: branch.name,
			viewedAt: patientAccessLog.viewedAt
		})
		.from(patientAccessLog)
		.leftJoin(user, eq(user.id, patientAccessLog.userId))
		.leftJoin(branch, eq(branch.id, patientAccessLog.branchId))
		.where(inArray(patientAccessLog.patientId, ids))
		.orderBy(desc(patientAccessLog.viewedAt))
		.limit(15);
}

/**
 * Writes to the patient row itself, audited, in one transaction.
 *
 * Shared by the three dialogs that edit the patient directly, which differ in their schema, their
 * permission and how their form maps onto columns — and in nothing else.
 */
async function updatePatient(
	event: RequestEvent,
	values: Record<string, unknown>
): Promise<'saved' | 'missing'> {
	const id = await livePatientId(event);

	return db.transaction(async (tx) => {
		const [before] = await tx.select().from(patient).where(eq(patient.id, id)).limit(1);
		if (!before) return 'missing';

		const written = { ...values, updatedBy: event.locals.user?.id };
		await tx.update(patient).set(written).where(eq(patient.id, id));
		await recordAudit(tx, event, {
			table: 'patient',
			recordId: id,
			action: 'update',
			before,
			after: written
		});
		return 'saved';
	});
}

export const actions: Actions = {
	...childActions(SECTIONS, livePatientId),
	merge: mergeAction,

	editIdentity: async (event) => {
		requirePermission(event.locals, 'patients.edit');
		const form = await superValidate(event.request, zod4(editIdentity));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const data = form.data;
		try {
			await updatePatient(event, {
				fileNo: data.fileNo ?? null,
				name: data.name,
				fatherName: data.fatherName,
				grandFatherName: data.grandFatherName ?? null,
				sex: data.sex,
				...birthDateFrom(data),
				bloodType: data.bloodType ?? null
			});
			return message(form, { type: 'success', text: 'Details updated' });
		} catch (err: unknown) {
			if (isDuplicateKey(err)) {
				setError(form, 'fileNo', 'Another patient already has this file number.');
				return message(
					form,
					{ type: 'error', text: 'That file number is already in use.' },
					{ status: 400 }
				);
			}
			console.error('[patients] editIdentity failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not save. Please try again.' },
				{ status: 500 }
			);
		}
	},

	editReach: async (event) => {
		requirePermission(event.locals, 'patients.edit');
		const form = await superValidate(event.request, zod4(editReach));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const data = form.data;
		try {
			await updatePatient(event, {
				phone: data.phone ?? null,
				altPhone: data.altPhone ?? null,
				referralSourceId: data.referralSourceId ?? null,
				referredBy: data.referredBy ?? null,
				customerId: data.customerId ?? null
			});
			return message(form, { type: 'success', text: 'Contact and billing updated' });
		} catch (err: unknown) {
			console.error('[patients] editReach failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not save. Please try again.' },
				{ status: 500 }
			);
		}
	},

	editHistory: async (event) => {
		requirePermission(event.locals, 'patients.clinical');
		const form = await superValidate(event.request, zod4(editHistory));
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		try {
			await updatePatient(event, {
				medicalNotes: form.data.medicalNotes ?? null,
				// Stamped only when the clinician says the questions were asked — see the schema.
				...(form.data.markTaken
					? { historyTakenAt: new Date(), historyTakenBy: event.locals.user?.id ?? null }
					: {})
			});
			return message(form, {
				type: 'success',
				text: form.data.markTaken ? 'History recorded as taken today' : 'Medical notes updated'
			});
		} catch (err: unknown) {
			console.error('[patients] editHistory failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not save. Please try again.' },
				{ status: 500 }
			);
		}
	}
};
