// Maker-checker approval, for every table carrying `approvalFields`.
//
// One registry, one queue page, one set of actions. The leave pages are the counter-example:
// three copies of the same file drifted apart and grew six separate ledger bugs between them.
// Nine copies of an approval screen would go the same way, so the entity is data here and the
// route reads it — `/dashboard/approvals/[entity]` serves all of them.
import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNull, ne, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { addClinicDays } from '$lib/clinicTime';
import { db } from '$lib/server/db';
import { notDeleted } from '$lib/server/softDelete';
import {
	customers,
	employee,
	expenses,
	invoice,
	payrollAdjustments,
	payrollRuns,
	salaries,
	transactions
} from '$lib/server/db/schema';
import { employeeFullName } from '$lib/server/employeeName';
import { settleInvoiceRequests } from '$lib/server/invoiceWrites';
import { settleRefunds } from '$lib/server/payments';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** Every table that carries `approvalFields`. */
export type ApprovableTable =
	| typeof employee
	| typeof salaries
	| typeof expenses
	| typeof payrollRuns
	| typeof payrollAdjustments
	| typeof customers
	| typeof invoice
	| typeof transactions;

/**
 * A column in the queue that names another record, and where that record lives.
 *
 * A pending row is only half the story — approving a salary change means knowing
 * whose it is, and an expense means little without who filed it. Declaring the
 * relation here rather than in the table component keeps the promise this file
 * opens with: adding a queue is one entry, links included.
 *
 * Plain strings on purpose: this travels to the browser with the load.
 */
export type ApprovalLink = {
	/** The summary column carrying the id to link to. Hidden as a column of its own. */
	idKey: string;
	/** Base path — the link component appends `/{id}`. */
	href: string;
};

export type ApprovalEntity = {
	/** URL segment, e.g. `/dashboard/approvals/employees`. */
	key: string;
	/** Plural, for headings and the queue index. */
	label: string;
	/** Singular, for "Approve 1 …" style messages. */
	singular: string;
	table: ApprovableTable;
	/** Columns the queue shows, beyond the approval ones. Keys become table columns. */
	summary: (t: never) => Record<string, unknown>;
	/** Summary columns that name another record, keyed by the column showing the name. */
	links?: Record<string, ApprovalLink>;
	/** Where the approved records live, linked from the queue. */
	listHref?: string;
	/**
	 * Runs inside the settling transaction once these ids have been approved, for records whose
	 * approval has to change something else. Never runs on rejection — a rejected record is meant
	 * to leave the world exactly as it found it.
	 */
	onApprove?: (ids: number[], database: Db) => Promise<void>;
	/**
	 * Runs inside the settling transaction once these ids have been rejected — only for records
	 * where the thing waiting was a *change to* a record that already stood, not the record itself.
	 * A bill's discount or void is that: refusing it has to put the bill back as it was, payable
	 * and in the balance, rather than leave a live bill marked rejected. A new record rejected
	 * outright has no such hook, and should not get one.
	 */
	onReject?: (ids: number[], database: Db) => Promise<void>;
};

/** Where each kind of record can be opened. Spelled once so a path change lands everywhere. */
const HREF = {
	employee: '/dashboard/employees/single',
	customer: '/dashboard/customers',
	patient: '/dashboard/patients',
	user: '/dashboard/admin-panel/users'
} as const;

/** The full name of the patient a foreign key points at, as one correlated subquery. */
function patientName(idColumn: SQL | AnyColumn) {
	return sql<string>`(SELECT TRIM(CONCAT(COALESCE(p.name, ''), ' ', COALESCE(p.father_name, '')))
		FROM patient p WHERE p.id = ${idColumn})`;
}

/** The full name of the employee a foreign key points at, as one correlated subquery. */
function employeeName(idColumn: SQL | AnyColumn) {
	return sql<string>`(SELECT TRIM(CONCAT(COALESCE(e.name, ''), ' ', COALESCE(e.father_name, '')))
		FROM employee e WHERE e.id = ${idColumn})`;
}

