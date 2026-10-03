import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { db } from '$lib/server/db';
import { recordAudit } from '$lib/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors.js';
import { allergens, customerList, referralSources } from '$lib/server/fastData';
import { possibleDuplicates, type PossibleDuplicate } from '$lib/server/patients';
import { insertPatient } from '$lib/server/patientWrites';
import type { FormMessage } from '@nahu/admin-kit/forms/createForm.js';
import { registerPatient } from '../schema';
import { messagesFor } from '$lib/i18n/messages';
import { duplicateReason } from '../labels.server';
import type { Actions, PageServerLoad } from './$types';

/**
 * Registering a patient.
 *
 * The route rule (`patients.register`) is the whole gate: registering is exactly what this page
 * does, so the action needs no second permission of its own (CLAUDE.md §9).
 *
 * **Duplicates are asked about before the insert, across every branch.** A second record for the
 * same person is the likeliest way this system hurts somebody — see `possibleDuplicates`. A match
 * stops the save and shows who matched; the receptionist either opens the existing chart or ticks
 * that this is someone else, and only then is the record written.
 */

/** A registration's message can carry the patients it may duplicate. */
type RegisterMessage = FormMessage & { duplicates?: PossibleDuplicate[] };

export const load: PageServerLoad = async () => {
	const [form, referralList, customers, allergenList] = await Promise.all([
		superValidate(zod4(registerPatient)),
		referralSources(),
		customerList(),
		allergens()
	]);

	return { form, referralList, customers, allergenList };
};

export const actions: Actions = {
	default: async (event) => {
		const { request, locals, cookies } = event;
		const m = messagesFor(locals.lang);
		const toast = m.patients.toast;
		const form = await superValidate<typeof registerPatient._output, RegisterMessage>(
			request,
			zod4(registerPatient)
		);

		if (!form.valid) {
			return message(form, { type: 'error', text: toast.checkForm }, { status: 400 });
		}

		const data = form.data;

		if (!data.confirmNotDuplicate) {
			const duplicates = await possibleDuplicates(data);
			if (duplicates.length) {
				return message(
					form,
					{
						type: 'error',
						text: toast.mayBeDuplicate(duplicates.length),
						duplicates: duplicates.map((d) => ({ ...d, reason: duplicateReason(m, d.reason) }))
					},
					{ status: 409 }
				);
			}
		}

		let id: number;

		try {
			id = await db.transaction(async (tx) => {
				const created = await insertPatient(tx, data, {
					userId: locals.user?.id,
					branchId: locals.branch.active
				});

				// One audit row for the registration, not one per allergy: it is one act (AUDIT.md).
				await recordAudit(tx, event, {
					table: 'patient',
					recordId: created.id,
					action: 'create',
					detail: created.allergies ? { allergiesReported: created.allergies } : undefined
				});

				return created.id;
			});
		} catch (err: unknown) {
			if (isDuplicateKey(err)) {
				setError(form, 'fileNo', toast.fileNoTaken);
				return message(form, { type: 'error', text: toast.fileNoInUse }, { status: 400 });
			}

			// Loud in the log, quiet to the client (§9).
			console.error('[patients] register failed:', err);
			return message(form, { type: 'error', text: toast.registerFailed }, { status: 500 });
		}

		redirect(
			`/dashboard/patients/${id}`,
			{ type: 'success', message: toast.registered(`${data.name} ${data.fatherName}`) },
			cookies
		);
	}
};
