import { setError, superValidate, message, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq, isNull, isNotNull, like, ne, or, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import {
	parseTableQuery,
	buildWhere,
	pagination,
	currentQuery,
	paginate
} from '$lib/server/queryFilters';
import { currentMonthFilter } from '$lib/global.svelte';

import { add, edit } from './schema';
import { db } from '$lib/server/db';
import {
	supplySuppliers,
	supplies,
	subcity,
	address,
	suppliesAdjustments
} from '$lib/server/db/schema/';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { subcities } from '$lib/server/fastData';
export const load: PageServerLoad = async ({ url }) => {
	const form = await superValidate(zod4(add));
	const editForm = await superValidate(zod4(edit));

	const query = parseTableQuery(url, ['subcityId', 'status', 'contact', 'activity']);

	const whereClause = buildWhere(query, {
		base: [notDeleted(supplySuppliers)],
		search: (term) =>
			or(
				like(supplySuppliers.name, `%${term}%`),
				like(supplySuppliers.phone, `%${term}%`),
				like(supplySuppliers.email, `%${term}%`)
			),
		filters: {
			subcityId: (v) => eq(address.subcityId, Number(v)),
			status: (v) =>
				v === 'active' || v === 'inactive' ? eq(supplySuppliers.status, v === 'active') : undefined,
			// An email column that is present but blank is still "phone only".
			contact: (v) =>
				v === 'with-email'
					? and(isNotNull(supplySuppliers.email), ne(supplySuppliers.email, ''))
					: v === 'phone-only'
						? or(isNull(supplySuppliers.email), eq(supplySuppliers.email, ''))
						: undefined
			// `activity` counts deliveries, which only exist once the rows are
			// grouped — applied below rather than in the WHERE.
		}
	});

	/**
	 * The date range scopes the *trading history*, not the supplier: it sits in
	 * the join rather than the WHERE so every supplier still appears, with their
	 * spend and delivery counts measured over the chosen window.
	 */
	const deliveredInRange =
		query.dateStart && query.dateEnd
			? currentMonthFilter(suppliesAdjustments.createdAt, query.dateStart, query.dateEnd)
			: undefined;

	const allData = await db
		.select({
			id: supplySuppliers.id,
			name: supplySuppliers.name,
			phone: supplySuppliers.phone,
			email: supplySuppliers.email,
			subcityId: address.subcityId,
			subcity: subcity.name,
			street: address.street,
			kebele: address.kebele,
			buildingNumber: address.buildingNumber,
			floor: address.floor,
			houseNumber: address.houseNumber,
			description: supplySuppliers.description,
			status: supplySuppliers.status,
			// Trading history, so the page can be filtered on more than a name:
			// how often this supplier has delivered, how many distinct items they
			// carry, what has been spent with them, and when they last delivered.
			deliveries: sql<number>`COUNT(DISTINCT ${suppliesAdjustments.id})`,
			itemsSupplied: sql<number>`COUNT(DISTINCT ${suppliesAdjustments.suppliesId})`,
			totalSpend: sql<number>`COALESCE(SUM(${suppliesAdjustments.total}), 0)`,
			lastDelivery: sql<Date | null>`MAX(${suppliesAdjustments.createdAt})`
		})
		.from(supplySuppliers)
		.leftJoin(address, and(eq(supplySuppliers.address, address.id), notDeleted(address)))
		.leftJoin(subcity, and(eq(address.subcityId, subcity.id), notDeleted(subcity)))
		.leftJoin(
			suppliesAdjustments,
			and(
				eq(suppliesAdjustments.supplierId, supplySuppliers.id),
				notDeleted(suppliesAdjustments),
				deliveredInRange
			)
		)
		.where(whereClause)
		.groupBy(
			supplySuppliers.id,
			supplySuppliers.name,
			supplySuppliers.phone,
			supplySuppliers.email,
			address.subcityId,
			subcity.name,
			address.street,
			address.kebele,
			address.buildingNumber,
			address.floor,
			address.houseNumber,
			supplySuppliers.description,
			supplySuppliers.status
		)
		// Pagination needs a stable order or page 2 is undefined.
		.orderBy(asc(supplySuppliers.name), asc(supplySuppliers.id));

	const subcitiesList = await subcities();

	const rows = allData.map((row) => ({
		...row,
		totalSpend: Number(row.totalSpend ?? 0),
		deliveries: Number(row.deliveries ?? 0),
		itemsSupplied: Number(row.itemsSupplied ?? 0)
	}));

	// Deliveries are an aggregate, so this one narrows after the grouping.
	const activity = query.filters.activity;
	const narrowed = rows.filter(
		(row) => !activity || (activity === 'has-supplied' ? row.deliveries > 0 : row.deliveries === 0)
	);

	const { rows: paged, total } = paginate(narrowed, query);

	return {
		form,
		editForm,
		allData: paged,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query),
		// Doubles as the Subcity filter's option list and the add/edit form's.
		subcitiesList
	};
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await superValidate(request, zod4(add));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form for Errors' });
		}

		const {
			name,
			subcity,
			street,
			kebele,
			buildingNumber,
			floor,
			houseNumber,
			phone,
			description
		} = form.data;

		try {
			const [addressId] = await db
				.insert(address)
				.values({
					subcity,
					street,
					kebele,
					buildingNumber,
					floor,
					houseNumber
				})
				.$returningId();

			await db.insert(supplySuppliers).values({
				name,
				phone,
				description,
				address: addressId.id,
				status: status
			});

			return message(form, { type: 'success', text: 'Supplier   Successfully Added' });
		} catch (err: any) {
			return message(form, {
				type: 'error',
				text: 'Error: ' + err?.message
			});
		}
	},
	edit: async ({ request }) => {
		const form = await superValidate(request, zod4(edit));
		if (!form.valid) {
			return fail(400, { form });
		}

		const { id, name, phone, location, description, status } = form.data;

		try {
			await db
				.update(supplySuppliers)
				.set({ name, phone, location, description, status })
				.where(eq(supplySuppliers.id, id));
			return message(form, { type: 'success', text: 'Department Successfully Updated' });
		} catch (err: any) {
			if (err.code === 'ER_DUP_ENTRY') return;
			setError(form, 'name', 'Department name already exists.');
			return message(form, {
				type: 'error',
				text:
					err.code === 'ER_DUP_ENTRY'
						? 'Department name is already taken. Please choose another one.'
						: err.message
			});
		}
	}
};
