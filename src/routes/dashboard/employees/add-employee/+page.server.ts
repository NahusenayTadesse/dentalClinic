import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';

import { add } from './schema';
import { db } from '$lib/server/db';
import { employee } from '$lib/server/db/schema/';
import { addEmployee, tidyName } from '$lib/server/employees';
import { recordAudit } from '$lib/server/audit';
import type { Actions } from './$types';
import { departments, empStatus, eduLevel, subcities, positions } from '$lib/server/fastData';
import type { PageServerLoad } from './$types.js';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));

	const departmentList = await departments();
	const positionList = await positions();
	const empStatusList = await empStatus();
	const eduLevelList = await eduLevel();
	const subcityList = await subcities();

	return {
		form,
		departmentList,
		positionList,
		empStatusList,
		eduLevelList,
		subcityList
	};
};

import { saveUploadedFile } from '$lib/server/upload';
import { redirect } from 'sveltekit-flash-message/server';

export const actions: Actions = {
	add: async (event) => {
		const { request, locals, cookies } = event;
		const form = await superValidate(request, zod4(add));

		/*
		 * A record has to be filed somewhere. "All branches" is a way of looking at data, not a
		 * place to put it, so this refuses rather than guessing — guessing would file the employee
		 * at whichever branch happened to sort first.
		 */
		const activeBranch = locals.branch.active;

		if (!activeBranch) {
			return message(form, {
				type: 'error',
				text: 'Pick a branch in the top bar before adding an employee.'
			});
		}

		if (!form.valid) {
			return fail(400, { form });
		}

		const data = form.data;

		// Someone with all three names already here, unless the person adding has said otherwise.
		if (!data.newEmployeeVerified) {
			const existingEmployee = await db
				.select({ id: employee.id })
				.from(employee)
				.where(
					and(
						eq(employee.name, tidyName(data.name)),
						eq(employee.fatherName, tidyName(data.fatherName)),
						eq(employee.grandFatherName, tidyName(data.grandFatherName)),
						notDeleted(employee)
					)
				)
				.limit(1);

			if (existingEmployee.length > 0) {
				setError(form, 'name', 'Employee with this Name already exists');
				return message(form, {
					type: 'error',
					text: 'Employee with this name already exists',
					existingId: existingEmployee[0].id
				});
			}
		}

		let id: number;
		try {
			const files = {
				photo: await saveUploadedFile(data.photo),
				govtId: await saveUploadedFile(data.govtId),
				signature: data.signature ? await saveUploadedFile(data.signature) : null,
				pensionCard: data.pensionCard ? await saveUploadedFile(data.pensionCard) : null
			};

			id = await db.transaction(async (tx) => {
				const newId = await addEmployee(tx, data, files, {
					userId: locals.user?.id,
					branchId: activeBranch
				});
				await recordAudit(tx, event, { table: 'employee', recordId: newId, action: 'create' });
				return newId;
			});
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9).
			console.error('[employees] add failed:', err);
			return message(
				form,
				{ type: 'error', text: 'The employee could not be saved. Please try again.' },
				{ status: 500 }
			);
		}

		redirect(
			`/dashboard/employees/single/${id}`,
			{ type: 'success', message: 'Employee Successfully Added!' },
			cookies
		);
	}
};
