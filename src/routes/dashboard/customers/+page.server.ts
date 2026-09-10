import { zod4 } from 'sveltekit-superforms/adapters';
import { editCustomer } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import { customers, user } from '$lib/server/db/schema';
import { isApproved } from '$lib/server/approvals';
import { eq, and, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { type Actions } from '@sveltejs/kit';
import { fail, message } from 'sveltekit-superforms';
import { setFlash } from 'sveltekit-flash-message/server';

export const load: PageServerLoad = async () => {
	try {
		const form = await superValidate(zod4(editCustomer));

		const customerList = await db
			.select({
				id: customers.id,
				name: customers.name,
				phone: customers.phone,
				email: customers.email,
				tinNo: customers.tinNo,
				joinedOn: sql<string>`DATE_FORMAT(${customers.createdAt}, '%Y-%m-%d')`,
				daysSinceJoined: sql<number>`DATEDIFF(CURRENT_DATE, ${customers.createdAt})`,
				addedBy: user.name,
				addedById: user.id
			})
			.from(customers)
			.leftJoin(user, eq(customers.createdBy, user.id))
			// Only approved customers belong in the main list.
			.where(and(eq(customers.isActive, true), notDeleted(customers), isApproved(customers)));

		return {
			customerList,
			form
		};
	} catch (error) {
		console.error('Error loading customer dashboard:', error);
		return {
			customer: null,
			form: null,
			allMethods: [],
			reciepts: [],
			error: 'Failed to load customer dashboard.'
		};
	}
};
