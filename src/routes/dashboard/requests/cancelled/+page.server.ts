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
 * Rejected requests, most recently rejected first — the mirror of the approved
 * page. Same server-side query bar; month is a filter here too, never a route.
 */
export const load: PageServerLoad = async ({ url }) => {
	const query = parseTableQuery(url, ['month', 'year', 'customerId', 'requestedBy'], 10);

	const whereClause = buildWhere(query, {
		base: [eq(paymentRequest.status, 'rejected'), notDeleted(paymentRequest)],
		search: (term) =>
			or(
				like(site.name, `%${term}%`),
				like(customers.name, `%${term}%`),
				like(paymentRequest.invoiceNumber, `%${term}%`)
			),
		dateColumn: paymentRequest.rejectedAt,
		filters: {
			month: (v) => eq(paymentRequest.month, v as (typeof paymentRequest.month.enumValues)[number]),
			year: (v) => eq(paymentRequest.year, Number(v)),
			customerId: (v) => eq(customers.id, Number(v)),
			requestedBy: (v) => eq(paymentRequest.requestedBy, Number(v))
		}
	});

	// A page is a page of invoices, not of rows — see `../receipts.ts`. A special
	// request's months share one invoice number and are one rejected document.
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
		.orderBy(desc(sql`MAX(${paymentRequest.rejectedAt})`), desc(sql`MAX(${paymentRequest.id})`))
		.limit(query.limit)
		.offset(query.offset);

	const order = new Map(
		documents.map((doc, index) => [`${doc.siteId}::${doc.invoiceNumber}`, index])
	);
	const invoiceNumbers = [...new Set(documents.map((doc) => doc.invoiceNumber))];

	// Every row of those invoices; the filters are not reapplied, so a month filter
	// narrows which invoices appear without cutting months out of the ones that do.
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
						eq(paymentRequest.status, 'rejected'),
						notDeleted(paymentRequest),
						inArray(paymentRequest.invoiceNumber, invoiceNumbers)
					)
				)
		: [];

	const receipts = groupReceipts(rows)
		.filter((receipt) => order.has(receipt.key))
		.sort((a, b) => order.get(a.key)! - order.get(b.key)!);

	// Only the contracts belonging to the sites on this page.
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
		.where(and(eq(paymentRequest.status, 'rejected'), notDeleted(paymentRequest)))
		.orderBy(desc(paymentRequest.year));

	const customerOptions = await db
		.selectDistinct({ id: customers.id, name: customers.name })
		.from(paymentRequest)
		.innerJoin(site, and(eq(site.id, paymentRequest.siteId), notDeleted(site)))
		.innerJoin(customers, and(eq(customers.id, site.customerId), notDeleted(customers)))
		.where(and(eq(paymentRequest.status, 'rejected'), notDeleted(paymentRequest)))
		.orderBy(customers.name);

	// One empty form shared by every row's reopen control. It was previously seeded
	// with `contracts`/`invoiceNumbers`, neither of which exists on this page's schema.
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
			const { ids, status, requestDate, requestedBy, month } = form.data;
			const requestIds = parseIdsField(ids);

			if (!requestIds.length) {
				setError(form, 'ids', 'No request was selected.');
				return message(form, { type: 'error', text: 'No request was selected.' });
			}

			// The period is only editable on a single-month invoice. A special request
			// covers several months under one invoice number, and writing one month
			// across all of its rows would collapse them onto the same period — which
			// `unique_payment_per_month` then rejects, after the first row has already
			// lost its month. The form leaves the field out in that case.
			const period = month
				? (() => {
						// Typed at the split so `monthName` lines up with the column's enum.
						const [monthName, year] = month.split('_') as [
							(typeof paymentRequest.month.enumValues)[number],
							string
						];
						return { month: monthName, year: Number(year) };
					})()
				: {};

			await db.transaction(async (tx) => {
				await tx
					.update(paymentRequest)
					.set({
						status,
						requestedBy,
						...period,
						requestDate: new Date(requestDate),
						// Reopening to pending undoes the rejection, so the decision dates go with
						// it — otherwise the row still reads as decided on the approved/rejected
						// sorts while sitting in the pending queue.
						approvedAt: null,
						rejectedAt: null
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
