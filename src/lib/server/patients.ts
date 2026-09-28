/**
 * How the app finds patients, and what it knows about them at a glance.
 *
 * Three screens ask these questions — the list, registration and the chart — and they must agree:
 * a patient the list's search finds has to be the one registration warns is a duplicate, and an
 * allergy the list flags has to be the one the chart puts in red. So the answers live here once.
 *
 * What it owns:
 *
 *   - **who is live** — not deleted, and not a merge tombstone (`livePatient`)
 *   - **the search** — names, file number, phones, contact details (`patientSearch`)
 *   - **age bands and history staleness**, as filters and as facet groupings
 *   - **alerts** — severe allergies and medicines that change what a dentist does
 *   - **possible duplicates**, for registration
 *
 * Non-goals: branch scope, which is `patientScope` in `branchScope.ts` and deliberately a separate
 * decision (CLAUDE.md §15); and anything clinical beyond the alert summary, which is the chart's.
 */
import { error } from '@sveltejs/kit';
import {
	and,
	asc,
	desc,
	eq,
	exists,
	gt,
	inArray,
	isNull,
	like,
	lte,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	allergen,
	condition,
	medicine,
	patient,
	patientAllergies,
	patientConditions,
	patientContacts,
	patientEmergencyContacts,
	patientMedications,
	patientAccessLog
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { concatWith } from '$lib/server/db/dialect';

/** `name father grandfather`, skipping the grandfather's name when it was never recorded. */
export const patientFullName = concatWith(
	' ',
	patient.name,
	patient.fatherName,
	patient.grandFatherName
);

/**
 * A patient who should appear anywhere at all.
 *
 * A merged record is a tombstone: it exists so an old file number still leads to the right person,
 * and it must never be found, listed or booked. The schema note on `mergedIntoId` says why — a
 * front desk that can still pick the tombstone has made a third copy of the patient, not fixed two.
 */
export function livePatient(): SQL {
	return sql`(${notDeleted(patient)} and ${isNull(patient.mergedIntoId)})`;
}

/**
 * The digits of a phone number, in the form it is most likely stored.
 *
 * Staff type "0911 23 45 67", "+251911234567" and "911234567" for the same number. Stripping to
 * digits and dropping the country code leaves the part every stored spelling contains, so a
 * substring match finds it regardless of how either side was typed.
 */
export function phoneDigits(raw: string): string {
	const digits = raw.replace(/\D/g, '');
	if (digits.startsWith('251')) return digits.slice(3);
	if (digits.startsWith('0')) return digits.slice(1);
	return digits;
}

/** A search term's LIKE pattern, with the user's `%` and `_` taken literally. */
function contains(term: string): string {
	return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * A search term as the words the search matches, at most six.
 *
 * Spaces and dashes inside a number are closed up first. Phones are read out and typed in groups —
 * "0911 23 45 67", "+251 911 234567" — and split on whitespace each group became a word of its own
 * that had to match something, so the number exactly as the patient said it found nobody.
 */
export function searchWords(term: string): string[] {
	return term
		.trim()
		.replace(/(?<=[\d+])[\s-]+(?=\d)/g, '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 6);
}

/**
 * The patient search: every word must match something.
 *
 * "abebe kebede" finds Abebe Kebede Alemu, and so does "kebede abebe" — each word is matched
 * against the name, the father's name, the grandfather's name and the file number, and all of
 * them must match. That is how the front desk actually searches: whichever names the patient
 * gives, in whichever order.
 *
 * A word with four or more digits is also tried as a phone number, against the patient's own
 * phones, their contact details, and **their emergency contacts' phones** — so a mother calling
 * about her child is found by the number she is calling from.
 *
 * Other contact details (an email, a Telegram handle) match as typed.
 *
 * Collation note (PORTABILITY.md): this is case-insensitive on MariaDB because of the column
 * collation, not because of anything here. Postgres needs `ILIKE` for the same behaviour.
 */
export function patientSearch(term: string): SQL | undefined {
	const words = searchWords(term);
	if (!words.length) return undefined;

	const perWord = words.map((word) => {
		const pattern = contains(word);
		const options: SQL[] = [
			like(patient.name, pattern),
			like(patient.fatherName, pattern),
			like(patient.grandFatherName, pattern),
			like(patient.fileNo, pattern),
			exists(
				db
					.select({ one: sql`1` })
					.from(patientContacts)
					.where(
						and(
							eq(patientContacts.patientId, patient.id),
							notDeleted(patientContacts),
							like(patientContacts.value, pattern)
						)
					)
			)
		];

		const digits = phoneDigits(word);
		if (digits.length >= 4) {
			const phone = contains(digits);
			options.push(
				like(patient.phone, phone),
				like(patient.altPhone, phone),
				exists(
					db
						.select({ one: sql`1` })
						.from(patientEmergencyContacts)
						.where(
							and(
								eq(patientEmergencyContacts.patientId, patient.id),
								notDeleted(patientEmergencyContacts),
								or(
									like(patientEmergencyContacts.phone, phone),
									like(patientEmergencyContacts.altPhone, phone)
								)
							)
						)
				)
			);
		}

		return sql`(${sql.join(options, sql` or `)})`;
	});

	return and(...perWord);
}

/* ── Age ─────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The age bands the list filters and charts by.
 *
 * Chosen for dentistry rather than demographics: under 13 is the mixed dentition and paediatric
 * dosing, 13–17 is orthodontics and consent by a guardian, 65 and over is where medicines and
 * bone health start to change treatment.
 */
export const AGE_BANDS = [
	{ value: 'child', label: 'Under 13', min: 0, max: 12 },
	{ value: 'teen', label: '13–17', min: 13, max: 17 },
	{ value: 'adult', label: '18–39', min: 18, max: 39 },
	{ value: 'middle', label: '40–64', min: 40, max: 64 },
	{ value: 'senior', label: '65 and over', min: 65, max: 150 }
] as const;

/** The date `years` years before today, as `YYYY-MM-DD`. */
function yearsAgo(years: number, extraDays = 0): string {
	const d = new Date();
	d.setFullYear(d.getFullYear() - years);
	d.setDate(d.getDate() + extraDays);
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * The condition for one age band, or for "no birth date recorded".
 *
 * Computed as a birth-date window in JS rather than as `TIMESTAMPDIFF(...) BETWEEN` in SQL. The
 * window is portable as written, and it is a range on `birth_date` that an index can serve; the
 * expression is neither.
 */
export function ageBandFilter(value: string): SQL | undefined {
	if (value === 'unknown') return isNull(patient.birthDate);

	const band = AGE_BANDS.find((b) => b.value === value);
	if (!band) return undefined;

	// Aged `min` today means born on or before `min` years ago; aged at most `max` means born
	// after `max + 1` years ago.
	return and(
		lte(patient.birthDate, sql`${yearsAgo(band.min)}`),
		gt(patient.birthDate, sql`${yearsAgo(band.max + 1)}`)
	);
}

/** The age band of a birth date, as a SQL expression, for grouping the facet. */
export function ageBandExpr(): SQL<string> {
	const cases = AGE_BANDS.map(
		(band) => sql`WHEN ${patient.birthDate} > ${yearsAgo(band.max + 1)} THEN ${band.value}`
	);
	return sql<string>`CASE WHEN ${patient.birthDate} IS NULL THEN 'unknown' ${sql.join(cases, sql` `)} ELSE 'senior' END`;
}

/* ── Medical history ────────────────────────────────────────────────────────────────────────── */

/** How long a history stays current. A year is the usual recall interval for a check-up. */
export const HISTORY_STALE_DAYS = 365;

export const HISTORY_STATES = [
	{ value: 'never', label: 'Never taken' },
	{ value: 'stale', label: 'Over a year old' },
	{ value: 'current', label: 'Current' }
] as const;

export function historyFilter(value: string): SQL | undefined {
	const cutoff = yearsAgo(0, -HISTORY_STALE_DAYS);
	if (value === 'never') return isNull(patient.historyTakenAt);
	if (value === 'stale') return lte(patient.historyTakenAt, sql`${cutoff}`);
	if (value === 'current') return gt(patient.historyTakenAt, sql`${cutoff}`);
	return undefined;
}

export function historyExpr(): SQL<string> {
	const cutoff = yearsAgo(0, -HISTORY_STALE_DAYS);
	return sql<string>`CASE WHEN ${patient.historyTakenAt} IS NULL THEN 'never' WHEN ${patient.historyTakenAt} <= ${cutoff} THEN 'stale' ELSE 'current' END`;
}

/* ── Alerts ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * The things a clinician must see before touching the patient, as filterable flags.
 *
 * Each is an `EXISTS` on the child table rather than a column, because each is a fact about rows
 * that change — an allergy recorded, a medicine stopped — and a cached flag on `patient` is one
 * missed update away from telling a dentist a warfarin patient is on nothing.
 */
export const ALERTS = {
	severeAllergy: {
		label: 'Severe allergy',
		where: () =>
			exists(
				db
					.select({ one: sql`1` })
					.from(patientAllergies)
					.where(
						and(
							eq(patientAllergies.patientId, patient.id),
							notDeleted(patientAllergies),
							eq(patientAllergies.severity, 'severe')
						)
					)
			)
	},
	anyAllergy: {
		label: 'Any allergy',
		where: () =>
			exists(
				db
					.select({ one: sql`1` })
					.from(patientAllergies)
					.where(and(eq(patientAllergies.patientId, patient.id), notDeleted(patientAllergies)))
			)
	},
	bleedingRisk: {
		label: 'Bleeding-risk medicine',
		where: () => medicineFlag(medicine.bleedingRisk)
	},
	osteonecrosisRisk: {
		label: 'Bone-risk medicine',
		where: () => medicineFlag(medicine.osteonecrosisRisk)
	},
	immunosuppressed: {
		label: 'Immunosuppressed',
		where: () => medicineFlag(medicine.immunosuppression)
	},
	noPhone: {
		label: 'No phone number',
		where: () => sql`(${isNull(patient.phone)} and ${isNull(patient.altPhone)})`
	}
} as const;

export type AlertKey = keyof typeof ALERTS;

export function isAlertKey(value: string): value is AlertKey {
	return Object.hasOwn(ALERTS, value);
}

/** Taking, right now, a medicine carrying `flag`. */
function medicineFlag(flag: Parameters<typeof eq>[0]) {
	return exists(
		db
			.select({ one: sql`1` })
			.from(patientMedications)
			.innerJoin(medicine, eq(medicine.id, patientMedications.medicineId))
			.where(
				and(
					eq(patientMedications.patientId, patient.id),
					notDeleted(patientMedications),
					eq(patientMedications.status, 'active'),
					eq(flag, true)
				)
			)
	);
}

/** Has an allergy to this allergen recorded. */
export function allergenFilter(value: string): SQL {
	return exists(
		db
			.select({ one: sql`1` })
			.from(patientAllergies)
			.where(
				and(
					eq(patientAllergies.patientId, patient.id),
					notDeleted(patientAllergies),
					eq(patientAllergies.allergenId, Number(value))
				)
			)
	);
}

/** Has this condition, in any state but resolved. */
export function conditionFilter(value: string): SQL {
	return exists(
		db
			.select({ one: sql`1` })
			.from(patientConditions)
			.where(
				and(
					eq(patientConditions.patientId, patient.id),
					notDeleted(patientConditions),
					eq(patientConditions.conditionId, Number(value)),
					sql`${patientConditions.status} <> 'resolved'`
				)
			)
	);
}

/** What the list shows beside each patient: allergies, open conditions, and risky medicines. */
export type PatientFlags = {
	allergies: { name: string; severity: string }[];
	conditions: string[];
	medicineAlerts: string[];
};

/**
 * The flags for a page of patients, in three queries however long the page is.
 *
 * Fetched for the page's ids after the page is chosen, rather than joined into the list query: a
 * join would multiply each patient by their allergies times their conditions and force a
 * `GROUP_CONCAT` (MySQL-only, CLAUDE.md §10) to fold them back together.
 */
export async function flagsFor(ids: number[]): Promise<Map<number, PatientFlags>> {
	const out = new Map<number, PatientFlags>();
	for (const id of ids) out.set(id, { allergies: [], conditions: [], medicineAlerts: [] });
	if (!ids.length) return out;

	const [allergies, conditions, medicines] = await Promise.all([
		db
			.select({
				patientId: patientAllergies.patientId,
				name: allergen.name,
				severity: patientAllergies.severity
			})
			.from(patientAllergies)
			.innerJoin(allergen, eq(allergen.id, patientAllergies.allergenId))
			.where(and(inArray(patientAllergies.patientId, ids), notDeleted(patientAllergies))),
		db
			.select({ patientId: patientConditions.patientId, name: condition.name })
			.from(patientConditions)
			.innerJoin(condition, eq(condition.id, patientConditions.conditionId))
			.where(
				and(
					inArray(patientConditions.patientId, ids),
					notDeleted(patientConditions),
					sql`${patientConditions.status} <> 'resolved'`
				)
			),
		db
			.select({
				patientId: patientMedications.patientId,
				bleeding: medicine.bleedingRisk,
				bone: medicine.osteonecrosisRisk,
				immune: medicine.immunosuppression
			})
			.from(patientMedications)
			.innerJoin(medicine, eq(medicine.id, patientMedications.medicineId))
			.where(
				and(
					inArray(patientMedications.patientId, ids),
					notDeleted(patientMedications),
					eq(patientMedications.status, 'active')
				)
			)
	]);

	for (const row of allergies) out.get(row.patientId)?.allergies.push(row);
	for (const row of conditions) out.get(row.patientId)?.conditions.push(row.name);
	for (const row of medicines) {
		const flags = out.get(row.patientId);
		if (!flags) continue;
		if (row.bleeding) flags.medicineAlerts.push(ALERTS.bleedingRisk.label);
		if (row.bone) flags.medicineAlerts.push(ALERTS.osteonecrosisRisk.label);
		if (row.immune) flags.medicineAlerts.push(ALERTS.immunosuppressed.label);
	}
	for (const flags of out.values()) flags.medicineAlerts = [...new Set(flags.medicineAlerts)];

	return out;
}

/* ── Duplicates ─────────────────────────────────────────────────────────────────────────────── */

export type PossibleDuplicate = {
	id: number;
	fileNo: string | null;
	name: string;
	phone: string | null;
	reason: string;
};

/**
 * Patients who may be the person being registered, with the reason each was matched.
 *
 * **The most likely way this system hurts somebody** is a second registration: the penicillin
 * allergy stays on the first record, today's prescription is written on the second, and its empty
 * allergy list reads as "none reported" (see `mergedIntoId`). So registration asks this first, and
 * across every branch — the patient who lost their card at one branch turns up at the other.
 *
 * Matched on the same phone, or on the same given and father's name. Deliberately loose: a false
 * alarm costs the receptionist a glance, a missed duplicate costs a patient their allergy list.
 */
export async function possibleDuplicates(input: {
	name: string;
	fatherName: string;
	phone?: string | null;
}): Promise<PossibleDuplicate[]> {
	const digits = input.phone ? phoneDigits(input.phone) : '';
	const byPhone =
		digits.length >= 6
			? or(like(patient.phone, contains(digits)), like(patient.altPhone, contains(digits)))
			: undefined;
	const byName = and(
		eq(patient.name, input.name.trim()),
		eq(patient.fatherName, input.fatherName.trim())
	);

	const rows = await db
		.select({
			id: patient.id,
			fileNo: patient.fileNo,
			name: patientFullName,
			phone: patient.phone,
			firstName: patient.name,
			fatherName: patient.fatherName
		})
		.from(patient)
		.where(and(livePatient(), or(byName, byPhone)))
		// The strongest matches first, then the capped rest. Unordered, the ten could be ten
		// namesakes and leave out the one record with the same name *and* the same phone —
		// the likeliest duplicate of all, found cut off the list while testing the merge screen.
		.orderBy(...(byPhone ? [desc(sql`(${byPhone})`)] : []), desc(sql`(${byName})`), asc(patient.id))
		.limit(10);

	return rows.map((row) => {
		const sameName =
			row.firstName.toLowerCase() === input.name.trim().toLowerCase() &&
			row.fatherName.toLowerCase() === input.fatherName.trim().toLowerCase();
		const samePhone = digits.length >= 6 && phoneDigits(row.phone ?? '').includes(digits);
		return {
			id: row.id,
			fileNo: row.fileNo,
			name: row.name,
			phone: row.phone,
			reason:
				sameName && samePhone
					? 'Same name and phone number'
					: sameName
						? 'Same name and father’s name'
						: 'Same phone number'
		};
	});
}

/* ── Birth date ─────────────────────────────────────────────────────────────────────────────── */

/**
 * The birth date to store, from what the form was told.
 *
 * A known date is stored as given. An approximate age becomes 1 January of the year it implies,
 * flagged as estimated — 1 January because `yearsSince` then gives back exactly the age that was
 * typed, all year round, so the list never shows someone a year older than the receptionist wrote.
 * Neither means nobody asked, which is null and unflagged (see the schema note on `birthDate`).
 */
export function birthDateFrom(input: {
	knowsBirthDate: boolean;
	birthDate?: string;
	ageYears?: number;
}): { birthDate: string | null; birthDateEstimated: boolean } {
	if (input.knowsBirthDate && input.birthDate) {
		return { birthDate: input.birthDate, birthDateEstimated: false };
	}

	if (input.ageYears !== undefined) {
		return {
			birthDate: `${new Date().getFullYear() - input.ageYears}-01-01`,
			birthDateEstimated: true
		};
	}

	return { birthDate: null, birthDateEstimated: false };
}

/* ── One chart, several tabs ───────────────────────────────────────────────────────────────── */

/** The patient id in a chart URL, as a positive integer, or a 404. */
export function patientIdParam(raw: string | undefined): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Patient not found');
	return id;
}

/**
 * The owner of a write on a chart tab: a patient who exists and is not a merge tombstone.
 *
 * Checked before every child write rather than left to the foreign key, which would accept a row
 * filed under a merged record — the exact stranded-allergy case merging exists to end. Shared by
 * every tab, so a tab added later cannot quietly skip it.
 */
export async function livePatientId(event: { params: { id?: string } }): Promise<number> {
	const id = patientIdParam(event.params.id);
	const [row] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(eq(patient.id, id), livePatient()))
		.limit(1);
	if (!row) error(404, 'Patient not found');
	return row.id;
}

/** How long one person's repeated opens of one part of a chart count as a single view. */
const VIEW_WINDOW_MINUTES = 10;

/** The part of the record a view was of — the closed list on `patient_access_log.record_type`. */
type ViewedRecord = (typeof patientAccessLog.recordType.enumValues)[number];

/**
 * Records that this user opened this part of this patient's chart, unless they already did in the
 * last few minutes.
 *
 * Who looked at whose record is the question a clinic is asked after a leak, and it cannot be
 * answered afterwards. Per tab, so "opened the dental chart" and "opened the summary" stay
 * distinct; at most once per window, because every save re-runs the load and a row per save would
 * bury the one view that matters under forty that do not.
 */
export async function logPatientView(
	patientId: number,
	recordType: ViewedRecord,
	event: { locals: App.Locals; getClientAddress: () => string },
	/**
	 * Which row, and what was done with it. A print is its own act — paper leaves the building —
	 * so it is windowed separately from a view of the same record rather than hidden by one.
	 */
	options: { recordId?: number; action?: 'view' | 'print' } = {}
) {
	const action = options.action ?? 'view';
	const recordId = options.recordId ?? null;
	const userId = event.locals.user?.id;
	if (!userId) return;

	const since = new Date(Date.now() - VIEW_WINDOW_MINUTES * 60_000);
	const [recent] = await db
		.select({ id: patientAccessLog.id })
		.from(patientAccessLog)
		.where(
			and(
				eq(patientAccessLog.patientId, patientId),
				eq(patientAccessLog.userId, userId),
				eq(patientAccessLog.recordType, recordType),
				eq(patientAccessLog.action, action),
				recordId === null
					? isNull(patientAccessLog.recordId)
					: eq(patientAccessLog.recordId, recordId),
				gt(patientAccessLog.viewedAt, since)
			)
		)
		.limit(1);
	if (recent) return;

	let ipAddress: string | null = null;
	try {
		ipAddress = event.getClientAddress().slice(0, 45);
	} catch {
		// No address from this adapter; the view is still worth recording.
	}

	await db.insert(patientAccessLog).values({
		patientId,
		userId,
		recordType,
		recordId,
		action,
		ipAddress,
		branchId: event.locals.branch.active
	});
}
