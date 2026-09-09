import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import {
	transactions,
	siteMonthlyPayments,
	user,
	services,
	site,
	customers,
	siteContracts,
	employee,
	vatAndWithHold,
	employmentStatuses,
	paymentMethods,
	employeeTermination,
	penality,
	paymentRequest
} from '$lib/server/db/schema';
import { eq, and, or, like, sql, desc, inArray, getTableColumns } from 'drizzle-orm';
import { notDeleted, softDeletePaymentRequest } from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { setFlash } from 'sveltekit-flash-message/server';
import type { PageServerLoad, Actions } from '../$types';

import { setError, superValidate } from 'sveltekit-superforms';
import { error } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { officeEmployees } from '$lib/server/fastData';
import { parseTableQuery, buildWhere, pagination, currentQuery } from '$lib/server/queryFilters';
import { groupReceipts, parseIdsField } from '../receipts';
import { add } from './schema';

/**
 * The pending queue: requests awaiting a decision, newest request first.
 *
 * Filtering moved off the client `FilterMenu` (which could only narrow the rows
 * already loaded) onto the shared server-side query bar, so the page now loads
 * one page of invoices instead of every pending request in the company.
 */
export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['month', 'year', 'customerId', 'requestedBy'], 10);

	const whereClause = buildWhere(query, {
		base: [eq(paymentRequest.status, 'pending'), notDeleted(paymentRequest)],
		search: (term) =>
			or(
				like(site.name, `%${term}%`),
				like(customers.name, `%${term}%`),
				like(paymentRequest.invoiceNumber, `%${term}%`)
			),
		dateColumn: paymentRequest.requestDate,
		filters: {
			month: (v) => eq(paymentRequest.month, v as (typeof paymentRequest.month.enumValues)[number]),
			year: (v) => eq(paymentRequest.year, Number(v)),
			customerId: (v) => eq(customers.id, Number(v)),
			requestedBy: (v) => eq(paymentRequest.requestedBy, Number(v))
		}
	});

	// One page is one page of *invoices*, not of rows: a special request stores a
	// row per month under a single invoice number, and those rows are one document.
	// Counting and paging on rows would have split such a document across a page
	// boundary and reported ten invoices as thirty pending requests.
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
		.orderBy(desc(sql`MAX(${paymentRequest.requestDate})`), desc(sql`MAX(${paymentRequest.id})`))
		.limit(query.limit)
		.offset(query.offset);

	// The page's documents in the order the database returned them.
	const order = new Map(
		documents.map((doc, index) => [`${doc.siteId}::${doc.invoiceNumber}`, index])
	);
	const invoiceNumbers = [...new Set(documents.map((doc) => doc.invoiceNumber))];

	// Every row of those invoices, filters deliberately not reapplied: filtering by
	// one month must not print an invoice with the other months it covers missing,
	// because the total on the page would then not be the total that was requested.
	const rows = invoiceNumbers.length
		? await db
				.select({
					...getTableColumns(paymentRequest),
					siteName: site.name,
					customerName: customers.name,
					requester: sql<string>`TRIM(CONCAT(COALESCE(${employee.name}, ''), ' ', COALESCE(${employee.fatherName}, '')))`
				})
				.from(paymentRequest)
				.leftJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
				.leftJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
				.leftJoin(employee, and(eq(paymentRequest.requestedBy, employee.id), notDeleted(employee)))
				.where(
					and(
						eq(paymentRequest.status, 'pending'),
						notDeleted(paymentRequest),
						inArray(paymentRequest.invoiceNumber, invoiceNumbers)
					)
				)
		: [];

	const receipts = groupReceipts(rows)
		.filter((receipt) => order.has(receipt.key))
		.sort((a, b) => order.get(a.key)! - order.get(b.key)!);

	// Only the contracts belonging to the sites on this page — the invoice totals are
	// summed per site in the component, so the whole table was never needed.
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

	const years = await db
		.selectDistinct({ year: paymentRequest.year })
		.from(paymentRequest)
		.where(and(eq(paymentRequest.status, 'pending'), notDeleted(paymentRequest)))
		.orderBy(desc(paymentRequest.year));

	const customerOptions = await db
		.selectDistinct({ id: customers.id, name: customers.name })
		.from(paymentRequest)
		.innerJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
		.innerJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.where(and(eq(paymentRequest.status, 'pending'), notDeleted(paymentRequest)))
		.orderBy(customers.name);

	// One empty form shared by every row's status control. It was previously seeded
	// with `contracts`/`invoiceNumbers`/`penalityAmounts`, none of which exist on this
	// page's schema — superforms dropped them and TypeScript flagged the call.
	const form = await superValidate(zod4(add));

	return {
		receipts,
		contracts,
		employees,
		vats,
		form,
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
	request: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(add));

		console.log(form);

		// 2. Check for validation errors (size, mime-type, required fields)
		if (!form.valid) {
			return message(form, {
				type: 'error',
				text: 'Validation failed. Please check the highlighted fields.'
			});
		}

		try {
			// 3. Destructure ALL fields from form.data
			const { ids, status, approvedBy, rejectedReason } = form.data;
			const requestIds = parseIdsField(ids);

			if (!requestIds.length) {
				setError(form, 'ids', 'No request was selected.');
				return message(form, { type: 'error', text: 'No request was selected.' });
			}

			if (status === 'approved' && approvedBy === undefined) {
				setError(form, 'approvedBy', 'Approved by is required when status is approved');
				return message(form, {
					type: 'error',
					text: 'Approved by is required when status is approved.'
				});
			}

			if (status === 'rejected' && rejectedReason === undefined) {
				setError(form, 'rejectedReason', 'Rejected reason is required when status is rejected');
				return message(form, {
					type: 'error',
					text: 'Rejected reason is required when status is rejected.'
				});
			}

			const decidedAt = new Date();

			await db.transaction(async (tx) => {
				await tx
					.update(paymentRequest)
					.set({
						status,
						approvedBy,
						rejectedReason,
						// Only the side being moved to keeps a timestamp. Clearing the other one
						// matters because a request can be flipped approved -> rejected, and a row
						// carrying both dates would sort into the approved list forever.
						approvedAt: status === 'approved' ? decidedAt : null,
						rejectedAt: status === 'rejected' ? decidedAt : null
					})
					.where(inArray(paymentRequest.id, requestIds));
			});

			return message(form, {
				type: 'success',
				text: `Request Changed successfully!`
			});
		} catch (err) {
			console.error('Server Action Error:', err);

			// Handle potential database errors (unique constraint, etc.)
			return message(
				form,
				{
					type: 'error',
					text: 'A database error occurred. Please try again.'
				},
				{
					status: 500
				}
			);
		}
	},

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
