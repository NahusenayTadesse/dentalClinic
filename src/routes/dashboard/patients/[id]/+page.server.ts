import { error, redirect } from '@sveltejs/kit';
import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { alias } from 'drizzle-orm/mysql-core';
import { and, count, desc, eq, gt, inArray, max, min, ne, sql, sum } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	appointment,
	branch,
	clinicalNote,
	customers,
	invoice,
	invoicePayment,
	patient,
	patientAccessLog,
	patientConsent,
	patientFile,
	prescription,
	referralSource,
	treatmentPlan,
	user
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { hasPermission, requirePermission } from '$lib/server/permissions';
import { recordAudit } from '$lib/server/audit';
import { isDuplicateKey } from '$lib/server/dbErrors';
import { childActions } from '$lib/server/childCrud';
import { isoDate, nowExpr, yearsSince } from '$lib/server/db/dialect';
import {
	allergens,
	conditions,
	contactTypeList,
	customerList,
	medicines,
	referralSources
} from '$lib/server/fastData';
import {
	HISTORY_STALE_DAYS,
	birthDateFrom,
	flagsFor,
	livePatient,
	patientFullName
} from '$lib/server/patients';
import { editHistory, editIdentity, editReach } from '../schema';
import { SECTIONS } from './sections';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/**
 * One patient's chart.
 *
 * **Readable from any branch.** A patient registered at one location is treated at another without
 * being registered twice (CLAUDE.md §15), so the chart is not branch scoped; it says when the
 * patient belongs elsewhere instead.
 *
 * **Every open is logged**, in `patient_access_log` — who looked at whose record is the question
 * a clinic is asked after a leak, and it cannot be answered afterwards. At most once per person,
 * patient and ten minutes: every save on this page re-runs the load, and a row per save would bury
 * the one view that matters under forty that do not.
 *
 * **Reading and changing are separate permissions.** The route gate is `patients.view`. Each
 * action checks its own: `patients.edit` for identity, phones and billing; `patients.clinical` for
 * the medical history and the clinical sections. See `sections.ts`.
 *
 * Non-goals, each waiting on its own screen: merging duplicates, booking, treatment, billing,
 * files and notes. The chart shows their counts so it is honest about what exists.
 */

/** How long one person's repeated opens of one chart count as a single view. */
const VIEW_WINDOW_MINUTES = 10;

const createdBy = alias(user, 'created_by_user');
const updatedBy = alias(user, 'updated_by_user');
const historyBy = alias(user, 'history_by_user');

/** The patient's id from the URL, as a positive integer, or a 404. */
function idFrom(event: Pick<RequestEvent, 'params'>): number {
	const id = Number(event.params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Patient not found');
	return id;
}

/**
 * The owner of a write: a patient who exists and is not a merge tombstone.
 *
 * Checked before every child write rather than left to the foreign key, which would accept a row
 * filed under a merged record — the exact stranded-allergy case merging exists to end.
 */
async function livePatientId(event: RequestEvent): Promise<number> {
	const id = idFrom(event);
	const [row] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(eq(patient.id, id), livePatient()))
		.limit(1);
	if (!row) error(404, 'Patient not found');
	return row.id;
}

