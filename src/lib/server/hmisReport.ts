/**
 * The Ministry of Health's monthly return for one facility: who was seen, and what they were
 * diagnosed with, by age group and sex (`$lib/hmisReport.ts` holds the groups and the month).
 *
 * **One branch is one facility.** Each location is licensed and reports on its own, so the return
 * is always for a single branch; "all branches" has no return.
 *
 * **Visits** are completed appointments in the month. A visit is **new** if it is the patient's
 * first completed visit at this branch ever, and **repeat** otherwise. Cancelled and missed
 * appointments are not visits, and nor is one still in the chair when the month closes.
 *
 * **Cases** are people diagnosed in the month, one per patient per condition, from the two places
 * a diagnosis is recorded here:
 *
 *   - **findings on the dental chart** — a procedure charted with status `condition` at this
 *     branch, dated by when it was charted, counted under the condition its service is linked to
 *     (`services.conditionId`). Three carious teeth at one examination are one case of caries.
 *   - **the chart's conditions list** — a dental-related condition with a diagnosis date in the
 *     month, counted at this branch only if the patient had a completed visit here that day, since
 *     the row itself does not say where it was diagnosed. A suspected condition is not a case. The
 *     medical history the clinic records but does not diagnose (hypertension, diabetes) is never
 *     counted: those cases belong to whoever diagnosed them.
 *
 * **Nothing is guessed.** A finding whose service has no linked condition, and a condition with no
 * Ministry code, are not quietly dropped or given a code: they are returned as `uncounted`, so the
 * screen can say what to fix before the return is filed. A return that silently under-reports is
 * worse than one that visibly cannot be finished.
 *
 * Grouping and age are done in TypeScript over the month's rows rather than in SQL, which keeps
 * the module off the portability ledger (CLAUDE.md §10); a month at one clinic is a few thousand
 * rows at most.
 */
