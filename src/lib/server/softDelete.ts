import { and, count, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { reverseBankPostings } from '$lib/server/bankLedger';
import {
	address,
	customers,
	damagedSupplies,
	employee,
	employeeGuarantor,
	expenses,
	officeWorkerCommission,
	paymentRequest,
	qualification,
	rolePermissions,
	roles,
	session,
	site,
	siteContracts,
	siteMonthlyPayments,
	specialPermissions,
	staffAccounts,
	staffContacts,
	staffFamilies,
	staffSchedule,
	supplies,
	suppliesAdjustments,
	supplyLeaseEvents,
	supplyLeaseItems,
	supplyLeaseMovements,
	supplyLeases,
	supplySuppliers,
	transactions,
	user,
	workExperience
} from '$lib/server/db/schema';

/**
 * Tables built from `secureFields` already carry a nullable `deletedAt`. A row
 * with a non-null `deletedAt` has been deleted and must never reach the
 * frontend. Nothing here changes the schema — these are query helpers only.
 *
 * This is deliberately separate from `isActive`, which is a *business* state:
 * an expired contract or a terminated employee is inactive but not deleted,
 * and the `/inactive` and `/terminated` listings are supposed to show those.
 */
export type SoftDeletable = { deletedAt: AnyMySqlColumn };

/**
 * Builds the "not deleted" condition for one or more soft-deletable tables.
 *
 * In a `where`, pass the table(s) the query reads from:
 *
 * ```ts
 * .where(and(eq(site.isActive, true), notDeleted(site)))
 * ```
 *
 * In a join, put it in the `on` clause rather than the `where` — a left join
 * whose filter lives in the `where` silently behaves like an inner join and
 * drops the parent row too:
 *
 * ```ts
 * .leftJoin(site, and(eq(siteContracts.siteId, site.id), notDeleted(site)))
 * ```
 *
 * One deliberate exception: **attribution joins are not filtered.** A join on
 * `createdBy`/`updatedBy`/`approvedBy` exists to print who did something, and a
 * deleted user still did it. Filtering those would blank out "Added By" on
 * historical records, which is the opposite of what a soft delete is for — the
 * whole point of keeping the row is that old records stay attributable. Filter
 * `user` only where the query is listing users to act on.
 */
export function notDeleted(...tables: [SoftDeletable, ...SoftDeletable[]]): SQL {
	const conditions = tables.map((table) => isNull(table.deletedAt));
	return conditions.length === 1 ? conditions[0] : (and(...conditions) as SQL);
}

/** The transaction handle drizzle hands to `db.transaction(async (tx) => …)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A soft-deletable table that also hangs off one employee. */
type StaffOwned = SoftDeletable & { id: AnyMySqlColumn; staffId: AnyMySqlColumn };

/**
 * The columns a delete stamps. `isActive` is deliberately left alone: it is a
 * business state, and overwriting it here would destroy the real status of the
 * row if the deletion is ever reversed by clearing `deletedAt`.
 */
const deletionStamp = (userId?: string) => ({
	deletedAt: sql`NOW()`,
	deletedBy: userId ?? null
});

/**
 * Deletes the address rows belonging to a set of owners.
 *
 * Addresses are owned outright — nothing lists them on their own and nothing
 * shares one between two owners — so leaving them behind when their owner is
 * deleted just accumulates unreachable rows. Nulls are filtered out because
 * `address` is optional on most owners.
 */
async function softDeleteAddresses(tx: Tx, addressIds: (number | null)[], userId?: string) {
	const ids = addressIds.filter((id): id is number => typeof id === 'number');
	if (!ids.length) return;

	await tx
		.update(address)
		.set(deletionStamp(userId))
		.where(and(inArray(address.id, ids), notDeleted(address)));
}

/**
 * Deletes one contract. Payments and renewals hanging off it are left in place
 * — they are financial history, and every read of them already joins through
 * `siteContracts`, so they stop surfacing once the contract is gone.
 */
export async function softDeleteContract(tx: Tx, contractId: number, userId?: string) {
	await tx
		.update(siteContracts)
		.set(deletionStamp(userId))
		.where(and(eq(siteContracts.id, contractId), notDeleted(siteContracts)));
}

/**
 * Deletes a site and every contract on it. The schema already cascades
 * `site_contracts` from `site` on a hard delete, so a soft delete that left the
 * contracts behind would contradict the model the FKs describe.
 */
export async function softDeleteSite(tx: Tx, siteId: number, userId?: string) {
	const stamp = deletionStamp(userId);

	await tx
		.update(siteContracts)
		.set(stamp)
		.where(and(eq(siteContracts.siteId, siteId), notDeleted(siteContracts)));

	const addressIds = await tx
		.select({ address: site.address })
		.from(site)
		.where(eq(site.id, siteId))
		.then((rows) => rows.map((row) => row.address));

	await tx
		.update(site)
		.set(stamp)
		.where(and(eq(site.id, siteId), notDeleted(site)));

	await softDeleteAddresses(tx, addressIds, userId);
}

/**
 * Deletes a customer, their sites, and the contracts on those sites. Contracts
 * carry both `siteId` and `customerId`, so both routes to a contract are
 * covered — a contract pointing straight at the customer is caught even if its
 * site row somehow is not.
 */
export async function softDeleteCustomer(tx: Tx, customerId: number, userId?: string) {
	const stamp = deletionStamp(userId);

	const customerSites = await tx
		.select({ id: site.id, address: site.address })
		.from(site)
		.where(eq(site.customerId, customerId));

	const siteIds = customerSites.map((row) => row.id);

	const contractScope = siteIds.length
		? or(eq(siteContracts.customerId, customerId), inArray(siteContracts.siteId, siteIds))
		: eq(siteContracts.customerId, customerId);

	await tx
		.update(siteContracts)
		.set(stamp)
		.where(and(contractScope, notDeleted(siteContracts)));

	await tx
		.update(site)
		.set(stamp)
		.where(and(eq(site.customerId, customerId), notDeleted(site)));

	const [customerRow] = await tx
		.select({ address: customers.address })
		.from(customers)
		.where(eq(customers.id, customerId))
		.limit(1);

	await tx
		.update(customers)
		.set(stamp)
		.where(and(eq(customers.id, customerId), notDeleted(customers)));

	await softDeleteAddresses(
		tx,
		[customerRow?.address ?? null, ...customerSites.map((row) => row.address)],
		userId
	);
}

/**
 * Every table on the employee detail page that is a list of rows owned by one
 * employee. Deleting the employee deletes all of them, and each is individually
 * deletable through `softDeleteStaffRecord`.
 *
 * `staffId` is what scopes a row to its owner, so the delete action can check
 * the row really belongs to the employee in the URL before stamping it.
 */
export const staffOwnedTables = {
	family: staffFamilies,
	qualification,
	experience: workExperience,
	guarantor: employeeGuarantor,
	schedule: staffSchedule,
	contact: staffContacts,
	account: staffAccounts,
	commission: officeWorkerCommission
} satisfies Record<string, StaffOwned>;

export type StaffOwnedKind = keyof typeof staffOwnedTables;

/**
 * Deletes one row from a list on the employee page — a bank account, a family
 * member, a qualification, and so on.
 *
 * The `staffId` match is not redundant with the primary key: the row id arrives
 * from the client, so without it a super admin on one employee's page could be
 * made to delete a row belonging to someone else. Returns whether a row was
 * actually stamped, so the caller can report a miss instead of a false success.
 */
export async function softDeleteStaffRecord(
	tx: Tx,
	kind: StaffOwnedKind,
	recordId: number,
	staffId: number,
	userId?: string
): Promise<boolean> {
	const table = staffOwnedTables[kind];

	const [existing] = await tx
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, recordId), eq(table.staffId, staffId), notDeleted(table)))
		.limit(1);

	if (!existing) return false;

	await tx.update(table).set(deletionStamp(userId)).where(eq(table.id, recordId));
	return true;
}

