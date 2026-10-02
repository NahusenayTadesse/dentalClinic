/**
 * What can happen to a lab case next, as one table the board, the chart and the server all read —
 * the same arrangement as `$lib/appointmentStatus.ts`, for the same reason: a button cannot offer
 * a move the action will refuse.
 *
 *     draft ── sent ── received ── fitted
 *                ▲         │
 *                └─ remake ┘        (sent back; `remakes` counts the trips)
 *     draft · sent · remake ── cancelled
 *
 * **`remake` is a case that is out at the lab again**, so it is "out" exactly as `sent` is: it has
 * a due date, it can be overdue, and receiving it brings it back to `received`. A remake is chosen
 * from `received` — the work came back wrong — and never after fitting: work that fails once
 * fitted is a new case, because it is a new treatment decision.
 *
 * Terminal: `fitted` and `cancelled`. A received case is not cancelled — it exists and has been
 * paid for; if it is not used, that is a remake or a note, not a deletion of what happened.
 */

export const LAB_CASE_STATUSES = [
	'draft',
	'sent',
	'received',
	'fitted',
	'remake',
	'cancelled'
] as const;

export type LabCaseStatus = (typeof LAB_CASE_STATUSES)[number];

/** The moves out of each status. */
export const NEXT_LAB_STATUS: Record<LabCaseStatus, readonly LabCaseStatus[]> = {
	draft: ['sent', 'cancelled'],
	sent: ['received', 'cancelled'],
	remake: ['received', 'cancelled'],
	received: ['fitted', 'remake'],
	fitted: [],
	cancelled: []
};

export function isLabCaseStatus(value: unknown): value is LabCaseStatus {
	return typeof value === 'string' && (LAB_CASE_STATUSES as readonly string[]).includes(value);
}

export function canMoveLabCase(from: LabCaseStatus, to: LabCaseStatus): boolean {
	return NEXT_LAB_STATUS[from].includes(to);
}

/** At the laboratory: what has a due date that can pass. */
export function isOut(status: LabCaseStatus): boolean {
	return status === 'sent' || status === 'remake';
}

/** Out at the lab and past the day it was promised. `today` is the clinic's date, `YYYY-MM-DD`. */
export function isOverdue(
	row: { status: LabCaseStatus; dueOn: string | null },
	today: string
): boolean {
	return isOut(row.status) && row.dueOn !== null && row.dueOn < today;
}

/** How each status is said on screen, and what the button that moves into it says. */
export const LAB_STATUS_LABEL: Record<LabCaseStatus, { label: string; action: string }> = {
	draft: { label: 'Not sent', action: '' },
	sent: { label: 'At the lab', action: 'Sent to the lab' },
	remake: { label: 'Back at the lab (remake)', action: 'Send back for a remake' },
	received: { label: 'Back — ready to fit', action: 'Received from the lab' },
	fitted: { label: 'Fitted', action: 'Fitted' },
	cancelled: { label: 'Cancelled', action: 'Cancel' }
};

/**
 * One case as the lists show it — the board and the chart's tab — so both draw it from one column
 * set. Here rather than inferred from the server query because client code cannot import from
 * `$lib/server`; `server/labCases.ts` returns rows of this shape.
 */
export type LabCaseRow = {
	id: number;
	patientId: number;
	lab: string;
	work: string | null;
	toothId: number | null;
	toothRange: string | null;
	shade: string | null;
	status: string;
	sentOn: string | null;
	dueOn: string | null;
	receivedOn: string | null;
	fittedOn: string | null;
	remakes: number;
	labFee: number | null;
	instructions: string | null;
	provider: string | null;
	overdue: boolean;
	/** On the board only: whose case it is. */
	patient?: string;
	phone?: string | null;
};
