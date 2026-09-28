/**
 * A clinician's commission for a pay period: a percentage of what they produced.
 *
 * **Why this exists.** A salary row has carried `officeCommission` and a `percentage` since the
 * ERP this was repurposed from, the salary form asks for both, and the payslip has a commission
 * column — and the payroll run wrote 0 into it for everyone. A dentist on 30% was paid their basic
 * salary alone, with nothing on screen to say anything was missing.
 *
 * **The rule.** Every procedure the clinician *completed* in the period, at its charted `fee`,
 * times the commission rate on their salary row **in force on the day the work was done**. Taking
 * the rate per procedure rather than per month is what makes a mid-month salary change come out
 * right: work before the change earns the old rate, work after it the new one. Only approved
 * salary rows count, the same rule the run applies to the salary itself, and only rows with
 * commission switched on.
 *
 * The clinician is found through `provider.employeeId` — procedures are attributed to a provider,
 * which is someone licensed to have done the work, and pay belongs to the employee behind it.
 *
 * Non-goals:
 *   - **Collections.** This pays on production — work done — not on money received. There is no
 *     invoice yet to pay on (billing is a later stage); when there is, a clinic that pays on
 *     collections is a second rule beside this one, not a change to it.
 *   - **Lab fees and materials.** Some clinics deduct them before the percentage. None of that is
 *     recorded against a procedure today, so there is nothing to deduct.
 *   - **Tax.** Commission is employment income; the run adds it to gross and taxable pay like any
 *     other earning, and `payrollMath.ts` taxes the total.
 */
import { and, between, eq, isNull, lte, or, gte, sql } from 'drizzle-orm';

import { db } from './db';
import { procedures } from './db/schema/procedures';
import { provider } from './db/schema/providers';
import { salaries } from './db/schema';
import { isApproved } from './approvals';
import { notDeleted } from './softDelete';

/** The database or a transaction on it — a test reads inside its own rollback. */
type Reader = Pick<typeof db, 'select'>;

/**
 * The aliases are deliberately not `commission_amount`: Drizzle names a subquery's columns
 * unqualified, and the payroll run also joins `payroll_entries`, which has a column of that name —
 * the run failed as an ambiguous reference the first time this was joined into it.
 *
 * Commission per employee for `start`–`end` (calendar days, `YYYY-MM-DD`, inclusive), as a
 * subquery the payroll run joins on `staffId`: `production` is the fees the rate applied to,
 * `commission` the amount, rounded to the cent.
 */
export function commissionByStaff(start: string, end: string, reader: Reader = db) {
	return (
		reader
			.select({
				staffId: provider.employeeId,
				production: sql<number>`COALESCE(SUM(${procedures.fee}), 0)`.as('commission_fees'),
				commission:
					sql<number>`ROUND(COALESCE(SUM(${procedures.fee} * ${salaries.percentage} / 100), 0), 2)`.as(
						'commission_earned'
					)
			})
			.from(procedures)
			// Not filtered on the provider's deletion: work done before a clinician left is still owed.
			.innerJoin(provider, eq(provider.id, procedures.providerId))
			.innerJoin(
				salaries,
				and(
					eq(salaries.staffId, provider.employeeId),
					eq(salaries.officeCommission, true),
					lte(salaries.startDate, procedures.completedOn),
					or(isNull(salaries.endDate), gte(salaries.endDate, procedures.completedOn)),
					isApproved(salaries),
					notDeleted(salaries)
				)
			)
			.where(
				and(
					eq(procedures.status, 'completed'),
					between(procedures.completedOn, start, end),
					notDeleted(procedures)
				)
			)
			.groupBy(provider.employeeId)
			.as('commission_sub')
	);
}