import { and, eq, gte, inArray, isNotNull, lt, lte, min, ne, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	appointment,
	branch,
	condition,
	patient,
	patientConditions,
	procedures,
	services
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { isoDate } from '$lib/server/db/dialect';
import { livePatient } from '$lib/server/patients';
import { clinicDate, clinicDayRange } from '$lib/clinicTime';
import {
	countInto,
	emptyTally,
	hmisBand,
	type HmisPeriod,
	type HmisSex,
	type Tally
} from '$lib/hmisReport';

/** One diagnosis line of the return. */
export type CaseLine = { conditionId: number; name: string; hmisCode: string; tally: Tally };

/** What could not be counted, and why — the list the screen asks to be fixed. */
export type Uncounted = {
	/** Finding services with no condition linked: how many findings each had this month. */
	unlinkedFindings: { serviceId: number; name: string; findings: number }[];
	/** Conditions diagnosed this month that have no Ministry code: how many cases each. */
	uncoded: { conditionId: number; name: string; cases: number }[];
	/** Visits and cases counted under "age unknown", for want of a birth date. */
	unknownAge: { visits: number; cases: number };
};

/** The whole return for one branch and one month. */
export type MonthlyReturn = {
	facility: { id: number; name: string | null; address: string | null; phone: string | null };
	period: HmisPeriod;
	visits: { new: Tally; repeat: Tally };
	cases: CaseLine[];
	uncounted: Uncounted;
};

/** The database or a transaction on it — a test reads its own rollback. */
type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The return for `branchId` over `period`, or null when the branch does not exist.
 */
export async function monthlyReturn(
	branchId: number,
	period: HmisPeriod,
	reader: Reader = db
): Promise<MonthlyReturn | null> {
	const [facility] = await reader
		.select({ id: branch.id, name: branch.name, address: branch.address, phone: branch.phone })
		.from(branch)
		.where(and(eq(branch.id, branchId), notDeleted(branch)))
		.limit(1);
	if (!facility) return null;

	const from = clinicDayRange(period.start).start;
	const until = clinicDayRange(period.end).end;
	const person = { sex: patient.sex, birthDate: isoDate(patient.birthDate) };

	const [visits, findings, history] = await Promise.all([
		reader
			.select({ patientId: appointment.patientId, startsAt: appointment.startsAt, ...person })
			.from(appointment)
			.innerJoin(patient, and(eq(patient.id, appointment.patientId), livePatient()))
			.where(
				and(
					eq(appointment.branchId, branchId),
					eq(appointment.status, 'completed'),
					gte(appointment.startsAt, from),
					lt(appointment.startsAt, until),
					notDeleted(appointment)
				)
			),
		reader
			.select({
				patientId: procedures.patientId,
				chartedAt: procedures.createdAt,
				serviceId: services.id,
				service: services.name,
				conditionId: services.conditionId,
				...person
			})
			.from(procedures)
			.innerJoin(services, eq(services.id, procedures.serviceId))
			.innerJoin(patient, and(eq(patient.id, procedures.patientId), livePatient()))
			.where(
				and(
					eq(procedures.branchId, branchId),
					eq(procedures.status, 'condition'),
					gte(procedures.createdAt, from),
					lt(procedures.createdAt, until),
					notDeleted(procedures)
				)
			),
		reader
			.select({
				patientId: patientConditions.patientId,
				conditionId: patientConditions.conditionId,
				diagnosedOn: isoDate(patientConditions.diagnosedOn),
				...person
			})
			.from(patientConditions)
			.innerJoin(
				condition,
				and(eq(condition.id, patientConditions.conditionId), eq(condition.isDentalRelated, true))
			)
			.innerJoin(patient, and(eq(patient.id, patientConditions.patientId), livePatient()))
			.where(
				and(
					isNotNull(patientConditions.diagnosedOn),
					gte(patientConditions.diagnosedOn, sql`${period.start}`),
					lte(patientConditions.diagnosedOn, sql`${period.end}`),
					ne(patientConditions.status, 'suspected'),
					notDeleted(patientConditions)
				)
			)
	]);

	/* ── Visits ────────────────────────────────────────────────────────────────────────────── */

	// Each patient's first completed visit here, ever: a visit on that instant is their new one.
	const patientIds = [...new Set(visits.map((v) => v.patientId))];
	const firsts = patientIds.length
		? await reader
				.select({ patientId: appointment.patientId, first: min(appointment.startsAt) })
				.from(appointment)
				.where(
					and(
						inArray(appointment.patientId, patientIds),
						eq(appointment.branchId, branchId),
						eq(appointment.status, 'completed'),
						notDeleted(appointment)
					)
				)
				.groupBy(appointment.patientId)
		: [];
	const firstOf = new Map(firsts.map((f) => [f.patientId, f.first ? f.first.getTime() : null]));

	const visitTally = { new: emptyTally(), repeat: emptyTally() };
	let unknownAgeVisits = 0;
	const seenOn = new Set<string>();
	for (const v of visits) {
		const day = clinicDate(v.startsAt);
		seenOn.add(`${v.patientId}:${day}`);
		const band = hmisBand(v.birthDate, day);
		if (band === 'unknown') unknownAgeVisits++;
		const kind = firstOf.get(v.patientId) === v.startsAt.getTime() ? 'new' : 'repeat';
		countInto(visitTally[kind], band, v.sex);
	}

	/* ── Cases ─────────────────────────────────────────────────────────────────────────────── */

	/** The first day each patient was diagnosed with each condition this month. */
	const diagnosed = new Map<
		string,
		{ conditionId: number; day: string; sex: HmisSex; birthDate: string | null }
	>();
	const diagnose = (
		patientId: number,
		conditionId: number,
		day: string,
		who: { sex: HmisSex; birthDate: string | null }
	) => {
		const key = `${patientId}:${conditionId}`;
		const earlier = diagnosed.get(key);
		if (earlier && earlier.day <= day) return;
		diagnosed.set(key, { conditionId, day, sex: who.sex, birthDate: who.birthDate });
	};

	const unlinked = new Map<number, { serviceId: number; name: string; findings: number }>();
	for (const f of findings) {
		if (f.conditionId === null) {
			const entry = unlinked.get(f.serviceId) ?? {
				serviceId: f.serviceId,
				name: f.service,
				findings: 0
			};
			entry.findings++;
			unlinked.set(f.serviceId, entry);
			continue;
		}
		diagnose(f.patientId, f.conditionId, clinicDate(f.chartedAt), f);
	}
	for (const h of history) {
		// Diagnosed here only if they were seen here that day; see the module note.
		if (h.diagnosedOn && seenOn.has(`${h.patientId}:${h.diagnosedOn}`)) {
			diagnose(h.patientId, h.conditionId, h.diagnosedOn, h);
		}
	}

	const conditionIds = [...new Set([...diagnosed.values()].map((d) => d.conditionId))];
	const names = conditionIds.length
		? await reader
				.select({ id: condition.id, name: condition.name, hmisCode: condition.hmisCode })
				.from(condition)
				.where(inArray(condition.id, conditionIds))
		: [];
	const meta = new Map(names.map((n) => [n.id, n]));

	const lines = new Map<number, CaseLine>();
	const uncoded = new Map<number, { conditionId: number; name: string; cases: number }>();
	let unknownAgeCases = 0;
	for (const d of diagnosed.values()) {
		const info = meta.get(d.conditionId);
		const code = info?.hmisCode?.trim();
		if (!info || !code) {
			const entry = uncoded.get(d.conditionId) ?? {
				conditionId: d.conditionId,
				name: info?.name ?? 'A deleted condition',
				cases: 0
			};
			entry.cases++;
			uncoded.set(d.conditionId, entry);
			continue;
		}
		const line = lines.get(d.conditionId) ?? {
			conditionId: d.conditionId,
			name: info.name,
			hmisCode: code,
			tally: emptyTally()
		};
		const band = hmisBand(d.birthDate, d.day);
		if (band === 'unknown') unknownAgeCases++;
		countInto(line.tally, band, d.sex);
		lines.set(d.conditionId, line);
	}

	return {
		facility,
		period,
		visits: visitTally,
		cases: [...lines.values()].sort((a, b) =>
			a.hmisCode.localeCompare(b.hmisCode, undefined, { numeric: true })
		),
		uncounted: {
			unlinkedFindings: [...unlinked.values()].sort((a, b) => b.findings - a.findings),
			uncoded: [...uncoded.values()].sort((a, b) => b.cases - a.cases),
			unknownAge: { visits: unknownAgeVisits, cases: unknownAgeCases }
		}
	};
}
