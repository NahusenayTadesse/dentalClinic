import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';

import { db } from '$lib/server/db';
import { patient, patientAllergies } from '$lib/server/db/schema';
import { insertReturningId } from '$lib/server/db/insert';
import { recordAudit } from '$lib/server/audit';
import { isDuplicateKey } from '$lib/server/dbErrors';
import { allergens, customerList, referralSources } from '$lib/server/fastData';
import { birthDateFrom, possibleDuplicates, type PossibleDuplicate } from '$lib/server/patients';
import type { FormMessage } from '$lib/forms/createForm';
import { registerPatient } from '../schema';
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
		const form = await superValidate<typeof registerPatient._output, RegisterMessage>(
			request,
			zod4(registerPatient)
		);

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Please check the form for errors' },
				{ status: 400 }
			);
		}

		const data = form.data;

		if (!data.confirmNotDuplicate) {
			const duplicates = await possibleDuplicates(data);
			if (duplicates.length) {
				return message(
					form,
					{
						type: 'error',
						text: `This may be someone already registered — ${duplicates.length === 1 ? 'one patient matches' : `${duplicates.length} patients match`}.`,
						duplicates
					},
					{ status: 409 }
				);
			}
		}

		const allergenIds = [
			...new Set(
				(data.allergenIds ?? '')
					.split(',')
					.map((v) => Number(v.trim()))
					.filter((n) => Number.isInteger(n) && n > 0)
			)
		];

		let id: number;

		try {
			id = await db.transaction(async (tx) => {
				const newId = await insertReturningId(tx, patient, {
					fileNo: data.fileNo ?? null,
					name: data.name,
					fatherName: data.fatherName,
					grandFatherName: data.grandFatherName ?? null,
					sex: data.sex,
					...birthDateFrom(data),
					phone: data.phone ?? null,
					altPhone: data.altPhone ?? null,
					bloodType: data.bloodType ?? null,
					medicalNotes: data.medicalNotes ?? null,
					referralSourceId: data.referralSourceId ?? null,
					referredBy: data.referredBy ?? null,
					customerId: data.customerId ?? null,
					/*
					 * Stamped from the branch being worked at, never defaulted (CLAUDE.md §15). Someone
					 * seeing "all branches" is not standing at any of them, so the record falls back to the
					 * column default — the main branch — rather than to whichever branch sorts first.
					 */
					...(locals.branch.active !== null ? { branchId: locals.branch.active } : {}),
					createdBy: locals.user?.id
				});

				if (allergenIds.length) {
					await tx.insert(patientAllergies).values(
						allergenIds.map((allergenId) => ({
							patientId: newId,
							allergenId,
							// Reported at the desk, not assessed. A clinician grades it on the chart.
							severity: 'unknown' as const,
							createdBy: locals.user?.id
						}))
					);
				}

				// One audit row for the registration, not one per allergy: it is one act (AUDIT.md).
				await recordAudit(tx, event, {
					table: 'patient',
					recordId: newId,
					action: 'create',
					detail: allergenIds.length ? { allergiesReported: allergenIds.length } : undefined
				});

				return newId;
			});
		} catch (err: unknown) {
			if (isDuplicateKey(err)) {
				setError(form, 'fileNo', 'Another patient already has this file number.');
				return message(
					form,
					{ type: 'error', text: 'That file number is already in use.' },
					{ status: 400 }
				);
			}

			// Loud in the log, quiet to the client (§9).
			console.error('[patients] register failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not register the patient. Please try again.' },
				{ status: 500 }
			);
		}

		redirect(
			`/dashboard/patients/${id}`,
			{ type: 'success', message: `${data.name} ${data.fatherName} registered.` },
			cookies
		);
	}
};
