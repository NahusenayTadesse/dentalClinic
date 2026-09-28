/**
 * What can happen to a treatment plan next, as one table both halves read — the server refuses a
 * step that is not here, and the plan page only offers the steps that are. The same arrangement as
 * `appointmentStatus.ts`, for the same reason: a button cannot offer what the action will refuse.
 *
 *     draft ── presented ─┬─ accepted ─┐
 *                         ├─ partial  ─┴─ completed
 *                         ├─ declined
 *                         └─ expired        (read, not written — see `effectiveStatus`)
 *
 * **The answer comes from the lines.** The patient's answer is recorded line by line, and the plan's
 * status follows from them (`outcomeOf`): every line yes is `accepted`, some is `partial`, none is
 * `declined`. Declining outright is the same act with every line marked no, so a declined plan and
 * its lines can never disagree.
 *
 * **Expiry is derived, never stored by a job.** A presented plan whose `validUntil` has passed reads
 * as `expired` everywhere it is shown, and refuses an answer. Nothing has to run at midnight for that
 * to be true, and nothing can forget to.
 *
 * **A live quote can be adjusted, and every adjustment is kept.** Before presentation the lines
 * are a draft and change freely. After it, a change — a discount, a line re-priced after the X-ray,
 * a line quoted twice — is allowed while the quote is live (`canAdjust`), needs a reason, and
 * writes a row to `treatment_plan_adjustment` that is never updated or deleted.
 *
 * **Terminal states stay terminal**, as with appointments. A declined plan is not re-opened: the
 * patient who comes back in November gets a new plan, with today's prices, and the old one stays as
 * the record of what they were told in March.
 *
 * Client-safe: no server imports.
 */

export const PLAN_STATUSES = [
	'draft',
	'presented',
	'accepted',
	'partial',
	'declined',
	'expired',
	'completed'
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** What the patient said to one line. */
export type LineDecision = 'pending' | 'accepted' | 'declined';

/** How each status is said on screen. */
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
	draft: 'Draft',
	presented: 'Awaiting answer',
	accepted: 'Accepted',
	partial: 'Partly accepted',
	declined: 'Declined',
	expired: 'Expired',
	completed: 'Completed'
};

/** How many days a quote stands when nobody says otherwise. */
export const DEFAULT_VALID_DAYS = 90;

/**
 * The status to show and act on: the stored one, except that a presented plan past its validity
 * date is expired. A plan valid until today is still valid today.
 */
export function effectiveStatus(
	status: PlanStatus,
	validUntil: string | null,
	today: string
): PlanStatus {
	if (status === 'presented' && validUntil !== null && validUntil < today) return 'expired';
	return status;
}

/**
 * Still in play: not yet answered, or answered yes and not finished. The work on an open plan is
 * spoken for, so it is not offered for a second plan.
 */
export function isOpen(status: PlanStatus): boolean {
	return (
		status === 'draft' || status === 'presented' || status === 'accepted' || status === 'partial'
	);
}

/**
 * The plan's answer, from its lines' answers: `null` while any line is still pending, otherwise
 * accepted, partial or declined. A plan with no lines has no answer.
 */
export function outcomeOf(decisions: LineDecision[]): 'accepted' | 'partial' | 'declined' | null {
	if (!decisions.length || decisions.includes('pending')) return null;
	const yes = decisions.filter((d) => d === 'accepted').length;
	if (yes === decisions.length) return 'accepted';
	return yes === 0 ? 'declined' : 'partial';
}

/**
 * The lines may be changed freely — added, removed, re-priced — only before anyone has seen them.
 * After that a change is an *adjustment* (`canAdjust`), recorded for good.
 */
export function canEditLines(status: PlanStatus): boolean {
	return status === 'draft';
}

/**
 * A presented quote may still be corrected while it is live — awaiting an answer, or agreed and
 * not finished — each change recorded in `treatment_plan_adjustment` with its reason. An expired,
 * declined or completed quote is history, and is not changed at all.
 */
export function canAdjust(status: PlanStatus): boolean {
	return status === 'presented' || status === 'accepted' || status === 'partial';
}

/**
 * Work may be added to a draft, or to a presented quote before the patient has answered. Once
 * they have, a new line would have no answer of its own, so new work goes on a new plan.
 */
export function canAddLines(status: PlanStatus): boolean {
	return status === 'draft' || status === 'presented';
}

/** An answer may be recorded while the quote stands and nobody has answered yet. */
export function canAnswer(status: PlanStatus): boolean {
	return status === 'presented';
}

/**
 * Finished once there was a yes and every piece of accepted work is done. `acceptedDone` and
 * `acceptedTotal` count accepted lines, and done lines among them, that are linked to charted work.
 */
export function canComplete(status: PlanStatus, acceptedDone: number, acceptedTotal: number) {
	return (
		(status === 'accepted' || status === 'partial') &&
		acceptedTotal > 0 &&
		acceptedDone === acceptedTotal
	);
}

/** Quoted, accepted and declined totals from the lines — never stored, so never disagreeing. */
export function planTotals(lines: { lineTotal: number; decision: LineDecision }[]) {
	const sum = (list: typeof lines) =>
		Math.round(list.reduce((total, line) => total + line.lineTotal, 0) * 100) / 100;
	return {
		quoted: sum(lines),
		accepted: sum(lines.filter((l) => l.decision === 'accepted')),
		declined: sum(lines.filter((l) => l.decision === 'declined'))
	};
}
