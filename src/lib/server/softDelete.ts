import { and, count, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { returnToBatch } from './stock';
import {
	address,
	appointmentTypeServices,
	orthoInstalment,
	smsProvider,
	customers,
	damagedSupplies,
	employee,
	employeeGuarantor,
	expenses,
	qualification,
	rolePermissions,
	roles,
	session,
	specialPermissions,
	staffAccounts,
	staffContacts,
	staffFamilies,
	staffSchedule,
	supplies,
	supplyBatch,
	suppliesAdjustments,
	supplySuppliers,
	transactions,
	treatmentPlan,
	treatmentPlanItem,
	invoice,
	invoiceLine,
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
 * .where(and(eq(branch.isActive, true), notDeleted(branch)))
 * ```
 *
 * In a join, put it in the `on` clause rather than the `where` — a left join
 * whose filter lives in the `where` silently behaves like an inner join and
 * drops the parent row too:
 *
 * ```ts
 * .leftJoin(branch, and(eq(employee.branchId, branch.id), notDeleted(branch)))
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
 * Deletes a customer and its address.
 *
 * Used to cascade `site_contracts` and the customer's sites; both went with the prune — a
 * customer is now just a corporate billing party, so there is nothing left to walk.
 */
export async function softDeleteCustomer(tx: Tx, customerId: number, userId?: string) {
	const stamp = deletionStamp(userId);

	const [customerRow] = await tx
		.select({ address: customers.address })
		.from(customers)
		.where(eq(customers.id, customerId))
		.limit(1);

	await tx
		.update(customers)
		.set(stamp)
		.where(and(eq(customers.id, customerId), notDeleted(customers)));

	await softDeleteAddresses(tx, [customerRow?.address ?? null], userId);
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
	account: staffAccounts
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
 * Stock is not touched: the supply itself is going away, so the
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
 * Deletes one row from the adjustment ledger and reverses its effect on stock.
 *
 * Stock on hand is the sum of the item's open lots, so reversing a movement means putting the
 * units back where they came from rather than correcting a total.
 *
 * A row that never touched a lot — `batchId` null, which is every adjustment made before lots
 * existed — never affected the quantity either, so removing it correctly does nothing. That
 * falls out of deriving rather than caching: there is no second number left behind to fix.
 */
export async function softDeleteSupplyAdjustment(
	tx: Tx,
	adjustmentId: number,
	supplyId: number,
	userId?: string
): Promise<boolean> {
	const [row] = await tx
		.select({
			id: suppliesAdjustments.id,
			adjustment: suppliesAdjustments.adjustment,
			batchId: suppliesAdjustments.batchId
		})
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

	// Only a movement that came out of a lot can be put back into one.
	if (row.batchId && row.adjustment < 0) {
		await returnToBatch(tx, row.batchId, Math.abs(row.adjustment), userId);
	} else if (row.batchId && row.adjustment > 0) {
		// A receipt being reversed: take the units back out of the lot it created.
		await tx
			.update(supplyBatch)
			.set({
				quantity: sql`GREATEST(${supplyBatch.quantity} - ${row.adjustment}, 0)`,
				updatedBy: userId
			})
			.where(eq(supplyBatch.id, row.batchId));
	}

	return true;
}

/**
 * Deletes a damage report and puts the damaged units back on the shelf.
 *
 * Reporting damage takes units out of a lot, so undoing the report puts them back into the same
 * lot — found through the ledger row the report generated, which is the only thing that knows
 * which lot it was. Any staff deduction the report created is left alone: that is payroll
 * history and is not reachable from here.
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

	// The ledger row generated from this report goes with it — and is what says which lot the
	// units came out of, so it is read before it is stamped.
	const generated = await tx
		.select({
			id: suppliesAdjustments.id,
			batchId: suppliesAdjustments.batchId,
			adjustment: suppliesAdjustments.adjustment
		})
		.from(suppliesAdjustments)
		.where(
			and(eq(suppliesAdjustments.damagedSuppliesId, damagedId), notDeleted(suppliesAdjustments))
		);

	await tx
		.update(suppliesAdjustments)
		.set(deletionStamp(userId))
		.where(
			and(eq(suppliesAdjustments.damagedSuppliesId, damagedId), notDeleted(suppliesAdjustments))
		);

	// Each lot gets back what came out of it. This returned the report's whole quantity to every
	// lot, so damage that spanned two lots came back doubled when undone.
	for (const led of generated) {
		if (led.batchId) await returnToBatch(tx, led.batchId, Math.abs(led.adjustment), userId);
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
		// Used to reverse the bank posting too; bank balances were a feature of the ERP this was repurposed from and went
		// with those tables. The transaction itself is still soft-deleted alongside the expense.
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

/**
 * Deletes a draft treatment plan and its lines.
 *
 * Drafts only, which the caller checks: a plan that was presented is the record of what a patient
 * was told, and is kept whatever became of it. The lines go with the plan because they exist only
 * as its lines — nothing lists them on their own.
 */
export async function softDeleteTreatmentPlan(tx: Tx, planId: number, userId?: string) {
	const stamp = deletionStamp(userId);
	await tx
		.update(treatmentPlanItem)
		.set(stamp)
		.where(and(eq(treatmentPlanItem.treatmentPlanId, planId), notDeleted(treatmentPlanItem)));
	await tx
		.update(treatmentPlan)
		.set(stamp)
		.where(and(eq(treatmentPlan.id, planId), notDeleted(treatmentPlan)));
}

/**
 * Takes one line off a draft treatment plan. Drafts are workspace — a line removed before the
 * plan was presented was never shown to anybody — so the caller checks the plan is a draft.
 */
export async function softDeleteTreatmentPlanItem(tx: Tx, itemId: number, userId?: string) {
	await tx
		.update(treatmentPlanItem)
		.set(deletionStamp(userId))
		.where(and(eq(treatmentPlanItem.id, itemId), notDeleted(treatmentPlanItem)));
}

/**
 * Takes one line off a draft bill. The caller checks the bill is a draft: an issued bill is a
 * document the patient holds, and is voided through a manager rather than edited.
 */
export async function softDeleteInvoiceLine(tx: Tx, lineId: number, userId?: string) {
	await tx
		.update(invoiceLine)
		.set(deletionStamp(userId))
		.where(and(eq(invoiceLine.id, lineId), notDeleted(invoiceLine)));
}

/**
 * Throws away a draft bill and its lines, which puts its work back among what is unbilled. Drafts
 * only, which the caller checks — an issued bill is never deleted.
 */
export async function softDeleteDraftInvoice(tx: Tx, invoiceId: number, userId?: string) {
	const stamp = deletionStamp(userId);
	await tx
		.update(invoiceLine)
		.set(stamp)
		.where(and(eq(invoiceLine.invoiceId, invoiceId), notDeleted(invoiceLine)));
	await tx
		.update(invoice)
		.set(stamp)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.status, 'draft'), notDeleted(invoice)));
}

