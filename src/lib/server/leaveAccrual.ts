// Annual leave accrual and expiry.
//
// An employee earns a grant of annual leave days on every employment anniversary. How many
// days depends on how long they have served, read from `annual_leave_entitlement` brackets.
// Each grant carries an expiry date — `leave_expiry_policy.expiryYears` after it was granted —
// and once that date passes the whole grant is voided, taking its unused days with it. Days
// are always spent oldest-grant-first, so the days most at risk of going stale get used up
// before newer ones.
//
// Nothing in here runs on its own: the admin pages call the preview functions to show what
// would happen, and the run functions to commit it.
import { db } from '$lib/server/db';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import {
	annualLeaveEntitlement,
	employee,
	employeeLeaveGrant,
	employeeTermination,
	leaveExpiryPolicy
} from '$lib/server/db/schema';
import { employeeFullName } from '$lib/server/employeeName';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

export type PlannedGrant = {
	staffId: number;
	name: string;
	hireDate: string;
	serviceYear: number;
	grantDate: string;
	expiryDate: string;
	days: number;
};

export type PlannedExpiry = {
	grantId: number;
	staffId: number;
	name: string;
	serviceYear: number;
	grantDate: string;
	expiryDate: string;
	daysGranted: number;
	daysUsed: number;
	daysLost: number;
};