/**
 * Deletes an employee and every list that hangs off their detail page.
 *
 * Salary, payroll, attendance and leave records are deliberately left behind —
 * they are financial and statutory history, the same call made for a contract's
 * payments. Those listings join the employee row, which is now filtered, so a
 * deleted employee stops appearing on them.
 */
export async function softDeleteEmployee(tx: Tx, staffId: number, userId?: string) {
	const stamp = deletionStamp(userId);

	// Collected before the guarantor row is stamped, or the address would be lost.
	const guarantorAddresses = await tx
		.select({ address: employeeGuarantor.address })
		.from(employeeGuarantor)
		.where(eq(employeeGuarantor.staffId, staffId))
		.then((rows) => rows.map((row) => row.address));

	for (const table of Object.values(staffOwnedTables)) {
		await tx
			.update(table)
			.set(stamp)
			.where(and(eq(table.staffId, staffId), notDeleted(table)));
	}

	const [staffRow] = await tx
		.select({ address: employee.address })
		.from(employee)
		.where(eq(employee.id, staffId))
		.limit(1);

	await tx
		.update(employee)
		.set(stamp)
		.where(and(eq(employee.id, staffId), notDeleted(employee)));

	await softDeleteAddresses(tx, [staffRow?.address ?? null, ...guarantorAddresses], userId);
}

