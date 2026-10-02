import { and, count, countDistinct, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	allergen,
	branch,
	condition,
	customers,
	patient,
	patientAllergies,
	patientConditions,
	referralSource
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { patientScope } from '$lib/server/branchScope';
import { hasPermission } from '$lib/server/permissions';
import { balancesFor } from '$lib/server/billing';
import { isoDate, yearsSince } from '$lib/server/db/dialect';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery,
	type Facet
} from '$lib/server/queryFilters';
import {
	AGE_BANDS,
	ALERTS,
	HISTORY_STATES,
	ageBandExpr,
	ageBandFilter,
	allergenFilter,
	conditionFilter,
	flagsFor,
	historyExpr,
	historyFilter,
	isAlertKey,
	livePatient,
	patientFullName,
	patientSearch
} from '$lib/server/patients';
import { messagesFor } from '$lib/i18n/messages';
import { alertName } from './labels.server';
import type { PageServerLoad } from './$types';

/**
 * The patient list.
 *
 * **Scoped to the branch when browsing, not when searching** (CLAUDE.md §15). Paging through the
 * roster shows this branch's patients; typing a name or a phone number searches every branch,
 * because the person at the window must be found rather than registered twice. A result from
 * elsewhere carries `fromOtherBranch` and the screen says so.
 *
 * Every filter is a URL param and every tally is counted in SQL across the whole result, the same
 * as the employees list. The filters a front desk and a clinician actually ask:
 *
 *   sex · age band · blood type · how they heard of us · who pays · allergy · condition ·
 *   alerts (severe allergy, bleeding-risk medicine…) · medical history state · registered between
 */

/** What the table may sort by, and what each key sorts on. */
const SORTABLE = {
	name: patientFullName,
	fileNo: patient.fileNo,
	// Age sorts on the birth date, inverted by the direction the reader asked for: youngest first
	// is the latest birth date first.
	age: sql`-${yearsSince(patient.birthDate)}`,
	registered: patient.createdAt,
	history: patient.historyTakenAt,
	referral: referralSource.name,
	payer: customers.name,
	branch: branch.name
};

const FILTERS = [
	'sex',
	'ageBand',
	'bloodType',
	'referralId',
	'payer',
	'allergenId',
	'conditionId',
	'alert',
	'history'
] as const;

const SEXES = patient.sex.enumValues;
const BLOOD_TYPES = patient.bloodType.enumValues;

