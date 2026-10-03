import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addLeave as schema } from './schema';
import { db } from '$lib/server/db';
import { leave } from '$lib/server/db/schema/';
import { subcities, leaveTypes } from '$lib/server/fastData';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types.js';
import { saveUploadedFile } from '$lib/server/upload';
import { computeLeaveDays } from '$lib/leaveDays';
import { leaveAllowanceError } from '$lib/server/leaveAllowance';
import { hideFailure } from '@nahu/admin-kit/server/dbErrors.js';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(schema));

	const subcityList = await subcities();

	// Label each type with its allowance so the picker reads the way the old hard-coded list did.
	// `maxDays` rides along so the form can flag an over-long request before it is submitted.
	const leaveTypeList = (await leaveTypes()).map(({ value, name, description, maxDays }) => ({
		value,
		name: description ? `${name}: ${description}` : name,
		maxDays
	}));

	return {
		form,
		subcityList,
		leaveTypeList
	};
};

export const actions: Actions = {
	addLeave: async ({ request, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: 'Please check your form.' });
		}
		const {
			requestDate,
			startDate,
			endDate,
			halfDayStart,
			halfDayEnd,
			leavesLetter,
			reason,
			leaveType: leaveTypeId
		} = form.data;

		// Stored rather than re-derived on read: the dates give the calendar span, but only the
		// half-day flags say what the leave actually costs, and the ledger spends this figure.
		const days = computeLeaveDays({ startDate, endDate, halfDayStart, halfDayEnd });

		if (days <= 0) {
			return setError(form, 'endDate', 'The end date cannot be before the start date.');
		}

		// The allowance shown against each type is a real limit, not a label.
		const overAllowance = await leaveAllowanceError(db, leaveTypeId, days);
		if (overAllowance) {
			return setError(form, 'leaveType', overAllowance);
		}

		try {
			await db.transaction(async (tx) => {
				if (leavesLetter) {
					const leaveLetterFile = await saveUploadedFile(leavesLetter);
					await tx.insert(leave).values({
						staffId: Number(id),
						leaveTypeId,
						requestDate,
						startDate,
						endDate,
						halfDayStart,
						halfDayEnd,
						days,
						leaveLetter: leaveLetterFile,
						reason
					});
				} else {
					await tx.insert(leave).values({
						staffId: Number(id),
						leaveTypeId,
						requestDate,
						startDate,
						endDate,
						halfDayStart,
						halfDayEnd,
						days,
						reason
					});
				}
			});

			return message(form, { type: 'success', text: 'Leave added successfully' });
			// Stay on the same page and set a flash message
			// setFlash({ type: 'success', message: 'Customer Successfully Added' }, cookies);
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (CLAUDE.md §9). This used to put the database's own
			// error text on screen, which tells the person at the desk nothing and tells anyone else
			// the shape of the tables.
			return message(form, {
				type: 'error',
				text: hideFailure('employees.addLeave', err, 'Could not add the leave. Please try again.')
			});
		}
	}
};
