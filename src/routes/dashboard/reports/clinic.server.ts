import type { BranchContext } from '$lib/server/branchScope';
import { completedWork } from '$lib/server/procedures';
import { presentedPlans } from '$lib/server/treatmentPlans';
import { recallsDueBetween } from '$lib/server/recalls';
import { openBills } from '$lib/server/billing';
import { closedSessions } from '$lib/server/cashDrawer';
import { labPerformance } from '$lib/server/labCases';
import { db } from '$lib/server/db';
import { cents } from '$lib/invoiceStatus';
import { clinicDayRange, clinicToday } from '$lib/clinicTime';
import type { ReportFilters } from './filters';
import type { DetailResult } from './details.server';
import type { Domain } from './report.server';
import type { ReportChartData, Stat } from './types';

/**
 * The clinic report: production per dentist and per service, case acceptance, recalls, what is
 * owed and for how long, the cash drawer's variance, and how the laboratories have done.
 *
 * **Built on the clinical modules, not beside them.** Every figure comes from the reader that
 * already answers it on a working screen — `completedWork` (procedures), `presentedPlans`
 * (treatment plans), `openBills` (billing), `closedSessions` (the drawer), `labPerformance` — so the
 * report cannot define "production" or "owed" differently from the screen a manager checks it
 * against.
 *
 * **Aggregated here, not in SQL.** The older report modules lean on MySQL's own date functions;
 * these rows are per procedure, plan or bill over a date range — thousands, not millions — and
 * summing them in TypeScript keeps this module off the portability ledger (CLAUDE.md §10).
 *
 * **Branch is context** (§15): every reader is scoped by `locals.branch`, never by the report's
 * old branch filter.
 *
 * Non-goals: collections by dentist (production is the fee of work done, the figure commission is
 * paid on; money in is the Money report's), and a forecast of anything.
 */

type Branch = Pick<BranchContext, 'active'>;
type Row = Record<string, unknown>;

/** The ledgers this report owns, in the order the page offers them. */
export const CLINIC_SECTION_KEYS = [
	'production',
	'procedures-by-service',
	'case-acceptance',
	'recalls-due',
	'receivables-aging',
	'cash-variance',
	'lab-turnaround'
] as const;

export type ClinicSectionKey = (typeof CLINIC_SECTION_KEYS)[number];

export function isClinicSection(key: string): key is ClinicSectionKey {
	return (CLINIC_SECTION_KEYS as readonly string[]).includes(key);
}

/** Aging buckets, in days since the bill was issued. The usual four, so an accountant reads them. */
const AGING = [
	{ label: '0–30 days', upTo: 30 },
	{ label: '31–60 days', upTo: 60 },
	{ label: '61–90 days', upTo: 90 },
	{ label: 'Over 90 days', upTo: Infinity }
] as const;