/** Narrows a URL value to one of an enum's values, so it reaches `eq` typed rather than cast. */
function oneOf<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTABLE));
	// Facet and alert labels are made here, so they are made in the viewer's language.
	const m = messagesFor(locals.lang);
	const pm = m.patients;

	/*
	 * A deliberate search crosses branches; browsing does not. Decided once, here, from whether the
	 * reader typed something — not from a filter, because narrowing by allergy is still browsing.
	 */
	const mode = query.search ? 'search' : 'list';

	const spec = {
		base: [livePatient(), patientScope(patient.branchId, locals.branch, mode)],
		search: patientSearch,
		dateColumn: patient.createdAt,
		filters: {
			// Every value is checked against its closed list before it reaches SQL: a hand-typed
			// `?sex=dragon` matches nothing rather than erroring or matching everyone.
			sex: (v: string) => (oneOf(SEXES, v) ? eq(patient.sex, v) : sql`false`),
			bloodType: (v: string) => (oneOf(BLOOD_TYPES, v) ? eq(patient.bloodType, v) : sql`false`),
			ageBand: (v: string) => ageBandFilter(v) ?? sql`false`,
			referralId: (v: string) => eq(patient.referralSourceId, Number(v)),
			payer: (v: string) =>
				v === 'self' ? isNull(patient.customerId) : eq(patient.customerId, Number(v)),
			allergenId: allergenFilter,
			conditionId: conditionFilter,
			alert: (v: string) => (isAlertKey(v) ? ALERTS[v].where() : sql`false`),
			history: (v: string) => historyFilter(v) ?? sql`false`
		}
	};

	const where = buildWhere(query, spec);

	const [{ total }] = await db.select({ total: count() }).from(patient).where(where);

	const rows = await db
		.select({
			id: patient.id,
			fileNo: patient.fileNo,
			name: patientFullName,
			sex: patient.sex,
			age: yearsSince(patient.birthDate),
			ageEstimated: patient.birthDateEstimated,
			phone: patient.phone,
			bloodType: patient.bloodType,
			referral: referralSource.name,
			payer: customers.name,
			historyTakenAt: isoDate(patient.historyTakenAt),
			history: historyExpr(),
			branch: branch.name,
			branchId: patient.branchId,
			registered: isoDate(patient.createdAt)
		})
		.from(patient)
		.leftJoin(
			referralSource,
			and(eq(referralSource.id, patient.referralSourceId), notDeleted(referralSource))
		)
		.leftJoin(customers, and(eq(customers.id, patient.customerId), notDeleted(customers)))
		.leftJoin(branch, and(eq(branch.id, patient.branchId), notDeleted(branch)))
		.where(where)
		.orderBy(...(orderBy(query, SORTABLE) ?? [desc(patient.createdAt)]), desc(patient.id))
		.limit(query.limit)
		.offset(query.offset);

	// What each owes, only for someone who may see money — `null` hides the column for everyone else.
	const canBill = hasPermission(locals, 'billing.invoice');
	const [flags, balances] = await Promise.all([
		flagsFor(rows.map((r) => r.id)),
		canBill ? balancesFor(rows.map((r) => r.id)) : Promise.resolve(null)
	]);

	const patients = rows.map((row) => {
		const flag = flags.get(row.id) ?? { allergies: [], conditions: [], medicineAlerts: [] };
		return {
			...row,
			age: row.age === null ? null : Number(row.age),
			...flag,
			medicineAlerts: flag.medicineAlerts.map((label) => alertName(m, label)),
			owes: balances ? (balances.get(row.id) ?? 0) : null,
			/*
			 * Only meaningful while working at one branch. Seeing across all of them, nobody is "from
			 * another branch" — and a patient with no branch recorded predates branches, not elsewhere.
			 */
			fromOtherBranch:
				locals.branch.active !== null &&
				row.branchId !== null &&
				row.branchId !== locals.branch.active
		};
	});

	/* ── Facets ──────────────────────────────────────────────────────────────────────────────
	 * Each tally applies every filter but its own (see `facetCounts`), and every one is counted
	 * over the whole result rather than this page.
	 */
	type FilterKey = (typeof FILTERS)[number];

	/*
	 * Typed through `sql<T>` rather than taking a column: a facet groups by expressions as often as
	 * by columns (an age band, "pays at the desk"), and Drizzle types an arbitrary one as `unknown`.
	 */
	const grouped = (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: FilterKey
	) =>
		db
			.select({ value, label, count: countDistinct(patient.id) })
			.from(patient)
			.leftJoin(
				referralSource,
				and(eq(referralSource.id, patient.referralSourceId), notDeleted(referralSource))
			)
			.leftJoin(customers, and(eq(customers.id, patient.customerId), notDeleted(customers)))
			.where(buildWhere(query, spec, { except }))
			.groupBy(value, label);

	/** Relabels grouped values from a fixed list, keeping its order in the chart. */
	const relabel =
		(labels: readonly { value: string; label: string }[], run: () => ReturnType<typeof grouped>) =>
		async () =>
			(await run()).map((r) => ({
				...r,
				label: labels.find((l) => l.value === r.value)?.label ?? String(r.value)
			}));

	const facets: Record<string, Facet[]> = await facetCounts({
		sex: relabel(
			[
				{ value: 'male', label: pm.sex.male },
				{ value: 'female', label: pm.sex.female }
			],
			() => grouped(sql<string>`${patient.sex}`, sql<string>`${patient.sex}`, 'sex')
		),
		age: relabel(
			[...AGE_BANDS, { value: 'unknown' as const }].map((b) => ({
				value: b.value,
				label: pm.ageBands[b.value]
			})),
			() => grouped(ageBandExpr(), ageBandExpr(), 'ageBand')
		),
		bloodType: () =>
			grouped(sql<string>`${patient.bloodType}`, sql<string>`${patient.bloodType}`, 'bloodType'),
		referral: () =>
			grouped(sql<number>`${referralSource.id}`, sql<string>`${referralSource.name}`, 'referralId'),
		payer: () =>
			grouped(
				sql<string>`coalesce(${customers.id}, 'self')`,
				sql<string>`coalesce(${customers.name}, ${pm.payAtDesk})`,
				'payer'
			),
		history: relabel(
			HISTORY_STATES.map((h) => ({ value: h.value, label: pm.history[h.value] })),
			() => grouped(historyExpr(), historyExpr(), 'history')
		),
		allergies: () =>
			db
				.select({
					value: allergen.id,
					label: allergen.name,
					count: countDistinct(patient.id)
				})
				.from(patient)
				.innerJoin(
					patientAllergies,
					and(eq(patientAllergies.patientId, patient.id), notDeleted(patientAllergies))
				)
				.innerJoin(allergen, eq(allergen.id, patientAllergies.allergenId))
				.where(buildWhere(query, spec, { except: 'allergenId' }))
				.groupBy(allergen.id, allergen.name),
		conditions: () =>
			db
				.select({
					value: condition.id,
					label: condition.name,
					count: countDistinct(patient.id)
				})
				.from(patient)
				.innerJoin(
					patientConditions,
					and(
						eq(patientConditions.patientId, patient.id),
						notDeleted(patientConditions),
						sql`${patientConditions.status} <> 'resolved'`
					)
				)
				.innerJoin(condition, eq(condition.id, patientConditions.conditionId))
				.where(buildWhere(query, spec, { except: 'conditionId' }))
				.groupBy(condition.id, condition.name),
		/*
		 * Alerts overlap — a patient can have a severe allergy and be on warfarin — so they cannot
		 * be one GROUP BY. One small count each, all in parallel.
		 */
		alerts: async () =>
			Promise.all(
				Object.entries(ALERTS).map(async ([key, alert]) => {
					const [row] = await db
						.select({ count: count() })
						.from(patient)
						.where(and(buildWhere(query, spec, { except: 'alert' }), alert.where()));
					return {
						value: key,
						label: isAlertKey(key) ? pm.alerts[key] : alert.label,
						count: Number(row?.count ?? 0)
					};
				})
			)
	});

	/*
	 * "None here" is not "none at all". Counted only when this branch's list is empty and nothing
	 * narrowed it, so the ordinary page pays nothing for it — the same guard as the employees list.
	 */
	const elsewhere =
		total === 0 && mode === 'list'
			? await db
					.select({ total: count() })
					.from(patient)
					.where(livePatient())
					.then(([row]) => Number(row?.total ?? 0))
			: 0;

	return {
		showBalance: canBill,
		patients,
		facets,
		elsewhere,
		canRegister: hasPermission(locals, 'patients.register'),
		/** Whether this list is one branch's, so the page can say searches are not. */
		scopedToBranch: locals.branch.active !== null && locals.branch.options.length > 1,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query)
	};
};