/**
 * The registry. Adding a table to the queues is a matter of adding an entry here — there is no
 * per-entity route, server file or column definition to write.
 */
export const APPROVAL_ENTITIES: ApprovalEntity[] = [
	{
		key: 'employees',
		label: 'Employees',
		singular: 'employee',
		table: employee,
		listHref: '/dashboard/employees',
		summary: () => ({
			name: employeeFullName,
			idNo: employee.idNo,
			hireDate: employee.hireDate
		}),
		// The record being approved is the employee, so the row's own id is the link.
		links: { name: { idKey: 'id', href: HREF.employee } }
	},
	{
		key: 'salaries',
		label: 'Salary changes',
		singular: 'salary change',
		table: salaries,
		summary: () => ({
			staff: employeeName(salaries.staffId),
			staffId: salaries.staffId,
			amount: salaries.amount,
			startDate: salaries.startDate,
			changeReason: salaries.changeReason
		}),
		links: { staff: { idKey: 'staffId', href: HREF.employee } },
		/**
		 * A salary change only takes effect when it is approved. Until then the employee keeps
		 * earning at the previous rate, so the old row is left open and closed here instead — the
		 * day before the new one starts, which is what `change-salary` used to do at request time.
		 *
		 * Closing it at request time would have left the employee with no open salary at all while
		 * the change sat in the queue, and payroll pro-rates from open rows.
		 */
		onApprove: async (ids, database) => {
			const approved = await database
				.select({ id: salaries.id, staffId: salaries.staffId, startDate: salaries.startDate })
				.from(salaries)
				.where(inArray(salaries.id, ids));

			for (const row of approved) {
				// Calendar arithmetic on the ISO day. It was a `Date` moved with local `setDate`,
				// which on a UTC-midnight day can land two days back in a zone west of Greenwich.
				const dayBefore = addClinicDays(row.startDate, -1);

				await database
					.update(salaries)
					.set({ endDate: dayBefore })
					.where(
						and(
							eq(salaries.staffId, row.staffId),
							isNull(salaries.endDate),
							ne(salaries.id, row.id)
						)
					);
			}
		}
	},
	{
		key: 'expenses',
		label: 'Expenses',
		singular: 'expense',
		table: expenses,
		listHref: '/dashboard/salary/transactions/expenses',
		summary: () => ({
			// An expense belongs to no person or place — the type is the only thing
			// that says what it was, and the queue was showing an amount without it.
			expenseType: sql<string>`(SELECT t.name FROM expenses_type t WHERE t.id = ${expenses.type})`,
			total: expenses.total,
			expenseDate: expenses.expenseDate,
			description: expenses.description
		})
	},
	{
		key: 'payroll-runs',
		label: 'Payroll runs',
		singular: 'payroll run',
		table: payrollRuns,
		summary: () => ({
			month: payrollRuns.month,
			year: payrollRuns.year,
			totalNet: payrollRuns.totalNet,
			totalGross: payrollRuns.totalGross
		})
	},
	{
		key: 'payroll-adjustments',
		label: 'Payroll adjustments',
		singular: 'payroll adjustment',
		table: payrollAdjustments,
		summary: () => ({
			// Two hops: the adjustment hangs off a payroll entry, and the entry names
			// the employee. Without it the queue asked you to approve money for nobody.
			staff: sql<string>`(SELECT TRIM(CONCAT(COALESCE(e.name, ''), ' ', COALESCE(e.father_name, '')))
				FROM payroll_entries pe JOIN employee e ON e.id = pe.staff_id
				WHERE pe.id = ${payrollAdjustments.payrollEntryId})`,
			staffId: sql<
				number | null
			>`(SELECT pe.staff_id FROM payroll_entries pe WHERE pe.id = ${payrollAdjustments.payrollEntryId})`,
			adjustmentType: payrollAdjustments.adjustmentType,
			amount: payrollAdjustments.amount,
			reason: payrollAdjustments.reason
		}),
		links: { staff: { idKey: 'staffId', href: HREF.employee } }
	},
	{
		key: 'customers',
		label: 'Payers',
		singular: 'customer',
		table: customers,
		listHref: '/dashboard/customers',
		summary: () => ({
			name: customers.name,
			phone: customers.phone,
			email: customers.email
		}),
		links: { name: { idKey: 'id', href: HREF.customer } }
	},

	/*
	 * The two money-side queues. Unlike every entry above them, these tables default to
	 * `approved` — a queue holding every invoice and every payment a clinic issues is a queue
	 * nobody reads. Only the exceptions arrive here: a discounted or voided bill, and a refund.
	 */
	{
		key: 'invoices',
		label: 'Discounts and Voids',
		singular: 'invoice',
		table: invoice,
		listHref: '/dashboard/billing',
		summary: () => ({
			number: invoice.invoiceNumber,
			patient: patientName(invoice.patientId),
			patientId: invoice.patientId,
			subtotal: invoice.subtotal,
			discount: invoice.discount,
			total: invoice.total,
			// Set when the request is a void; empty when it is a discount.
			voidReason: invoice.voidReason
		}),
		links: {
			patient: { idKey: 'patientId', href: HREF.patient }
		},
		// A bill waits here for one of two reasons — its discount, or a void — and the decision
		// does different things to each (`settleInvoiceRequests`).
		onApprove: (ids, database) => settleInvoiceRequests(ids, 'approved', database),
		onReject: (ids, database) => settleInvoiceRequests(ids, 'rejected', database)
	},
	{
		key: 'refunds',
		label: 'Refunds',
		singular: 'refund',
		table: transactions,
		listHref: '/dashboard/billing',
		summary: () => ({
			description: transactions.description,
			patient: patientName(transactions.patientId),
			patientId: transactions.patientId,
			amount: transactions.amount,
			reverses: transactions.reversesTransactionId
		}),
		links: {
			patient: { idKey: 'patientId', href: HREF.patient }
		},
		// Approving is when the money goes back: numbered, out of the drawer if cash, and the bill
		// and the payment it reverses brought up to date (`settleRefunds`).
		onApprove: (ids, database) => settleRefunds(ids, 'approved', database)
	}
];

