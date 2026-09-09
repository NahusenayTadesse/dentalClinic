import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { overtimeSchema as schema } from './schema';

import { db } from '$lib/server/db';
import { overTime, salaries, overTimeType } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import { fail } from 'sveltekit-superforms';
import { setFlash } from 'sveltekit-flash-message/server';
import { overtimeTypes } from '$lib/server/fastData';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));

	return {
		form,
		overtimeTypes: await overtimeTypes()
	};
};

export const actions: Actions = {
	addOvertime: async ({ request, cookies, params, locals }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(schema));
		if (!form.valid) {
			// Stay on the same page and set a flash message

			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const { reason, date, overtimeType, hours } = form.data;

		try {
			await db.transaction(async (tx) => {
				const rate = await tx
					.select({
						rate: overTimeType.rate
					})
					.from(overTimeType)
					.where(eq(overTimeType.id, overtimeType))
					.then((rows) => rows[0]);
				const basicSalary = await tx
					.select({
						salary: salaries.amount
					})
					.from(salaries)
					.where(eq(salaries.staffId, Number(id)))
					.then((rows) => rows[0]);

				const total = (Number(basicSalary.salary) / 192) * (hours * Number(rate.rate));
				await tx.insert(overTime).values({
					staffId: Number(id),
					overTimeTypeId: overtimeType,
					hours,
					total,
					reason,
					date,
					createdBy: locals.user?.id
				});
			});

			return message(form, { type: 'success', text: 'Overtime Successuflly Added' });
		} catch (err) {
			return message(
				form,
				{
					type: 'error',
					text: 'An Error occured while adding Overtime' + err?.message
				},
				{ status: 500 }
			);
		}
	}
};
