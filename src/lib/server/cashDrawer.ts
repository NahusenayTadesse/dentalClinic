/**
 * The cash drawer: opening it with a float, what it should hold, and counting it at the end of
 * the shift (`cash_session`).
 *
 * **What the drawer should hold is worked out, then frozen.** While a session is open the
 * expected figure is live — the float plus cash taken in, less cash paid out, through this
 * session's payments. At the count it is written down (`expectedAmount`) beside what was counted,
 * so a payment backdated into a closed day cannot move a variance that was already signed off.
 * The variance itself is never stored: counted less expected, both frozen.
 *
 * **One drawer per branch at a time.** Taking cash needs the branch's drawer open
 * (`openSessionFor`), and opening a second while one is open is refused.
 *
 * Non-goal: denominations. The count is a total typed in; a clinic that counts note by note does so
 * on paper and types the sum.
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { cashSession, transactions, user } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { WriteRefused } from '$lib/server/childCrud';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '$lib/server/db/insert';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { cents } from '$lib/invoiceStatus';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it. */
type Reader = typeof db | Tx;

/**
 * The drawer open at this branch, if one is. Locked when read inside a transaction, so a payment
 * and a close cannot pass each other: the count waits for the payment, or the payment finds the
 * drawer shut.
 */
export async function openSessionFor(reader: Reader, branchId: number | null) {
	if (branchId === null) return null;
	const [row] = await reader
		.select({ id: cashSession.id, openingFloat: cashSession.openingFloat })
		.from(cashSession)
		.where(
			and(
				eq(cashSession.branchId, branchId),
				eq(cashSession.status, 'open'),
				notDeleted(cashSession)
			)
		)
		.orderBy(desc(cashSession.id))
		.limit(1)
		.for('update');
	return row ?? null;
}

/**
 * Cash through a session: taken in, paid out, and how many payments — from the payments recorded
 * against it. A refused refund does not count; one still waiting does, because the money has left.
 */
export async function sessionTakings(sessionId: number, reader: Reader = db) {
	const [row] = await reader
		.select({
			cashIn: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'in' THEN ${transactions.amount} ELSE 0 END), 0)`,
			cashOut: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'out' THEN ${transactions.amount} ELSE 0 END), 0)`,
			payments: sql<number>`COUNT(*)`
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.cashSessionId, sessionId),
				sql`${transactions.approvalStatus} <> 'rejected'`,
				notDeleted(transactions)
			)
		);
	return {
		cashIn: cents(Number(row?.cashIn ?? 0)),
		cashOut: cents(Number(row?.cashOut ?? 0)),
		payments: Number(row?.payments ?? 0)
	};
}

/**
 * The drawer at this branch as the cash screen shows it: the open session with its live expected
 * figure, or none; and the recent closed sessions with their variances.
 */
export async function drawerState(branch: Pick<BranchContext, 'active'>) {
	const current = await openSessionFor(db, branch.active);
	let open = null;
	if (current) {
		const [session] = await db
			.select({
				id: cashSession.id,
				openingFloat: cashSession.openingFloat,
				openedAt: cashSession.openedAt,
				openedBy: user.name
			})
			.from(cashSession)
			.leftJoin(user, eq(user.id, cashSession.openedBy))
			.where(eq(cashSession.id, current.id));
		const takings = await sessionTakings(current.id);
		open = {
			...session,
			...takings,
			expected: cents(session.openingFloat + takings.cashIn - takings.cashOut)
		};
	}

	const closed = await db
		.select({
			id: cashSession.id,
			openedAt: cashSession.openedAt,
			closedAt: cashSession.closedAt,
			openingFloat: cashSession.openingFloat,
			expectedAmount: cashSession.expectedAmount,
			countedAmount: cashSession.countedAmount,
			bankedAmount: cashSession.bankedAmount,
			note: cashSession.note,
			closedBy: user.name
		})
		.from(cashSession)
		.leftJoin(user, eq(user.id, cashSession.closedBy))
		.where(
			and(
				eq(cashSession.status, 'closed'),
				notDeleted(cashSession),
				branchFilter(cashSession.branchId, branch)
			)
		)
		.orderBy(desc(cashSession.closedAt))
		.limit(30);

	return {
		open,
		closed: closed.map((s) => ({
			...s,
			variance: cents((s.countedAmount ?? 0) - (s.expectedAmount ?? 0))
		}))
	};
}

/** Opens the branch's drawer with the float in it. Refused while one is already open. */
export async function openDrawer(
	tx: Tx,
	event: AuditRequest,
	branchId: number | null,
	openingFloat: number
): Promise<number> {
	if (branchId === null) {
		throw new WriteRefused(null, 'Choose the branch you are working at before opening a drawer.');
	}
	if (openingFloat < 0) throw new WriteRefused('openingFloat', 'A float cannot be negative.');
	if (await openSessionFor(tx, branchId)) {
		throw new WriteRefused(
			null,
			'The drawer is already open at this branch. Count and close it first.'
		);
	}
	const id = await insertReturningId(tx, cashSession, {
		branchId,
		openingFloat: cents(openingFloat),
		openedAt: new Date(),
		openedBy: event.locals.user?.id ?? null,
		status: 'open',
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'cash_session', recordId: id, action: 'create' });
	return id;
}

/**
 * Counts and closes the branch's drawer: the expected figure frozen beside what was counted and
 * what was banked. A variance needs a note — the field that makes it useful rather than alarming.
 * Returns the variance, for the screen to say.
 */
export async function closeDrawer(
	tx: Tx,
	event: AuditRequest,
	branchId: number | null,
	count: { counted: number; banked: number; note: string | null }
): Promise<number> {
	const session = await openSessionFor(tx, branchId);
	if (!session) throw new WriteRefused(null, 'There is no open drawer at this branch.');
	if (count.counted < 0) throw new WriteRefused('countedAmount', 'A count cannot be negative.');
	if (count.banked < 0 || count.banked > count.counted) {
		throw new WriteRefused('bankedAmount', 'Banked must be between nothing and what was counted.');
	}

	const takings = await sessionTakings(session.id, tx);
	const expected = cents(session.openingFloat + takings.cashIn - takings.cashOut);
	const variance = cents(count.counted - expected);
	const note = count.note?.trim() || null;
	if (variance !== 0 && !note) {
		throw new WriteRefused(
			'note',
			`The count is ${variance > 0 ? 'over' : 'short'} by ${Math.abs(variance)}. Say what you know about why.`
		);
	}

	const written = {
		status: 'closed' as const,
		closedAt: new Date(),
		closedBy: event.locals.user?.id ?? null,
		countedAmount: cents(count.counted),
		expectedAmount: expected,
		bankedAmount: cents(count.banked),
		note,
		updatedBy: event.locals.user?.id
	};
	await tx.update(cashSession).set(written).where(eq(cashSession.id, session.id));
	await recordAudit(tx, event, {
		table: 'cash_session',
		recordId: session.id,
		action: 'update',
		before: { status: 'open' },
		after: written
	});
	return variance;
}