/**
 * The entity's own links plus the one every queue has: who asked for this.
 * `requestedBy` is selected for all of them by `pendingRows`, so the requester
 * is always linkable and no entity has to say so.
 */
export function approvalLinks(entity: ApprovalEntity): Record<string, ApprovalLink> {
	return {
		...entity.links,
		requestedByName: { idKey: 'requestedBy', href: HREF.user }
	};
}

export function findEntity(key: string): ApprovalEntity {
	const entity = APPROVAL_ENTITIES.find((e) => e.key === key);
	if (!entity) error(404, 'No such approval queue.');
	return entity;
}

/**
 * Only approved records belong in the ordinary lists. Spread this into an existing `where`
 * alongside `notDeleted(...)`.
 *
 * Records created before the approval columns existed were backfilled to `approved`, so this
 * hides nothing historical — only what is genuinely still waiting.
 */
export function isApproved(table: ApprovableTable): SQL | undefined {
	return eq(table.approvalStatus, 'approved');
}

/**
 * The employees among `ids` that no payroll-facing write may touch: still pending, rejected,
 * or soft-deleted. Payroll runs, overtime and deductions all share this rule — an employee who
 * cannot be paid must not accumulate adjustments either.
 *
 * These forms post back the rows the browser was handed, so a page opened before an employee
 * was rejected would otherwise write against them anyway. The list queries already hide them;
 * this is the same rule enforced at write time against ids the client controls.
 */
export async function unapprovedEmployeeIds(ids: number[], database: Db = db): Promise<number[]> {
	if (ids.length === 0) return [];
	const payable = await database
		.select({ id: employee.id })
		.from(employee)
		.where(and(inArray(employee.id, ids), isApproved(employee), notDeleted(employee)));
	const ok = new Set(payable.map((r) => r.id));
	return [...new Set(ids)].filter((id) => !ok.has(id));
}