/**
 * Deletes a supply along with its adjustment ledger and damage reports.
 *
 * `supplies.quantity` is not touched: the supply itself is going away, so the
 * running total goes with it.
 */
export async function softDeleteSupply(tx: Tx, supplyId: number, userId?: string) {
	const stamp = deletionStamp(userId);

	await tx
		.update(suppliesAdjustments)
		.set(stamp)
		.where(and(eq(suppliesAdjustments.suppliesId, supplyId), notDeleted(suppliesAdjustments)));

	await tx
		.update(damagedSupplies)
		.set(stamp)
		.where(and(eq(damagedSupplies.supplyId, supplyId), notDeleted(damagedSupplies)));

	await tx
		.update(supplies)
		.set(stamp)
		.where(and(eq(supplies.id, supplyId), notDeleted(supplies)));
}

/**
 * Deletes a lease along with its item lines, movements and audit log.
 *
 * Refuses once anything has physically moved. A lease that reached `issued` has
 * goods sitting at a customer's site, and its issue rows are the only record of
 * why `supplies.quantity` went down; deleting it would either strand that stock
 * adjustment with nothing to explain it, or — if the quantity were added back —
 * claim units are in the store when they are at a site. Cancel it instead, and
 * book the goods back in through a return.
 *
 * Returns `false` when the lease is missing or has movements, so the caller can
 * say why rather than reporting a silent success.
 */
export async function softDeleteLease(
	tx: Tx,
	leaseId: number,
	userId?: string
): Promise<{ ok: boolean; reason?: string }> {
	const [lease] = await tx
		.select({ id: supplyLeases.id, status: supplyLeases.status })
		.from(supplyLeases)
		.where(and(eq(supplyLeases.id, leaseId), notDeleted(supplyLeases)))
		.limit(1);

	if (!lease) return { ok: false, reason: 'That lease no longer exists.' };

	const [{ moved }] = await tx
		.select({ moved: count() })
		.from(supplyLeaseMovements)
		.innerJoin(supplyLeaseItems, eq(supplyLeaseItems.id, supplyLeaseMovements.leaseItemId))
		.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseMovements)));

	if (moved > 0) {
		return {
			ok: false,
			reason:
				'This lease has already moved stock. Return what is outstanding and close it instead of deleting it.'
		};
	}

	const stamp = deletionStamp(userId);

	await tx
		.update(supplyLeaseEvents)
		.set(stamp)
		.where(and(eq(supplyLeaseEvents.leaseId, leaseId), notDeleted(supplyLeaseEvents)));

	await tx
		.update(supplyLeaseItems)
		.set(stamp)
		.where(and(eq(supplyLeaseItems.leaseId, leaseId), notDeleted(supplyLeaseItems)));

	await tx
		.update(supplyLeases)
		.set(stamp)
		.where(and(eq(supplyLeases.id, leaseId), notDeleted(supplyLeases)));

	return { ok: true };
}

/**
 * Deletes one row from the adjustment ledger and reverses its effect on stock.
 *
 * `supplies.quantity` is a running total kept by `+=` on every adjustment, not
 * a figure derived from the ledger. Removing a row from the visible history
 * without subtracting its `adjustment` back out would leave the stock count
 * disagreeing with the history that is supposed to explain it.
 */
export async function softDeleteSupplyAdjustment(
	tx: Tx,
	adjustmentId: number,
	supplyId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({ id: suppliesAdjustments.id, adjustment: suppliesAdjustments.adjustment })
		.from(suppliesAdjustments)
		.where(
			and(
				eq(suppliesAdjustments.id, adjustmentId),
				eq(suppliesAdjustments.suppliesId, supplyId),
				notDeleted(suppliesAdjustments)
			)
		)
		.limit(1);

	if (!row) return false;

	await tx
		.update(suppliesAdjustments)
		.set(deletionStamp(userId))
		.where(eq(suppliesAdjustments.id, adjustmentId));

	await tx
		.update(supplies)
		.set({ quantity: sql`${supplies.quantity} - ${row.adjustment}`, updatedBy: userId })
		.where(eq(supplies.id, supplyId));

	return true;
}

