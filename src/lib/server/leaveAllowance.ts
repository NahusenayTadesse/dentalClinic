// The per-type cap on a leave request.
//
// `leave_type.max_days` is shown to the user as the allowance for that type ("Marriage Leave:
// Leave up to 5 days"), but nothing used to stop a request going past it. This is the check
// that makes the displayed figure real.
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { leaveType } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { formatDays } from '$lib/leaveDays';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/**
 * Checks a request against its type's allowance.
 *
 * A `maxDays` of 0 means "no limit configured", not "no days allowed" — the column defaults to
 * 0 and every type starts there, so reading it literally would block the type outright. A type
 * with no id attached is unconstrained for the same reason.
 *
 * Returns a ready-to-show message when the request exceeds the allowance, or null when it fits.
 */
export async function leaveAllowanceError(
	database: Db,
	leaveTypeId: number | null | undefined,
	days: number
): Promise<string | null> {
	if (leaveTypeId === null || leaveTypeId === undefined) return null;

	const [type] = await database
		.select({ name: leaveType.name, maxDays: leaveType.maxDays })
		.from(leaveType)
		.where(and(eq(leaveType.id, leaveTypeId), notDeleted(leaveType)));

	if (!type || type.maxDays <= 0 || days <= type.maxDays) return null;

	return (
		`${type.name} allows at most ${formatDays(type.maxDays)}, ` +
		`but this request is ${formatDays(days)}.`
	);
}