/** The stamp a creation form applies: a new record enters the queue as this user's request. */
export function asRequested(userId: string | undefined) {
	return { approvalStatus: 'pending' as const, requestedBy: userId ?? null };
}

export type PendingRow = Record<string, unknown> & {
	id: number;
	requestedByName: string | null;
	requestedBy: string | null;
	createdAt: Date | null;
};

/** Everything waiting in one queue, newest request first. */
export async function pendingRows(
	entity: ApprovalEntity,
	database: Db = db
): Promise<PendingRow[]> {
	const t = entity.table;

	return database
		.select({
			id: t.id,
			...(entity.summary as () => Record<string, unknown>)(),
			requestedBy: t.requestedBy,
			requestedByName: sql<
				string | null
			>`(SELECT u.name FROM user u WHERE u.id = ${t.requestedBy})`,
			createdAt: t.createdAt
		})
		.from(t)
		.where(and(eq(t.approvalStatus, 'pending'), notDeleted(t)))
		.orderBy(sql`${t.createdAt} desc`) as Promise<PendingRow[]>;
}

export type RejectedRow = PendingRow & {
	rejectedByName: string | null;
	rejectedAt: Date | null;
	rejectionReason: string | null;
};

/** Everything rejected in one queue, most recently rejected first. */
export async function rejectedRows(
	entity: ApprovalEntity,
	database: Db = db
): Promise<RejectedRow[]> {
	const t = entity.table;

	return database
		.select({
			id: t.id,
			...(entity.summary as () => Record<string, unknown>)(),
			requestedBy: t.requestedBy,
			requestedByName: sql<
				string | null
			>`(SELECT u.name FROM user u WHERE u.id = ${t.requestedBy})`,
			rejectedByName: sql<string | null>`(SELECT u.name FROM user u WHERE u.id = ${t.rejectedBy})`,
			rejectionReason: t.rejectionReason,
			rejectedAt: t.rejectedAt,
			createdAt: t.createdAt
		})
		.from(t)
		.where(and(eq(t.approvalStatus, 'rejected'), notDeleted(t)))
		.orderBy(sql`${t.rejectedAt} desc`) as Promise<RejectedRow[]>;
}

/**
 * Puts rejected records back in the pending queue.
 *
 * The rejection stamp is cleared rather than kept alongside a pending status: a record showing
 * both "waiting" and a rejection reason reads as neither. `requestedBy` is deliberately left
 * alone — the original requester still may not release their own record, and whoever reopened
 * it is recorded in `updatedBy`.
 *
 * The `approval_status = 'rejected'` filter means a stale page cannot drag an already-approved
 * record back into the queue.
 */
export async function reopenApprovals(input: {
	entity: ApprovalEntity;
	ids: number[];
	userId: string;
	database?: Db;
}): Promise<number> {
	const { entity, ids, userId } = input;
	const database = input.database ?? db;
	const t = entity.table;

	if (ids.length === 0) return 0;

	const rows = await database
		.select({ id: t.id })
		.from(t)
		.where(and(inArray(t.id, ids), eq(t.approvalStatus, 'rejected'), notDeleted(t)));

	if (rows.length === 0) return 0;

	await database
		.update(t)
		.set({
			approvalStatus: 'pending',
			rejectedBy: null,
			rejectedAt: null,
			rejectionReason: null,
			approvedBy: null,
			approvedAt: null,
			approvalOverridden: false,
			updatedBy: userId
		})
		.where(
			and(
				inArray(
					t.id,
					rows.map((r) => r.id)
				),
				eq(t.approvalStatus, 'rejected')
			)
		);

	return rows.length;
}

/** How many were rejected in each queue, for the rejections index. */
export async function rejectedCounts(database: Db = db): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};

	for (const entity of APPROVAL_ENTITIES) {
		const t = entity.table;
		const [row] = await database
			.select({ n: sql<number>`COUNT(*)` })
			.from(t)
			.where(and(eq(t.approvalStatus, 'rejected'), notDeleted(t)));

		counts[entity.key] = Number(row?.n ?? 0);
	}

	return counts;
}