/**
 * Takes services off what a visit type brings with it (Admin Panel → Appointment Types → Usual
 * work). Past visits are untouched: what was recorded at them is a procedure of its own, not a
 * read through this link.
 */
export async function softDeleteVisitTypeServices(tx: Tx, linkIds: number[], userId?: string) {
	if (linkIds.length === 0) return;
	await tx
		.update(appointmentTypeServices)
		.set(deletionStamp(userId))
		.where(and(inArray(appointmentTypeServices.id, linkIds), notDeleted(appointmentTypeServices)));
}

/**
 * Cancels orthodontic instalments not yet billed, when a case is discontinued. A billed one is never
 * cancelled here: its bill is what is owed, and only a void through a manager takes that away.
 */
export async function softDeleteOrthoInstalments(tx: Tx, ids: number[], userId?: string) {
	if (ids.length === 0) return;
	await tx
		.update(orthoInstalment)
		.set(deletionStamp(userId))
		.where(
			and(
				inArray(orthoInstalment.id, ids),
				isNull(orthoInstalment.invoiceId),
				notDeleted(orthoInstalment)
			)
		);
}

/**
 * Removes an SMS gateway account. Its messages keep their log rows, which name the gateway as text.
 * Unmarked as the default in the same write, so a deleted account can never be the one sent through.
 */
export async function softDeleteSmsProvider(tx: Tx, providerId: number, userId?: string) {
	await tx
		.update(smsProvider)
		.set({ ...deletionStamp(userId), isDefault: false })
		.where(and(eq(smsProvider.id, providerId), notDeleted(smsProvider)));
}