function toDateOnly(value: Date | string): string {
	const d = value instanceof Date ? value : new Date(value);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midnight of `value`'s calendar day, for comparing against `date` columns. */
function dateOnly(value: Date): Date {
	return new Date(toDateOnly(value));
}

function addYears(value: Date | string, years: number): Date {
	const d = value instanceof Date ? new Date(value) : new Date(value);
	d.setFullYear(d.getFullYear() + years);
	return d;
}

/** Completed years of service as of `asOf` — the number of anniversaries already passed. */
export function completedServiceYears(hireDate: Date | string, asOf: Date): number {
	const hire = hireDate instanceof Date ? hireDate : new Date(hireDate);
	let years = asOf.getFullYear() - hire.getFullYear();
	const anniversaryThisYear = new Date(hire);
	anniversaryThisYear.setFullYear(hire.getFullYear() + years);
	if (anniversaryThisYear > asOf) years -= 1;
	return years;
}

/** The active expiry policy, or null when the admin has not configured one yet. */
export async function getExpiryPolicy(database: Db = db) {
	const [policy] = await database
		.select({
			id: leaveExpiryPolicy.id,
			name: leaveExpiryPolicy.name,
			expiryYears: leaveExpiryPolicy.expiryYears
		})
		.from(leaveExpiryPolicy)
		.where(eq(leaveExpiryPolicy.status, true))
		.orderBy(sql`${leaveExpiryPolicy.id} desc`)
		.limit(1);

	return policy ?? null;
}

/**
 * Days awarded for a given completed-years-of-service figure. Brackets are inclusive on both
 * ends and an open `toYears` means "and up"; the narrowest matching bracket wins so a specific
 * row can override a catch-all. Returns null when no bracket covers the year.
 */
export function daysForServiceYear(
	brackets: { fromYears: number; toYears: number | null; days: number }[],
	serviceYear: number
): number | null {
	const matches = brackets.filter(
		(b) => serviceYear >= b.fromYears && (b.toYears === null || serviceYear <= b.toYears)
	);
	if (matches.length === 0) return null;

	matches.sort((a, b) => {
		const spanA = a.toYears === null ? Infinity : a.toYears - a.fromYears;
		const spanB = b.toYears === null ? Infinity : b.toYears - b.fromYears;
		if (spanA !== spanB) return spanA - spanB;
		return b.fromYears - a.fromYears;
	});

	return matches[0].days;
}

/**
 * Every grant that is due but not yet recorded, for all active employees, as of `asOf`.
 * Back-fills missed years too: an employee hired four years ago with no grants on file gets
 * one planned grant per anniversary, each with its own expiry date, so the expiry run can
 * then void whichever of those have already gone stale.
 */
export async function previewAccrual(asOf: Date = new Date()): Promise<{
	grants: PlannedGrant[];
	skipped: { staffId: number; name: string; serviceYear: number; reason: string }[];
}> {
	const policy = await getExpiryPolicy();
	const brackets = await db
		.select({
			fromYears: annualLeaveEntitlement.fromYears,
			toYears: annualLeaveEntitlement.toYears,
			days: annualLeaveEntitlement.days
		})
		.from(annualLeaveEntitlement)
		.where(eq(annualLeaveEntitlement.status, true));

	// Active employees only — anyone with a termination record stops accruing.
	const staff = await db
		.select({
			id: employee.id,
			name: employeeFullName,
			hireDate: employee.hireDate
		})
		.from(employee)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.where(
			and(eq(employee.isActive, true), isNull(employeeTermination.staffId), notDeleted(employee))
		);

	const existing = await db
		.select({ staffId: employeeLeaveGrant.staffId, serviceYear: employeeLeaveGrant.serviceYear })
		.from(employeeLeaveGrant);

	const already = new Set(existing.map((g) => `${g.staffId}:${g.serviceYear}`));

	const grants: PlannedGrant[] = [];
	const skipped: { staffId: number; name: string; serviceYear: number; reason: string }[] = [];

	for (const member of staff) {
		const years = completedServiceYears(member.hireDate, asOf);

		for (let serviceYear = 1; serviceYear <= years; serviceYear++) {
			if (already.has(`${member.id}:${serviceYear}`)) continue;

			const days = daysForServiceYear(brackets, serviceYear);
			if (days === null) {
				skipped.push({
					staffId: member.id,
					name: member.name,
					serviceYear,
					reason: `No entitlement bracket covers year ${serviceYear}`
				});
				continue;
			}

			const grantDate = addYears(member.hireDate, serviceYear);
			grants.push({
				staffId: member.id,
				name: member.name,
				hireDate: toDateOnly(member.hireDate),
				serviceYear,
				grantDate: toDateOnly(grantDate),
				expiryDate: toDateOnly(addYears(grantDate, policy?.expiryYears ?? 0)),
				days
			});
		}
	}

	grants.sort((a, b) => a.name.localeCompare(b.name) || a.serviceYear - b.serviceYear);
	return { grants, skipped };
}

/** Writes the planned grants and refreshes the affected employees' cached balances. */
export async function runAccrual(userId: string | undefined, asOf: Date = new Date()) {
	const { grants } = await previewAccrual(asOf);
	if (grants.length === 0) return { granted: 0, days: 0, staff: 0 };

	await db.transaction(async (tx) => {
		await tx.insert(employeeLeaveGrant).values(
			grants.map((g) => ({
				staffId: g.staffId,
				serviceYear: g.serviceYear,
				grantDate: new Date(g.grantDate),
				expiryDate: new Date(g.expiryDate),
				daysGranted: g.days,
				createdBy: userId
			}))
		);

		for (const staffId of new Set(grants.map((g) => g.staffId))) {
			await syncLeaveBalance(staffId, tx);
		}
	});

	return {
		granted: grants.length,
		days: grants.reduce((sum, g) => sum + g.days, 0),
		staff: new Set(grants.map((g) => g.staffId)).size
	};
}

/** Active grants whose expiry date has passed — these are the ones a run would void. */
export async function previewExpiry(asOf: Date = new Date()): Promise<PlannedExpiry[]> {
	const stale = await db
		.select({
			grantId: employeeLeaveGrant.id,
			staffId: employeeLeaveGrant.staffId,
			name: employeeFullName,
			serviceYear: employeeLeaveGrant.serviceYear,
			grantDate: employeeLeaveGrant.grantDate,
			expiryDate: employeeLeaveGrant.expiryDate,
			daysGranted: employeeLeaveGrant.daysGranted,
			daysUsed: employeeLeaveGrant.daysUsed
		})
		.from(employeeLeaveGrant)
		.leftJoin(employee, and(eq(employeeLeaveGrant.staffId, employee.id), notDeleted(employee)))
		.where(
			and(
				eq(employeeLeaveGrant.status, 'active'),
				lte(employeeLeaveGrant.expiryDate, dateOnly(asOf))
			)
		)
		.orderBy(asc(employeeLeaveGrant.expiryDate));

	return stale.map((g) => ({
		...g,
		grantDate: toDateOnly(g.grantDate),
		expiryDate: toDateOnly(g.expiryDate),
		daysLost: Math.max(g.daysGranted - g.daysUsed, 0)
	}));
}

/** Marks stale grants expired and refreshes the affected employees' cached balances. */
export async function runExpiry(userId: string | undefined, asOf: Date = new Date()) {
	const stale = await previewExpiry(asOf);
	if (stale.length === 0) return { expired: 0, daysLost: 0, staff: 0 };

	await db.transaction(async (tx) => {
		await tx
			.update(employeeLeaveGrant)
			.set({ status: 'expired', expiredAt: sql`now()`, updatedBy: userId })
			.where(
				and(
					eq(employeeLeaveGrant.status, 'active'),
					lte(employeeLeaveGrant.expiryDate, dateOnly(asOf))
				)
			);

		for (const staffId of new Set(stale.map((g) => g.staffId))) {
			await syncLeaveBalance(staffId, tx);
		}
	});

	return {
		expired: stale.length,
		daysLost: stale.reduce((sum, g) => sum + g.daysLost, 0),
		staff: new Set(stale.map((g) => g.staffId)).size
	};
}

export type EarnedToDate = {
	/** Unspent days the employee can actually book today. */
	balance: number;
	/** Days the next anniversary will award, or null when no bracket covers that year. */
	nextGrantDays: number | null;
	/** Share of the next grant worked through so far, 0–1. */
	progress: number;
	/** `nextGrantDays` scaled by `progress`, rounded to one decimal. */
	earned: number;
	/** The service year currently being worked through. */
	serviceYear: number;
	/** When the days being earned will actually land. */
	nextGrantDate: string | null;
};

/**
 * What an employee has worked toward since their last anniversary, for display only. Grants
 * still land whole on the anniversary — this is the pro-rata view of the year in progress, so
 * staff can see leave building up rather than appearing all at once. Nothing here is stored.
 */
export async function earnedToDate(
	staffId: number,
	asOf: Date = new Date(),
	database: Db = db
): Promise<EarnedToDate | null> {
	const [member] = await database
		.select({ hireDate: employee.hireDate })
		.from(employee)
		.where(eq(employee.id, staffId));

	if (!member) return null;

	const brackets = await database
		.select({
			fromYears: annualLeaveEntitlement.fromYears,
			toYears: annualLeaveEntitlement.toYears,
			days: annualLeaveEntitlement.days
		})
		.from(annualLeaveEntitlement)
		.where(eq(annualLeaveEntitlement.status, true));

	const completed = completedServiceYears(member.hireDate, asOf);
	// The year in progress is the one after the last anniversary reached.
	const serviceYear = completed + 1;

	const lastAnniversary = addYears(member.hireDate, Math.max(completed, 0));
	const nextAnniversary = addYears(member.hireDate, serviceYear);

	const span = nextAnniversary.getTime() - lastAnniversary.getTime();
	const elapsed = asOf.getTime() - lastAnniversary.getTime();
	const progress = span > 0 ? Math.min(Math.max(elapsed / span, 0), 1) : 0;

	const nextGrantDays = daysForServiceYear(brackets, serviceYear);

	return {
		balance: await leaveBalance(staffId, database),
		nextGrantDays,
		progress,
		earned: nextGrantDays === null ? 0 : Math.round(nextGrantDays * progress * 10) / 10,
		serviceYear,
		nextGrantDate: toDateOnly(nextAnniversary)
	};
}

/** Unspent days across an employee's grants that have not expired. */
export async function leaveBalance(staffId: number, database: Db = db): Promise<number> {
	const [row] = await database
		.select({
			balance: sql<number>`COALESCE(SUM(${employeeLeaveGrant.daysGranted} - ${employeeLeaveGrant.daysUsed}), 0)`
		})
		.from(employeeLeaveGrant)
		.where(and(eq(employeeLeaveGrant.staffId, staffId), eq(employeeLeaveGrant.status, 'active')));

	return Number(row?.balance ?? 0);
}

/** Recomputes `employee.leavesLeft` from the ledger so the cached figure stays honest. */
export async function syncLeaveBalance(staffId: number, database: Db = db): Promise<number> {
	const balance = await leaveBalance(staffId, database);
	await database.update(employee).set({ leavesLeft: balance }).where(eq(employee.id, staffId));
	return balance;
}

/**
 * Spends `days` from an employee's live grants, oldest first, so days closest to expiring go
 * first. Returns how many days could not be covered — the caller decides whether to treat an
 * uncovered remainder as an error or as unpaid leave.
 */
export async function consumeLeaveDays(
	staffId: number,
	days: number,
	database: Db = db
): Promise<{ consumed: number; shortfall: number }> {
	if (days <= 0) return { consumed: 0, shortfall: 0 };

	const grants = await database
		.select({
			id: employeeLeaveGrant.id,
			daysGranted: employeeLeaveGrant.daysGranted,
			daysUsed: employeeLeaveGrant.daysUsed
		})
		.from(employeeLeaveGrant)
		.where(and(eq(employeeLeaveGrant.staffId, staffId), eq(employeeLeaveGrant.status, 'active')))
		.orderBy(asc(employeeLeaveGrant.expiryDate), asc(employeeLeaveGrant.serviceYear));

	let remaining = days;

	for (const grant of grants) {
		if (remaining <= 0) break;
		const available = grant.daysGranted - grant.daysUsed;
		if (available <= 0) continue;

		const take = Math.min(available, remaining);
		await database
			.update(employeeLeaveGrant)
			.set({ daysUsed: grant.daysUsed + take })
			.where(eq(employeeLeaveGrant.id, grant.id));

		remaining -= take;
	}

	await syncLeaveBalance(staffId, database);

	if (remaining > 0) {
		console.warn(
			`[leave] staff ${staffId} booked ${days} days but only ${days - remaining} were available; ` +
				`${remaining} days are beyond their accrued balance`
		);
	}

	return { consumed: days - remaining, shortfall: remaining };
}

/**
 * Puts `days` back, newest grant first, which reverses the order `consumeLeaveDays` filled them
 * in. Returns how many days were actually restored.
 *
 * Grants are not linked to the leave that spent them, so a refund lands on whichever live grants
 * currently show usage rather than provably the ones the leave drew from. That is exact in the
 * ordinary case — approve, then un-approve — and only diverges if the originating grant has since
 * expired, when the days are gone and the shortfall is reported instead of being invented.
 */
export async function refundLeaveDays(
	staffId: number,
	days: number,
	database: Db = db
): Promise<number> {
	if (days <= 0) return 0;

	const grants = await database
		.select({
			id: employeeLeaveGrant.id,
			daysUsed: employeeLeaveGrant.daysUsed
		})
		.from(employeeLeaveGrant)
		.where(and(eq(employeeLeaveGrant.staffId, staffId), eq(employeeLeaveGrant.status, 'active')))
		.orderBy(
			sql`${employeeLeaveGrant.expiryDate} desc`,
			sql`${employeeLeaveGrant.serviceYear} desc`
		);

	let remaining = days;

	for (const grant of grants) {
		if (remaining <= 0) break;
		if (grant.daysUsed <= 0) continue;

		const give = Math.min(grant.daysUsed, remaining);
		await database
			.update(employeeLeaveGrant)
			.set({ daysUsed: grant.daysUsed - give })
			.where(eq(employeeLeaveGrant.id, grant.id));

		remaining -= give;
	}

	await syncLeaveBalance(staffId, database);

	if (remaining > 0) {
		// The grant those days came from has expired, so there is nothing live to credit them back
		// to. Say so rather than resurrecting expired days onto a newer grant.
		console.warn(
			`[leave] refund for staff ${staffId}: ${days - remaining} of ${days} days restored, ` +
				`${remaining} could not be (originating grant has expired)`
		);
	}

	return days - remaining;
}