function daysSince(day: string, today: string): number {
	return Math.round(
		(Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000
	);
}

function rate(part: number, whole: number): number | null {
	return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/* ── The ledgers ────────────────────────────────────────────────────────────────────────────── */

type Work = Awaited<ReturnType<typeof completedWork>>;

function work(filters: ReportFilters, branch: Branch): Promise<Work> {
	return completedWork(filters.dateStart, filters.dateEnd, branch);
}

function production(work: Work) {
	const byDentist = new Map<string, { patients: Set<number>; procedures: number; total: number }>();
	for (const row of work) {
		// `providerName` is a concatenation, so a procedure with no clinician reads '' rather than null.
		const key = row.provider || 'No dentist recorded';
		const entry = byDentist.get(key) ?? { patients: new Set(), procedures: 0, total: 0 };
		entry.patients.add(row.patientId);
		entry.procedures++;
		entry.total += row.fee ?? 0;
		byDentist.set(key, entry);
	}
	return [...byDentist]
		.map(([dentist, e]) => ({
			id: dentist,
			dentist,
			procedures: e.procedures,
			patients: e.patients.size,
			production: cents(e.total),
			average: cents(e.total / e.procedures)
		}))
		.sort((a, b) => b.production - a.production);
}

function byService(work: Work) {
	const services = new Map<string, { count: number; total: number }>();
	for (const row of work) {
		const key = row.service || 'Service removed';
		const entry = services.get(key) ?? { count: 0, total: 0 };
		entry.count++;
		entry.total += row.fee ?? 0;
		services.set(key, entry);
	}
	return [...services]
		.map(([service, e]) => ({
			id: service,
			service,
			procedures: e.count,
			production: cents(e.total),
			average: cents(e.total / e.count)
		}))
		.sort((a, b) => b.procedures - a.procedures);
}

async function acceptance(filters: ReportFilters, branch: Branch) {
	const plans = await presentedPlans(filters.dateStart, filters.dateEnd, branch);
	return plans.map((p) => ({
		id: p.id,
		patientId: p.patientId,
		patient: p.patient,
		presentedOn: p.presentedOn,
		decidedOn: p.decidedOn,
		status: p.status,
		quoted: cents(p.quoted),
		accepted: cents(p.accepted),
		rate: rate(p.accepted, p.quoted)
	}));
}

async function recalls(filters: ReportFilters, branch: Branch) {
	const today = clinicToday();
	const rows = await recallsDueBetween(filters.dateStart, filters.dateEnd, branch);
	return rows.map((r) => ({
		...r,
		// Still waiting after its date is a missed recall, and that is what the ledger is for.
		status: r.status === 'due' && r.dueOn < today ? 'missed' : r.status
	}));
}

/** What is owed today — a snapshot, whatever the range says, because a debt has no date range. */
async function aging(branch: Branch) {
	const today = clinicToday();
	const bills = await openBills(branch);
	return bills.map((b) => {
		const age = daysSince(b.issuedOn, today);
		return {
			id: b.id,
			patientId: b.patientId,
			invoiceNumber: b.invoiceNumber,
			patient: b.patient,
			payer: b.payer,
			issuedOn: b.issuedOn,
			age,
			bucket: (AGING.find((a) => age <= a.upTo) ?? AGING[3]).label,
			owed: b.owed
		};
	});
}

async function cash(filters: ReportFilters, branch: Branch) {
	const rows = await closedSessions(branch, {
		from: clinicDayRange(filters.dateStart).start,
		to: clinicDayRange(filters.dateEnd).end
	});
	return rows.map((s) => ({
		id: s.id,
		closedAt: s.closedAt,
		closedBy: s.closedBy,
		openingFloat: s.openingFloat,
		expected: s.expectedAmount,
		counted: s.countedAmount,
		variance: s.variance,
		banked: s.bankedAmount,
		note: s.note
	}));
}

async function labs(filters: ReportFilters, branch: Branch) {
	const rows = await labPerformance(branch, db, { from: filters.dateStart, to: filters.dateEnd });
	return rows.map((r) => ({ id: r.lab, ...r })).sort((a, b) => b.cases - a.cases);
}

/** One ledger's rows, unpaged. */
function rowsFor(
	section: ClinicSectionKey,
	filters: ReportFilters,
	branch: Branch
): Promise<Row[]> {
	switch (section) {
		case 'production':
			return work(filters, branch).then(production);
		case 'procedures-by-service':
			return work(filters, branch).then(byService);
		case 'case-acceptance':
			return acceptance(filters, branch);
		case 'recalls-due':
			return recalls(filters, branch);
		case 'receivables-aging':
			return aging(branch);
		case 'cash-variance':
			return cash(filters, branch);
		case 'lab-turnaround':
			return labs(filters, branch);
	}
}

/**
 * One page of one clinic ledger, searched across its text. The same `DetailResult` the older
 * ledgers return, so the page renders it with the same table.
 */
export async function loadClinicSection(
	filters: ReportFilters,
	branch: Branch
): Promise<DetailResult> {
	if (!isClinicSection(filters.section)) return { rows: [], total: 0 };
	const all = await rowsFor(filters.section, filters, branch);
	const term = filters.search.toLowerCase();
	const found = term
		? all.filter((row) =>
				Object.values(row).some((v) => typeof v === 'string' && v.toLowerCase().includes(term))
			)
		: all;
	const offset = (filters.page - 1) * filters.pageSize;
	return { rows: found.slice(offset, offset + filters.pageSize), total: found.length };
}

/* ── The tiles and charts ───────────────────────────────────────────────────────────────────── */

/** The figures and charts at the top of the clinic report. */
export async function clinicStats(filters: ReportFilters, branch: Branch): Promise<Domain> {
	const [done, plans, due, bills, drawers, labRows] = await Promise.all([
		work(filters, branch),
		acceptance(filters, branch),
		recalls(filters, branch),
		aging(branch),
		cash(filters, branch),
		labs(filters, branch)
	]);
	const dentists = production(done);
	const services = byService(done);

	const sum = <T>(rows: T[], pick: (row: T) => number) =>
		cents(rows.reduce((s, row) => s + pick(row), 0));

	const answered = plans.filter((p) =>
		['accepted', 'partial', 'declined', 'completed'].includes(p.status)
	);
	const settled = due.filter(
		(r) => r.status === 'completed' || r.status === 'declined' || r.status === 'missed'
	);
	const variance = sum(drawers, (d) => d.variance);

	const stats: Stat[] = [
		{
			key: 'clinic-production',
			label: 'Production',
			value: sum(dentists, (d) => d.production),
			format: 'money',
			group: 'Clinic',
			hint: 'Fees of work completed in the range',
			section: 'production',
			tone: 'positive'
		},
		{
			key: 'clinic-procedures',
			label: 'Procedures done',
			value: sum(dentists, (d) => d.procedures),
			format: 'count',
			group: 'Clinic',
			section: 'procedures-by-service'
		},
		{
			key: 'clinic-acceptance',
			label: 'Case acceptance',
			value:
				rate(
					sum(answered, (p) => p.accepted),
					sum(answered, (p) => p.quoted)
				) ?? 0,
			format: 'percent',
			group: 'Clinic',
			hint: 'Share of answered quotes’ value agreed',
			section: 'case-acceptance'
		},
		{
			key: 'clinic-recall-return',
			label: 'Recalls that came back',
			value: rate(due.filter((r) => r.status === 'completed').length, settled.length) ?? 0,
			format: 'percent',
			group: 'Clinic',
			hint: settled.length
				? `${due.filter((r) => r.status === 'missed').length} missed`
				: 'None fell due in the range',
			section: 'recalls-due'
		},
		{
			key: 'clinic-receivables',
			label: 'Owed to the clinic',
			value: sum(bills, (b) => b.owed),
			format: 'money',
			group: 'Clinic',
			hint: 'Today, on issued bills',
			section: 'receivables-aging',
			tone: 'warning'
		},
		{
			key: 'clinic-over-90',
			label: 'Owed over 90 days',
			value: sum(
				bills.filter((b) => b.age > 90),
				(b) => b.owed
			),
			format: 'money',
			group: 'Clinic',
			section: 'receivables-aging',
			tone: 'negative'
		},
		{
			key: 'clinic-cash-variance',
			label: 'Cash drawer variance',
			value: variance,
			format: 'money',
			group: 'Clinic',
			hint: `${drawers.filter((d) => d.variance !== 0).length} of ${drawers.length} counts off`,
			section: 'cash-variance',
			tone: variance < 0 ? 'negative' : 'neutral'
		},
		{
			key: 'clinic-lab-late',
			label: 'Lab work back late',
			value: sum(labRows, (l) => l.late),
			format: 'count',
			group: 'Clinic',
			hint: `${sum(labRows, (l) => l.remakes)} remakes`,
			section: 'lab-turnaround'
		}
	];

	const topServices = services.slice(0, 10);
	const charts: ReportChartData[] = [
		{
			key: 'clinic-production-dentist',
			title: 'Production by dentist',
			description: 'Fees of work each dentist completed in the range.',
			group: 'Clinic',
			kind: 'bar',
			labels: dentists.map((d) => d.dentist),
			series: [{ label: 'Production', data: dentists.map((d) => d.production) }],
			money: true
		},
		{
			key: 'clinic-aging',
			title: 'What is owed, by age',
			description: 'Issued bills not yet paid in full, by days since issue.',
			group: 'Clinic',
			kind: 'bar',
			labels: AGING.map((a) => a.label),
			series: [
				{
					label: 'Owed',
					data: AGING.map((a) =>
						sum(
							bills.filter((b) => b.bucket === a.label),
							(b) => b.owed
						)
					)
				}
			],
			money: true
		},
		{
			key: 'clinic-services',
			title: 'Most done procedures',
			description: 'The ten services completed most often in the range.',
			group: 'Clinic',
			kind: 'bar',
			labels: topServices.map((s) => s.service),
			series: [{ label: 'Procedures', data: topServices.map((s) => s.procedures) }],
			wide: true
		}
	];

	return { stats, charts };
}
