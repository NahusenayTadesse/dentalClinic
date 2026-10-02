/**
 * Orthodontic cases: the appliances, the payment plan, and how far along a case is. Client-safe and
 * pure — the case page shows a schedule before it is saved, worked out by the rule the server
 * saves it by (`server/ortho.ts`).
 *
 * **Why a plan, not a bill.** Braces are one treatment over eighteen months to two years, and
 * clinics here charge for them as a deposit and then a fixed sum each month. Billing the whole fee
 * on the first day puts a large debt on the patient's record that is not yet owed; billing each
 * adjustment visit ties the fee to how often the patient comes, which is not the agreement. So
 * the case holds a schedule of instalments, and each one becomes an ordinary bill when it falls
 * due — paid, receipted and reported like any other.
 *
 * Non-goals: interest or late fees (not how clinics here charge), and changing a schedule once
 * instalments have been billed — a revised fee is a note and a new case, so what was agreed stays
 * readable.
 */
import { addClinicMonths } from './clinicTime';

/** What the patient wears. */
export const APPLIANCES = [
	'fixedBoth',
	'fixedUpper',
	'fixedLower',
	'removable',
	'aligners',
	'functional'
] as const;
export type Appliance = (typeof APPLIANCES)[number];

export const APPLIANCE_LABEL: Record<Appliance, string> = {
	fixedBoth: 'Fixed braces, both arches',
	fixedUpper: 'Fixed braces, upper',
	fixedLower: 'Fixed braces, lower',
	removable: 'Removable appliance',
	aligners: 'Clear aligners',
	functional: 'Functional appliance'
};

/** Where a case is. `retention` is braces off, retainers on, still being seen. */
export const ORTHO_STATUSES = ['active', 'retention', 'finished', 'discontinued'] as const;
export type OrthoStatus = (typeof ORTHO_STATUSES)[number];

export const ORTHO_STATUS_LABEL: Record<OrthoStatus, string> = {
	active: 'In treatment',
	retention: 'Retention',
	finished: 'Finished',
	discontinued: 'Discontinued'
};

/** One instalment of the plan: `n` 0 is the deposit. */
export type Instalment = { n: number; dueOn: string; amount: number };

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The payment plan: the deposit due on the day treatment starts, then the rest in `count` equal
 * monthly instalments, the first a month after the start. Cents left by the division go on the
 * last, so the plan adds up to the fee exactly.
 */
export function instalmentSchedule(input: {
	totalFee: number;
	deposit: number;
	count: number;
	startedOn: string;
}): Instalment[] {
	const plan: Instalment[] = [];
	if (input.deposit > 0) plan.push({ n: 0, dueOn: input.startedOn, amount: cents(input.deposit) });
	const rest = cents(input.totalFee - input.deposit);
	if (input.count < 1 || rest <= 0) return plan;
	const each = Math.floor((rest / input.count) * 100) / 100;
	for (let n = 1; n <= input.count; n++) {
		const amount = n === input.count ? cents(rest - each * (input.count - 1)) : each;
		plan.push({ n, dueOn: addClinicMonths(input.startedOn, n), amount });
	}
	return plan;
}

/** What is wrong with a plan's numbers, or null. */
export function planProblem(input: {
	totalFee: number;
	deposit: number;
	count: number;
}): string | null {
	if (!(input.totalFee > 0)) return 'Give the fee for the whole treatment.';
	if (input.deposit < 0 || input.deposit > input.totalFee)
		return 'The deposit is more than the fee.';
	if (input.deposit < input.totalFee && input.count < 1)
		return 'Say how many monthly instalments pay the rest.';
	if (input.count > 60) return 'Five years of instalments at most.';
	return null;
}

/** Months since the start, against the months planned — for the progress bar. */
export function caseProgress(startedOn: string, plannedMonths: number, today: string) {
	const [y1, m1, d1] = startedOn.split('-').map(Number);
	const [y2, m2, d2] = today.split('-').map(Number);
	const months = Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
	return {
		months,
		percent: plannedMonths > 0 ? Math.min(100, Math.round((months / plannedMonths) * 100)) : 0,
		overrun: plannedMonths > 0 && months > plannedMonths
	};
}

export type InstalmentState = 'upcoming' | 'due' | 'billed' | 'overdue' | 'paid' | 'cancelled';

export const INSTALMENT_STATE_LABEL: Record<InstalmentState, string> = {
	upcoming: 'Upcoming',
	due: 'Due — not billed',
	billed: 'Billed',
	overdue: 'Billed, overdue',
	paid: 'Paid',
	cancelled: 'Cancelled'
};

/**
 * Where an instalment stands, from its due date and its bill. A bill voided by a manager leaves the
 * instalment cancelled, not due again — whoever voided it decided it is not owed.
 */
export function instalmentState(
	instalment: { dueOn: string },
	bill: { status: 'draft' | 'issued' | 'partly' | 'paid' | 'void' } | null,
	today: string
): InstalmentState {
	if (!bill) return instalment.dueOn <= today ? 'due' : 'upcoming';
	if (bill.status === 'paid') return 'paid';
	if (bill.status === 'void') return 'cancelled';
	return instalment.dueOn < today ? 'overdue' : 'billed';
}