/**
 * Deletes a damage report and puts the damaged units back on the shelf.
 *
 * Reporting damage subtracts from `supplies.quantity`, so undoing the report
 * has to add it back for the same reason adjustments do. Any staff deduction
 * that the report generated is left alone — that is payroll history, and it is
 * not reachable from here.
 */
export async function softDeleteDamagedSupply(
	tx: Tx,
	damagedId: number,
	supplyId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({ id: damagedSupplies.id, quantity: damagedSupplies.quantity })
		.from(damagedSupplies)
		.where(
			and(
				eq(damagedSupplies.id, damagedId),
				eq(damagedSupplies.supplyId, supplyId),
				notDeleted(damagedSupplies)
			)
		)
		.limit(1);

	if (!row) return false;

	await tx
		.update(damagedSupplies)
		.set(deletionStamp(userId))
		.where(eq(damagedSupplies.id, damagedId));

	// Any ledger row generated from this report goes with it.
	await tx
		.update(suppliesAdjustments)
		.set(deletionStamp(userId))
		.where(
			and(eq(suppliesAdjustments.damagedSuppliesId, damagedId), notDeleted(suppliesAdjustments))
		);

	await tx
		.update(supplies)
		.set({ quantity: sql`${supplies.quantity} + ${row.quantity}`, updatedBy: userId })
		.where(eq(supplies.id, supplyId));

	return true;
}

/** Deletes one payment request. Nothing hangs off it. */
export async function softDeletePaymentRequest(
	tx: Tx,
	requestId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({ id: paymentRequest.id })
		.from(paymentRequest)
		.where(and(eq(paymentRequest.id, requestId), notDeleted(paymentRequest)))
		.limit(1);

	if (!row) return false;

	await tx
		.update(paymentRequest)
		.set(deletionStamp(userId))
		.where(eq(paymentRequest.id, requestId));
	return true;
}

/**
 * Deletes a recorded payment and the transaction behind it.
 *
 * The transaction row exists only to carry this payment's money — the schema
 * cascades `site_monthly_payments` from it on a hard delete — so leaving it
 * behind would keep the amount visible on `/dashboard/salary/transactions`
 * after the payment itself is gone.
 */
export async function softDeletePayment(
	tx: Tx,
	paymentId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({ id: siteMonthlyPayments.id, transactionId: siteMonthlyPayments.transactionId })
		.from(siteMonthlyPayments)
		.where(and(eq(siteMonthlyPayments.id, paymentId), notDeleted(siteMonthlyPayments)))
		.limit(1);

	if (!row) return false;

	const stamp = deletionStamp(userId);

	await tx.update(siteMonthlyPayments).set(stamp).where(eq(siteMonthlyPayments.id, paymentId));

	if (row.transactionId) {
		// An approved payment already added its money to a bank account; deleting
		// it has to take that back out, or the balance keeps money for a payment
		// that no longer exists. A pending payment posted nothing, and the
		// reversal is a no-op for it.
		await reverseBankPostings(tx, row.transactionId, 'Reversal: payment deleted', userId);

		await tx
			.update(transactions)
			.set(stamp)
			.where(and(eq(transactions.id, row.transactionId), notDeleted(transactions)));
	}

	return true;
}

/** A soft-deletable table with a numeric primary key and nothing hanging off it. */
type SimpleDeletable = MySqlTable & SoftDeletable & { id: AnyMySqlColumn };

/**
 * Deletes one row from a lookup table — a department, a city, a leave type, a
 * supplier, and so on.
 *
 * These tables are referenced by `restrict`/`set null` foreign keys all over the
 * schema, which is exactly why they get a soft delete: a hard delete would
 * either be refused or would quietly blank out a column on historical records.
 * Marking the row instead keeps every existing reference readable while taking
 * the option off every dropdown.
 *
 * Returns whether a row was actually stamped, so the caller can report a miss
 * rather than a false success.
 */
export async function softDeleteLookup(
	tx: Tx,
	table: SimpleDeletable,
	rowId: number,
	userId?: string
): Promise<boolean> {
	const [existing] = await tx
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, rowId), notDeleted(table)))
		.limit(1);

	if (!existing) return false;

	await tx.update(table).set(deletionStamp(userId)).where(eq(table.id, rowId));
	return true;
}

