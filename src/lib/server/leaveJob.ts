// The scheduled half of annual leave: grant what is due, void what has gone stale, and leave a
// `job_run` row behind so a cron that stops firing is visible in the app.
//
// Safe to call as often as you like. Granting is protected by the unique index on
// (staff_id, service_year) and expiry only touches grants already past their date, so a double
// fire — cron and backstop racing, say — changes nothing the first run did not already do.
import { db } from '$lib/server/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { jobRun } from '$lib/server/db/schema';
import { runAccrual, runExpiry } from '$lib/server/leaveAccrual';

export const LEAVE_JOB_NAME = 'leave-accrual';

/** How stale the last success may get before the request backstop steps in for the cron. */
export const BACKSTOP_AFTER_HOURS = 36;

export type JobTrigger = 'cron' | 'manual' | 'backstop';

export type JobResult = {
	runId: number;
	granted: number;
	days: number;
	expired: number;
	daysLost: number;
	summary: string;
};

/** The most recent run of the leave job, whatever its outcome. */
export async function lastLeaveJobRun() {
	const [run] = await db
		.select()
		.from(jobRun)
		.where(eq(jobRun.jobName, LEAVE_JOB_NAME))
		.orderBy(desc(jobRun.startedAt))
		.limit(1);

	return run ?? null;
}

/** The most recent run that actually completed, used to decide whether the cron has gone quiet. */
export async function lastSuccessfulLeaveJobRun() {
	const [run] = await db
		.select()
		.from(jobRun)
		.where(and(eq(jobRun.jobName, LEAVE_JOB_NAME), eq(jobRun.status, 'success')))
		.orderBy(desc(jobRun.startedAt))
		.limit(1);

	return run ?? null;
}

/** True when no successful run has been recorded inside the backstop window. */
export async function leaveJobIsOverdue(now: Date = new Date()): Promise<boolean> {
	const last = await lastSuccessfulLeaveJobRun();
	if (!last) return true;

	const ageHours = (now.getTime() - last.startedAt.getTime()) / (1000 * 60 * 60);
	return ageHours >= BACKSTOP_AFTER_HOURS;
}

/**
 * Grants everything due and voids everything stale, recording the outcome either way. Errors are
 * written to the run row and rethrown so the caller can decide the response code.
 */
export async function runLeaveJob(
	trigger: JobTrigger,
	userId?: string,
	asOf: Date = new Date()
): Promise<JobResult> {
	const [run] = await db
		.insert(jobRun)
		.values({ jobName: LEAVE_JOB_NAME, trigger, status: 'running' })
		.$returningId();

	try {
		const accrual = await runAccrual(userId, asOf);
		const expiry = await runExpiry(userId, asOf);

		const summary =
			`Granted ${accrual.days} days in ${accrual.granted} entries for ${accrual.staff} employees; ` +
			`expired ${expiry.expired} grants for ${expiry.staff} employees, voiding ${expiry.daysLost} unused days`;

		await db
			.update(jobRun)
			.set({ status: 'success', finishedAt: sql`now()`, summary })
			.where(eq(jobRun.id, run.id));

		return {
			runId: run.id,
			granted: accrual.granted,
			days: accrual.days,
			expired: expiry.expired,
			daysLost: expiry.daysLost,
			summary
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';

		await db
			.update(jobRun)
			.set({ status: 'failed', finishedAt: sql`now()`, error: message.slice(0, 500) })
			.where(eq(jobRun.id, run.id));

		throw err;
	}
}
