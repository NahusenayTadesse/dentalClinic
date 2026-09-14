/**
 * What can happen to an appointment next, as one table both halves read.
 *
 * The server refuses a move that is not here; the day view only offers the moves that are. One list,
 * so a button cannot offer something the action will refuse — the same reason `canVisit` is shared
 * by the route gate and the menu (CLAUDE.md §12).
 *
 *     scheduled ─┬─ confirmed ─┬─ arrived ── inChair ── completed
 *                │             │
 *                └─────────────┴─ noShow · cancelled  (from anything not yet in the chair)
 *
 * Some shortcuts are deliberate. A walk-in is `arrived` without ever being `scheduled`; a patient
 * who was never phoned still turns up, so `scheduled → arrived` is allowed; a quick review can go
 * straight from `arrived` to `completed` without anybody marking the chair.
 *
 * **Terminal states stay terminal.** A completed visit is not re-opened, and a cancelled one is not
 * un-cancelled: the answer to "the patient came after all" is a new appointment with
 * `rebookedFromId` pointing back, so the history says what happened instead of being rewritten.
 * `arrived → scheduled` exists only to undo a mis-click on the wrong row.
 */

export const APPOINTMENT_STATUSES = [
	'scheduled',
	'confirmed',
	'arrived',
	'inChair',
	'completed',
	'noShow',
	'cancelled'
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** The moves out of each status. */
export const NEXT_STATUS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
	scheduled: ['confirmed', 'arrived', 'noShow', 'cancelled'],
	confirmed: ['arrived', 'noShow', 'cancelled'],
	arrived: ['inChair', 'completed', 'scheduled', 'cancelled'],
	inChair: ['completed'],
	completed: [],
	noShow: [],
	cancelled: []
};

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
	return typeof value === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

export function canMove(from: AppointmentStatus, to: AppointmentStatus): boolean {
	return NEXT_STATUS[from].includes(to);
}

/** Still holding its chair: what the overlap check counts and what may be moved or rebooked. */
export function isLive(status: AppointmentStatus): boolean {
	return status !== 'cancelled' && status !== 'noShow';
}

/** May still be rescheduled — it has not started. */
export function isMovable(status: AppointmentStatus): boolean {
	return status === 'scheduled' || status === 'confirmed';
}

/** How each status is said on screen, and what the button that moves into it says. */
export const STATUS_LABEL: Record<AppointmentStatus, { label: string; action: string }> = {
	scheduled: { label: 'Scheduled', action: 'Undo arrival' },
	confirmed: { label: 'Confirmed', action: 'Mark confirmed' },
	arrived: { label: 'Arrived', action: 'Mark arrived' },
	inChair: { label: 'In chair', action: 'Seat in chair' },
	completed: { label: 'Completed', action: 'Complete visit' },
	noShow: { label: 'No-show', action: 'Mark no-show' },
	cancelled: { label: 'Cancelled', action: 'Cancel' }
};