/**
 * Deletes a user account.
 *
 * Their sessions are dropped so the deletion takes effect immediately rather
 * than whenever the cookie happens to expire; `validateSessionToken` also
 * refuses a deleted user, so a race that re-reads a session mid-request still
 * lands on a logged-out state. Their special permission grants go too — those
 * are access, not history.
 *
 * `createdBy`/`updatedBy` stamps left across the database keep pointing at the
 * row, which is the point of a soft delete: old records stay attributable.
 */
export async function softDeleteUser(tx: Tx, userId: string, actorId?: string) {
	const stamp = deletionStamp(actorId);

	await tx.delete(session).where(eq(session.userId, userId));

	await tx
		.update(specialPermissions)
		.set(stamp)
		.where(and(eq(specialPermissions.userId, userId), notDeleted(specialPermissions)));

	await tx
		.update(user)
		.set(stamp)
		.where(and(eq(user.id, userId), isNull(user.deletedAt)));
}

/**
 * Deletes a role and the permission grants attached to it.
 *
 * Accounts still pointing at the role are left alone — `user.roleId` is
 * `onDelete: 'restrict'` and not nullable, so there is nothing safe to set it
 * to. `usersOnRole` below is what the action uses to refuse the delete while
 * anyone is still assigned.
 */
export async function softDeleteRole(tx: Tx, roleId: number, actorId?: string) {
	const stamp = deletionStamp(actorId);

	await tx
		.update(rolePermissions)
		.set(stamp)
		.where(and(eq(rolePermissions.roleId, roleId), notDeleted(rolePermissions)));

	await tx
		.update(roles)
		.set(stamp)
		.where(and(eq(roles.id, roleId), isNull(roles.deletedAt)));
}

/** How many live users still hold this role. A role in use must not be deleted. */
export async function usersOnRole(roleId: number): Promise<number> {
	const [row] = await db.select({ total: count() }).from(user).where(eq(user.roleId, roleId));

	return Number(row?.total ?? 0);
}

/**
 * Deletes a recorded expense and the transaction behind it.
 *
 * Same reasoning as `softDeletePayment`: the transaction row carries this
 * expense's money and nothing else, so leaving it would keep the amount on
 * `/dashboard/salary/transactions` after the expense itself is gone.
 */
export async function softDeleteExpense(
	tx: Tx,
	expenseId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({ id: expenses.id, transactionId: expenses.transactionId })
		.from(expenses)
		.where(and(eq(expenses.id, expenseId), notDeleted(expenses)))
		.limit(1);

	if (!row) return false;

	const stamp = deletionStamp(userId);

	await tx.update(expenses).set(stamp).where(eq(expenses.id, expenseId));

	if (row.transactionId) {
		// The expense took money out of a bank account, so deleting it puts the
		// money back.
		await reverseBankPostings(tx, row.transactionId, 'Reversal: expense deleted', userId);

		await tx
			.update(transactions)
			.set(stamp)
			.where(and(eq(transactions.id, row.transactionId), notDeleted(transactions)));
	}

	return true;
}

/**
 * Tables that hang off exactly one parent row and are deletable from that
 * parent's detail page, keyed by the column that scopes them.
 *
 * Same reasoning as `softDeleteStaffRecord`: the row id comes from the client,
 * so the owner column has to be matched too or one customer's page could be
 * made to delete another's contact.
 */
export async function softDeleteOwnedRecord(
	tx: Tx,
	table: SoftDeletable & { id: AnyMySqlColumn },
	ownerColumn: AnyMySqlColumn,
	recordId: number,
	ownerId: number,
	userId?: string
): Promise<boolean> {
	const target = table as SimpleDeletable;

	const [existing] = await tx
		.select({ id: target.id })
		.from(target)
		.where(and(eq(target.id, recordId), eq(ownerColumn, ownerId), notDeleted(target)))
		.limit(1);

	if (!existing) return false;

	await tx.update(target).set(deletionStamp(userId)).where(eq(target.id, recordId));
	return true;
}

/**
 * Deletes a supplier and the address row that belongs to it.
 *
 * Past stock adjustments keep pointing at the supplier — that is history, and
 * the reads now filter the supplier out of every picker.
 */
export async function softDeleteSupplier(
	tx: Tx,
	supplierId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({ id: supplySuppliers.id, address: supplySuppliers.address })
		.from(supplySuppliers)
		.where(and(eq(supplySuppliers.id, supplierId), notDeleted(supplySuppliers)))
		.limit(1);

	if (!row) return false;

	await tx
		.update(supplySuppliers)
		.set(deletionStamp(userId))
		.where(eq(supplySuppliers.id, supplierId));

	await softDeleteAddresses(tx, [row.address], userId);
	return true;
}
