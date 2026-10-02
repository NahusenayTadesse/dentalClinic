import { error, redirect } from '@sveltejs/kit';
import { alias } from 'drizzle-orm/mysql-core';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { branch, customers, patient, referralSource, user } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { hasPermission } from '$lib/server/permissions';
import { isoDate, yearsSince } from '$lib/server/db/dialect';
import {
	HISTORY_STALE_DAYS,
	flagsFor,
	patientFullName,
	patientIdParam
} from '$lib/server/patients';
import { BOOK_PERMISSION } from '$lib/server/appointmentActions';
import { patientBalance } from '$lib/server/billing';
import { messagesFor } from '$lib/i18n/messages';
import { alertName } from '../labels.server';
import type { LayoutServerLoad } from './$types';

/**
 * One patient's chart: what every tab of it shares.
 *
 * **The record, once.** Every tab needs the patient — the overview for its cards and forms, the
 * dental chart for the age that picks its dentition — so it is read here and each tab takes it from
 * `parent()` instead of reading it again.
 *
 * **The alerts, on every tab.** A severe allergy has to be in front of whoever is charting a tooth,
 * not one tab away on the summary. That is the reason the header is a layout rather than part of
 * the overview page.
 *
 * **Readable from any branch.** A patient registered at one location is treated at another without
 * being registered twice (CLAUDE.md §15), so the chart is not branch scoped; it says when the
 * patient belongs elsewhere instead.
 *
 * **Reading and changing are separate permissions.** The route gate is `patients.view`. Each
 * action checks its own: `patients.edit` for identity, phones and billing; `patients.clinical` for
 * the medical history, the clinical sections and the dental chart. `can` below is only what the
 * screen offers; the actions re-check.
 *
 * Views are logged by each tab, not here, so the access log can say which part was opened
 * (`logPatientView`).
 *
 * Each part of the record has its own tab and logs its own view; the overview counts them all.
 */

const createdBy = alias(user, 'created_by_user');
const updatedBy = alias(user, 'updated_by_user');
const historyBy = alias(user, 'history_by_user');

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const id = patientIdParam(params.id);

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
	 * on a paper chart or a receipt still has to arrive at the right person. So it forwards, to the
	 * same tab, and says where it came from.
	 */
	if (record.mergedIntoId) {
		const tab = url.pathname.slice(`/dashboard/patients/${record.id}`.length);
		redirect(303, `/dashboard/patients/${record.mergedIntoId}${tab}?mergedFrom=${record.id}`);
	}

	const canBill = hasPermission(locals, 'billing.invoice');
	// What they owe, in the header on every tab — only for someone who may see money at all.
	const [flags, balance] = await Promise.all([
		flagsFor([id]),
		canBill ? patientBalance(id) : Promise.resolve(null)
	]);

	return {
		patient: {
			...record,
			age: record.age === null ? null : Number(record.age),
			historyState: historyState(record.historyTakenAt)
		},
		flags: (() => {
			const flag = flags.get(id) ?? { allergies: [], conditions: [], medicineAlerts: [] };
			// The header's badges in the viewer's language; the labels are `flagsFor`'s English.
			const m = messagesFor(locals.lang);
			return { ...flag, medicineAlerts: flag.medicineAlerts.map((label) => alertName(m, label)) };
		})(),
		balance,
		mergedFrom: Number(url.searchParams.get('mergedFrom')) || null,
		fromOtherBranch:
			locals.branch.active !== null &&
			record.branchId !== null &&
			record.branchId !== locals.branch.active,
		can: {
			edit: hasPermission(locals, 'patients.edit'),
			clinical: hasPermission(locals, 'patients.clinical'),
			seeViews: hasPermission(locals, 'audit_logs.view'),
			book: hasPermission(locals, BOOK_PERMISSION),
			bill: canBill
		}
	};
};

/** "never", "stale" or "current" — the same three states the list filters by. */
function historyState(takenAt: Date | null): 'never' | 'stale' | 'current' {
	if (!takenAt) return 'never';
	const ageDays = (Date.now() - new Date(takenAt).getTime()) / 86_400_000;
	return ageDays > HISTORY_STALE_DAYS ? 'stale' : 'current';
}
