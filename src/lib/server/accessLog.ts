import { and, count, desc, eq, gte, inArray, like, lt, or, type SQL } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { branch, patient, patientAccessLog, user } from '$lib/server/db/schema';
import { mergedInto } from '$lib/server/patientMerge';
import { patientFullName } from '$lib/server/patients';

/**
 * Reading the patient access log — who opened which part of whose chart. Writing it is
 * `logPatientView` in `server/patients.ts`; this module only answers the two questions the log is
 * kept for: *who has looked at this patient* (the chart's Access log tab, and the last few on the
 * overview) and *what has this person been looking at* (Reports → System).
 *
 * **Read across merges.** A merge does not rewrite the log — it is evidence — so a patient's
 * history includes the views of the records merged into them.
 *
 * **Not branch scoped.** The log records where something happened; filtering evidence by where
 * the reader is sitting is how it fails to be found (CLAUDE.md §15). Who may read it at all is
 * `audit_logs.view`, checked by the caller.
 *
 * **Attribution is not filtered.** A deleted user still opened what they opened (§9).
 *
 * Non-goal: a "suspicious access" score. Which looks are wrong depends on who is treating whom,
 * and a heuristic that guesses would teach people to ignore it.
 */

/** The columns every reading of the log shows. */
function viewColumns() {
	return {
		id: patientAccessLog.id,
		patientId: patientAccessLog.patientId,
		patient: patientFullName,
		fileNo: patient.fileNo,
		userId: patientAccessLog.userId,
		user: user.name,
		recordType: patientAccessLog.recordType,
		recordId: patientAccessLog.recordId,
		action: patientAccessLog.action,
		branch: branch.name,
		ipAddress: patientAccessLog.ipAddress,
		viewedAt: patientAccessLog.viewedAt
	};
}

/** The log joined to who, whose and where, under a condition. */
function views(where: SQL | undefined) {
	return db
		.select(viewColumns())
		.from(patientAccessLog)
		.innerJoin(patient, eq(patient.id, patientAccessLog.patientId))
		.leftJoin(user, eq(user.id, patientAccessLog.userId))
		.leftJoin(branch, eq(branch.id, patientAccessLog.branchId))
		.where(where)
		.orderBy(desc(patientAccessLog.viewedAt), desc(patientAccessLog.id));
}

/**
 * Who has opened this patient's chart, newest first — the records merged into them included.
 * `limit` keeps the overview's short list short; the tab asks for the rest.
 */
export async function patientAccessHistory(patientId: number, limit = 2000) {
	const ids = [patientId, ...(await mergedInto(patientId))];
	return views(inArray(patientAccessLog.patientId, ids)).limit(limit);
}

/**
 * The log over a window of instants, optionally narrowed to a person — the System report's
 * ledger, which is how "what has this member of staff been opening" is answered. `search` matches
 * the user's name or the patient's, so the same box follows a person either way.
 */
export function accessLogWhere(range: { from: Date; to: Date }, search = ''): SQL | undefined {
	const term = search.trim();
	return and(
		gte(patientAccessLog.viewedAt, range.from),
		lt(patientAccessLog.viewedAt, range.to),
		term
			? or(
					like(user.name, `%${term}%`),
					like(patient.name, `%${term}%`),
					like(patient.fatherName, `%${term}%`),
					like(patient.fileNo, `%${term}%`)
				)
			: undefined
	);
}

/** A page of the log under `accessLogWhere`, newest first. */
export function accessLogPage(where: SQL | undefined, limit: number, offset: number) {
	return views(where).limit(limit).offset(offset);
}

/** How many rows `accessLogWhere` matches, for the ledger's pager. */
export async function accessLogCount(where: SQL | undefined): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(patientAccessLog)
		.innerJoin(patient, eq(patient.id, patientAccessLog.patientId))
		.leftJoin(user, eq(user.id, patientAccessLog.userId))
		.where(where);
	return row?.total ?? 0;
}