/** How many are waiting in each queue, for the index page and the sidebar badge. */
export async function pendingCounts(database: Db = db): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};

	for (const entity of APPROVAL_ENTITIES) {
		const t = entity.table;
		const [row] = await database
			.select({ n: sql<number>`COUNT(*)` })
			.from(t)
			.where(and(eq(t.approvalStatus, 'pending'), notDeleted(t)));

		counts[entity.key] = Number(row?.n ?? 0);
	}

	return counts;
}

export type SettleResult = {
	/** Records actually moved. */
	settled: number;
	/**
	 * Records skipped because the approver had requested them and holds no override. Reported
	 * rather than failed, so approving a mixed batch still lands the rest.
	 */
	blocked: number;
	/** Records released by an approver overriding their own request. */
	overridden: number;
};

/**
 * Approves or rejects a batch.
 *
 * The control this whole feature exists for is one comparison: the approver must not be the
 * requester. It is enforced on user id rather than on permissions, because a super admin holds
 * every permission by definition and would otherwise satisfy both halves alone. Someone with
 * `approvals.override` may still release their own request — that is a deliberate, recorded
 * exception, not a loophole.
 *
 * Rows already settled are skipped: the `approval_status = 'pending'` filter means a stale page
 * or a double submit cannot approve the same record twice.
 */
export async function settleApprovals(input: {
	entity: ApprovalEntity;
	ids: number[];
	decision: 'approved' | 'rejected';
	userId: string;
	canOverride: boolean;
	reason?: string | null;
	database?: Db;
}): Promise<SettleResult> {
	const { entity, ids, decision, userId, canOverride, reason } = input;
	const database = input.database ?? db;
	const t = entity.table;

	if (ids.length === 0) return { settled: 0, blocked: 0, overridden: 0 };

	const rows = await database
		.select({ id: t.id, requestedBy: t.requestedBy })
		.from(t)
		.where(and(inArray(t.id, ids), eq(t.approvalStatus, 'pending'), notDeleted(t)));

	const ownRequests = rows.filter((r) => r.requestedBy === userId).map((r) => r.id);
	const otherRequests = rows.filter((r) => r.requestedBy !== userId).map((r) => r.id);

	// Own requests are only releasable with the override permission; without it they stay put.
	const allowed = canOverride ? [...otherRequests, ...ownRequests] : otherRequests;
	const blocked = canOverride ? 0 : ownRequests.length;

	if (allowed.length === 0) return { settled: 0, blocked, overridden: 0 };

	const now = new Date();
	const stamp =
		decision === 'approved'
			? {
					approvalStatus: 'approved' as const,
					approvedBy: userId,
					approvedAt: now,
					rejectedBy: null,
					rejectedAt: null,
					rejectionReason: null
				}
			: {
					approvalStatus: 'rejected' as const,
					rejectedBy: userId,
					rejectedAt: now,
					rejectionReason: reason ?? null,
					approvedBy: null,
					approvedAt: null
				};

	// Split so the override flag lands only on the rows it is true of.
	if (otherRequests.length) {
		await database
			.update(t)
			.set({ ...stamp, approvalOverridden: false, updatedBy: userId })
			.where(and(inArray(t.id, otherRequests), eq(t.approvalStatus, 'pending')));
	}

	if (canOverride && ownRequests.length) {
		await database
			.update(t)
			.set({ ...stamp, approvalOverridden: true, updatedBy: userId })
			.where(and(inArray(t.id, ownRequests), eq(t.approvalStatus, 'pending')));
	}

	// After the rows are approved, not before: the hook reads them back in their settled state.
	if (decision === 'approved' && entity.onApprove) {
		await entity.onApprove(allowed, database);
	}
	if (decision === 'rejected' && entity.onReject) {
		await entity.onReject(allowed, database);
	}

	return {
		settled: allowed.length,
		blocked,
		overridden: canOverride ? ownRequests.length : 0
	};
}
