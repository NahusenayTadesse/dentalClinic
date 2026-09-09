import { db } from '$lib/server/db';
import {
	user,
	services,
	site,
	customers,
	siteContracts,
	employee,
	vatAndWithHold,
	paymentRequest
} from '$lib/server/db/schema';
import { eq, and, or, like, sql, desc, inArray, getTableColumns } from 'drizzle-orm';
import { notDeleted, softDeletePaymentRequest } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash } from 'sveltekit-flash-message/server';
import { fail } from 'sveltekit-superforms';
import { officeEmployees } from '$lib/server/fastData';
import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import { groupReceipts, parseIdsField } from '../receipts';
import type { PageServerLoad, Actions } from './$types';

/**
 * Approved requests, newest decision first.
 *
 * This replaces the old `/approved/[range]` route, which put one month in the URL
 * and redirected here from a helper that fed Gregorian numbers to an Ethiopian
 * month formatter — so the default landing month was wrong all year and became
 * the literal string `Invalid Month` in Hidar and Tahsas. Month is now one filter
 * among several on the query bar rather than the only way to address the page.
 */
export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(
		url,
		['month', 'year', 'customerId', 'requestedBy', 'approvedBy'],
		10
	);

	const whereClause = buildWhere(query, {
		base: [eq(paymentRequest.status, 'approved'), notDeleted(paymentRequest)],
		search: (term) =>
			or(
				like(site.name, `%${term}%`),
				like(customers.name, `%${term}%`),
				like(paymentRequest.invoiceNumber, `%${term}%`)
			),
		// The window is over when it was approved, which is what this page is sorted by.
		dateColumn: paymentRequest.approvedAt,
		filters: {
			month: (v) => eq(paymentRequest.month, v as (typeof paymentRequest.month.enumValues)[number]),
			year: (v) => eq(paymentRequest.year, Number(v)),
			customerId: (v) => eq(customers.id, Number(v)),
			requestedBy: (v) => eq(paymentRequest.requestedBy, Number(v)),
			approvedBy: (v) => eq(paymentRequest.approvedBy, Number(v))
		}
	});

	// A page is a page of invoices, not of rows — see `../receipts.ts`. This matters
	// most here, because the export buttons walk `.invoice-page` elements: a special
	// request used to hand the customer one PDF per month, each carrying the same
	// invoice number and a single month's total.
	const [{ total }] = await db
		.select({
			// Same joins as the row query, because the WHERE reaches into site and customers.
			total: sql<number>`COUNT(DISTINCT ${paymentRequest.siteId}, ${paymentRequest.invoiceNumber})`
		})
		.from(paymentRequest)
		.leftJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
		.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.where(whereClause);

	const documents = await db
		.select({ siteId: paymentRequest.siteId, invoiceNumber: paymentRequest.invoiceNumber })
		.from(paymentRequest)
		.leftJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
		.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.where(whereClause)
		.groupBy(paymentRequest.siteId, paymentRequest.invoiceNumber)
		// Rows approved before `approved_at` existed are backfilled from `updated_at` by
		// the manual migration; `id` breaks ties so the order is stable between loads.
		.orderBy(desc(sql`MAX(${paymentRequest.approvedAt})`), desc(sql`MAX(${paymentRequest.id})`))
		.limit(query.limit)
		.offset(query.offset);

	const order = new Map(
		documents.map((doc, index) => [`${doc.siteId}::${doc.invoiceNumber}`, index])
	);
	const invoiceNumbers = [...new Set(documents.map((doc) => doc.invoiceNumber))];

	// Every row of those invoices; the filters are not reapplied, so filtering by one
	// month narrows which invoices are listed without printing them a month short.
	const rows = invoiceNumbers.length
		? await db
				.select({
					...getTableColumns(paymentRequest),
					siteName: site.name,
					customerName: customers.name
				})
				.from(paymentRequest)
				.leftJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
				.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
				.where(
					and(
						eq(paymentRequest.status, 'approved'),
						notDeleted(paymentRequest),
						inArray(paymentRequest.invoiceNumber, invoiceNumbers)
					)
				)
		: [];

	const receipts = groupReceipts(rows)
		.filter((receipt) => order.has(receipt.key))
		.sort((a, b) => order.get(a.key)! - order.get(b.key)!);

	// Only the contracts belonging to the sites actually on this page. The invoice
	// totals are summed per site in the component, so loading every contract in the
	// company to render ten invoices was most of the work this page did.
	const siteIds = [...new Set(receipts.map((receipt) => receipt.siteId))];
	const contracts = siteIds.length
		? await db
				.select({
					id: siteContracts.id,
					siteId: siteContracts.siteId,
					serviceName: services.name,
					monthlyAmount: siteContracts.monthlyAmount
				})
				.from(siteContracts)
				.leftJoin(services, and(eq(siteContracts.serviceId, services.id), notDeleted(services)))
				.where(and(inArray(siteContracts.siteId, siteIds), notDeleted(siteContracts)))
		: [];

	const employees = await officeEmployees();

	const vats = await db
		.select()
		.from(vatAndWithHold)
		.limit(1)
		.then((rows) => rows[0]);

	// Years that actually have approved requests, so the dropdown never offers a
	// year that returns nothing.
	const years = await db
		.selectDistinct({ year: paymentRequest.year })
		.from(paymentRequest)
		.where(and(eq(paymentRequest.status, 'approved'), notDeleted(paymentRequest)))
		.orderBy(desc(paymentRequest.year));

	const customerOptions = await db
		.selectDistinct({ id: customers.id, name: customers.name })
		.from(paymentRequest)
		.innerJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
		.innerJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.where(and(eq(paymentRequest.status, 'approved'), notDeleted(paymentRequest)))
		.orderBy(customers.name);

	return {
		receipts,
		contracts,
		employees,
		vats,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query),
		filterOptions: {
			months: paymentRequest.month.enumValues,
			years: years.map((row) => row.year),
			customers: customerOptions,
			employees
		}
	};
};

export const actions: Actions = {
	/**
	 * Soft delete of one payment request. Super admin only — `requireSuperAdmin`
	 * throws 403 rather than failing quietly, because the hidden button is UX,
	 * not access control.
	 */
	delete: async ({ request, locals, cookies }) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		// One invoice, so all of its month rows go together.
		const requestIds = parseIdsField(data.get('id'));

		if (!requestIds.length) {
			setFlash({ type: 'error', message: 'No request was selected.' }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) => {
				let count = 0;
				for (const requestId of requestIds) {
					if (await softDeletePaymentRequest(tx, requestId, locals.user?.id)) count++;
				}
				return count;
			});

			if (!deleted) {
				setFlash({ type: 'error', message: 'That request was not found.' }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error('Error deleting payment request:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete request: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: 'Payment request deleted.' }, cookies);
		return { success: true };
	}
};
