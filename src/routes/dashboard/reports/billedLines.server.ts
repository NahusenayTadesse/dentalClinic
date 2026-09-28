import { eq, inArray, sql, type SQL } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	employee,
	invoice,
	invoiceLine,
	procedures,
	provider,
	services
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import type { ReportFilters } from './filters';
import { all, amountScope, inRange, staffName, staffScope } from './scope.server';

/**
 * What the clinic billed for, line by line — the base of every report on services rendered.
 *
 * **Why this replaced `transaction_services`.** That table came from the facilities ERP, where a
 * job was paid for at the desk and the payment listed what it was for. Here a bill is raised from
 * charted work and paid separately, possibly in parts, so what was *rendered* is a bill's line,
 * not a payment's. The reports read `invoice_line` now, and the old tables are gone (migration
 * 0038).
 *
 * A line counts once its bill is issued — paid or not — and not while it is a draft or once it is
 * void. It is dated by the day its bill was issued. Its clinician is the procedure's, or the bill's
 * when the line is a charge with no procedure behind it; the `employee` behind that clinician is
 * joined so the report's staff filters (`staffScope`) apply unchanged.
 *
 * Non-goal: goods. A line can name a stock item (`supplyId`), but nothing sells stock through a
 * bill yet, so there is no supplies-sold figure to report.
 */

/**
 * The billed lines inside the report's filters, as a subquery a report selects and groups from.
 * Every field a report reads is here, already named; `search` narrows by service, description or
 * clinician for the detail table.
 *
 * A subquery rather than a shared query builder because Drizzle cannot type joins onto a select
 * whose shape is a generic parameter.
 */
export function billedLines(filters: ReportFilters, search?: SQL) {
	return db
		.select({
			id: invoiceLine.id,
			issuedOn: invoice.issuedOn,
			bill: invoice.invoiceNumber,
			status: invoice.status,
			service: sql<string>`COALESCE(${services.name}, ${invoiceLine.description})`.as(
				'billed_service'
			),
			quantity: invoiceLine.quantity,
			unitPrice: invoiceLine.unitPrice,
			lineTotal: invoiceLine.lineTotal,
			staffId: sql<number | null>`${employee.id}`.as('billed_staff_id'),
			clinician: sql<string | null>`${staffName}`.as('billed_clinician')
		})
		.from(invoiceLine)
		.innerJoin(invoice, eq(invoice.id, invoiceLine.invoiceId))
		.leftJoin(procedures, eq(procedures.id, invoiceLine.procedureId))
		.leftJoin(services, eq(services.id, procedures.serviceId))
		.leftJoin(
			provider,
			eq(provider.id, sql`COALESCE(${procedures.providerId}, ${invoice.providerId})`)
		)
		.leftJoin(employee, eq(employee.id, provider.employeeId))
		.where(
			all([
				inArray(invoice.status, ['issued', 'partly', 'paid']),
				notDeleted(invoice),
				notDeleted(invoiceLine),
				inRange(invoice.issuedOn, filters),
				filters.serviceId ? eq(procedures.serviceId, filters.serviceId) : undefined,
				...amountScope(invoiceLine.lineTotal, filters),
				...staffScope(filters),
				search
			])
		)
		.as('billed');
}
