import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { INBOX_DIR, inboxFiles } from '$lib/server/files';
import { attachFromInbox } from '$lib/server/patientFiles';
import { ownedAction } from '$lib/server/patientAction';
import { livePatient } from '$lib/server/patients';
import { isProjection } from '$lib/radiographs';
import { CLINICAL_PERMISSION } from '../[id]/clinicalAction';
import { fileImage } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The radiograph inbox: images the sensor's or panoramic machine's software exported into
 * `RADIOGRAPH_INBOX`, waiting to be filed to a patient. The route rule asks `patients.clinical` —
 * an unfiled radiograph is a patient's record whose patient has not been named yet — and so does
 * the filing action itself (CLAUDE.md §9).
 */
export const load: PageServerLoad = async () => {
	const [files, form] = await Promise.all([inboxFiles(), superValidate(zod4(fileImage))]);
	return {
		configured: INBOX_DIR !== null,
		files: (files ?? []).map((f) => ({
			...f,
			fileable: f.format === 'jpeg' || f.format === 'png'
		})),
		form
	};
};

/** The chosen patient, if they are a live record — a merged-away or deleted one is not filed to. */
async function chosenPatient(id: number): Promise<number> {
	const [row] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(eq(patient.id, id), livePatient()))
		.limit(1);
	if (!row) error(404, 'That patient is not on the register.');
	return row.id;
}

export const actions: Actions = {
	file: (event) =>
		ownedAction(
			event,
			CLINICAL_PERMISSION,
			fileImage,
			(data) => chosenPatient(data.patientId),
			async (tx, { ownerId, data }) => {
				await attachFromInbox(tx, event, ownerId, {
					name: data.name,
					projection: isProjection(data.projection) ? data.projection : null,
					toothId: Number(data.toothId) || null,
					takenOn: data.takenOn || null,
					description: data.description || null,
					appointmentId: null
				});
				return 'Filed to the patient’s chart.';
			}
		)
};