export const load: PageServerLoad = async (event) => {
	const { locals, getClientAddress } = event;
	const id = idFrom(event);

	const [record] = await db
		.select({
			id: patient.id,
			fileNo: patient.fileNo,
			name: patient.name,
			fatherName: patient.fatherName,
			grandFatherName: patient.grandFatherName,
			fullName: patientFullName,
			sex: patient.sex,
			birthDate: isoDate(patient.birthDate),
			birthDateEstimated: patient.birthDateEstimated,
			age: yearsSince(patient.birthDate),
			phone: patient.phone,
			altPhone: patient.altPhone,
			bloodType: patient.bloodType,
			medicalNotes: patient.medicalNotes,
			historyTakenAt: patient.historyTakenAt,
			historyTakenBy: historyBy.name,
			referralSourceId: patient.referralSourceId,
			referral: referralSource.name,
			referredBy: patient.referredBy,
			customerId: patient.customerId,
			customer: customers.name,
			branchId: patient.branchId,
			branch: branch.name,
			mergedIntoId: patient.mergedIntoId,
			deletedAt: patient.deletedAt,
			createdAt: patient.createdAt,
			updatedAt: patient.updatedAt,
			createdBy: createdBy.name,
			createdById: createdBy.id,
			updatedBy: updatedBy.name,
			updatedById: updatedBy.id
		})
		.from(patient)
		.leftJoin(
			referralSource,
			and(eq(referralSource.id, patient.referralSourceId), notDeleted(referralSource))
		)
		.leftJoin(customers, and(eq(customers.id, patient.customerId), notDeleted(customers)))
		.leftJoin(branch, and(eq(branch.id, patient.branchId), notDeleted(branch)))
		// Attribution joins are not filtered: a deleted user still did what they did (§9).
		.leftJoin(createdBy, eq(createdBy.id, patient.createdBy))
		.leftJoin(updatedBy, eq(updatedBy.id, patient.updatedBy))
		.leftJoin(historyBy, eq(historyBy.id, patient.historyTakenBy))
		.where(eq(patient.id, id))
		.limit(1);

	if (!record || record.deletedAt) error(404, 'Patient not found');

	/*
	 * A merged record is a tombstone whose only job is to lead to the survivor — an old file number
	 * on a paper chart or a receipt still has to arrive at the right person. So it forwards, and
	 * says where it came from.
	 */
	if (record.mergedIntoId) {
		redirect(303, `/dashboard/patients/${record.mergedIntoId}?mergedFrom=${record.id}`);
	}

	await logView(id, locals, getClientAddress, locals.branch.active);

	const [sections, options, summary, flags, recentViews, identityForm, reachForm, historyForm] =
		await Promise.all([
			loadSections(id),
			loadOptions(),
			loadSummary(id),
			flagsFor([id]),
			hasPermission(locals, 'audit_logs.view') ? loadRecentViews(id) : Promise.resolve(null),
			superValidate(
				{
					fileNo: record.fileNo ?? undefined,
					name: record.name,
					fatherName: record.fatherName,
					grandFatherName: record.grandFatherName ?? undefined,
					sex: record.sex,
					knowsBirthDate: Boolean(record.birthDate) && !record.birthDateEstimated,
					birthDate: record.birthDate ?? undefined,
					ageYears:
						record.birthDateEstimated && record.age !== null ? Number(record.age) : undefined,
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
			)
		]);

	const mergedFrom = Number(event.url.searchParams.get('mergedFrom')) || null;

	return {
		patient: {
			...record,
			age: record.age === null ? null : Number(record.age),
			historyState: historyState(record.historyTakenAt)
		},
		flags: flags.get(id) ?? { allergies: [], conditions: [], medicineAlerts: [] },
		sections,
		options,
		summary,
		recentViews,
		forms: { identity: identityForm, reach: reachForm, history: historyForm },
		mergedFrom,
		fromOtherBranch:
			locals.branch.active !== null &&
			record.branchId !== null &&
			record.branchId !== locals.branch.active,
		can: {
			edit: hasPermission(locals, 'patients.edit'),
			clinical: hasPermission(locals, 'patients.clinical'),
			seeViews: recentViews !== null
		}
	};
};

/** "never", "stale" or "current" — the same three states the list filters by. */
function historyState(takenAt: Date | null): 'never' | 'stale' | 'current' {
	if (!takenAt) return 'never';
	const ageDays = (Date.now() - new Date(takenAt).getTime()) / 86_400_000;
	return ageDays > HISTORY_STALE_DAYS ? 'stale' : 'current';
}

/** Records that this user opened this chart, unless they already did in the last few minutes. */
async function logView(
	patientId: number,
	locals: App.Locals,
	getClientAddress: () => string,
	branchId: number | null
) {
	const userId = locals.user?.id;
	if (!userId) return;

	const since = new Date(Date.now() - VIEW_WINDOW_MINUTES * 60_000);
	const [recent] = await db
		.select({ id: patientAccessLog.id })
		.from(patientAccessLog)
		.where(
			and(
				eq(patientAccessLog.patientId, patientId),
				eq(patientAccessLog.userId, userId),
				gt(patientAccessLog.viewedAt, since)
			)
		)
		.limit(1);
	if (recent) return;

	let ipAddress: string | null = null;
	try {
		ipAddress = getClientAddress().slice(0, 45);
	} catch {
		// No address from this adapter; the view is still worth recording.
	}

	await db.insert(patientAccessLog).values({
		patientId,
		userId,
		recordType: 'summary',
		action: 'view',
		ipAddress,
		branchId
	});
}

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
	const open = ['draft', 'presented', 'accepted', 'partial'] as const;

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
						inArray(treatmentPlan.status, [...open])
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
					and(eq(invoice.patientId, patientId), notDeleted(invoice), ne(invoice.status, 'void'))
				),
			db
				.select({ total: sum(invoicePayment.amount) })
				.from(invoicePayment)
				.innerJoin(
					invoice,
					and(
						eq(invoice.id, invoicePayment.invoiceId),
						notDeleted(invoice),
						ne(invoice.status, 'void')
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
		balance: billedTotal - paidTotal,
		files: Number(files[0]?.total ?? 0),
		notes: Number(notes[0]?.total ?? 0),
		consents: Number(consents[0]?.total ?? 0)
	};
}

/** The last people to open this chart — shown only to those who may read the audit trail. */
async function loadRecentViews(patientId: number) {
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
		.where(eq(patientAccessLog.patientId, patientId))
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
