/**
 * The statuses a charted procedure can have, and how each reads on screen.
 *
 * Spelled once for three readers: the `procedures.status` enum, the charting form's validator, and
 * the chart's labels and legend. Client-safe for the same reason as `$lib/serviceAreas.ts`.
 * `db/schema/procedures.ts` explains what each status means clinically; this says only what the
 * chart does with it.
 */
export const PROCEDURE_STATUSES = [
	'planned',
	'completed',
	'existing',
	'referred',
	'condition',
	'cancelled'
] as const;

/** One of `PROCEDURE_STATUSES`. */
export type ProcedureStatus = (typeof PROCEDURE_STATUSES)[number];

/** Whether an arbitrary string is a procedure status. */
export function isProcedureStatus(value: string): value is ProcedureStatus {
	return (PROCEDURE_STATUSES as readonly string[]).includes(value);
}

/** The label, and a line saying when to choose it, as the charting form offers it. */
export const PROCEDURE_STATUS_LABEL: Record<ProcedureStatus, { label: string; hint: string }> = {
	condition: { label: 'Finding', hint: 'Found on examination, not yet treated' },
	planned: { label: 'Planned', hint: 'Proposed, not yet done' },
	completed: { label: 'Done here', hint: 'Treated at this clinic' },
	existing: { label: 'Already present', hint: 'Work or a gap the patient arrived with' },
	referred: { label: 'Referred', hint: 'Sent elsewhere to be done' },
	cancelled: { label: 'Cancelled', hint: 'Proposed, then declined or abandoned' }
};

/**
 * Statuses that are not a charge: a finding, and work somebody else did. The server clears their
 * fee, so a chart can never bill a patient for their own decay or a filling from another clinic.
 */
export const UNBILLED_STATUSES: readonly ProcedureStatus[] = ['condition', 'existing'];
