import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patient } from '$lib/server/db/schema';
import { formAction, ownedAction } from '$lib/server/patientAction';
import { refuseUnless } from '$lib/server/childCrud';
import { livePatient } from '$lib/server/patients';
import {
	STERILISATION_PERMISSION,
	cycleLog,
	recordCycle,
	sterilisersAt,
	usePacks
} from '$lib/server/sterilisation';
import { clinicClock, clinicToday, fromClinic } from '$lib/clinicTime';
import { parseLoad, parsePackCodes } from '$lib/sterilisation';
import { newCycle, usePacksForm } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The sterilisation log for the branch being worked at: every cycle, newest first, recording the
 * next one as it comes out of the machine, and recording packs opened for a patient. The route rule
 * is `sterilisation.record`, and each action asks again (CLAUDE.md §9).
 */
export const load: PageServerLoad = async ({ locals }) => {
	const now = new Date();
	const [cycles, sterilisers, record, use] = await Promise.all([
		cycleLog(locals.branch),
		sterilisersAt(locals.branch),
		superValidate(
			{
				ranOn: clinicToday(),
				ranAt: clinicClock(now),
				kind: 'load',
				chemical: 'pass',
				biological: 'none',
				temperatureC: '',
				holdMinutes: ''
			},
			zod4(newCycle),
			{ errors: false }
		),
		superValidate(zod4(usePacksForm))
	]);
	return {
		cycles,
		sterilisers: sterilisers.map((s) => ({ value: String(s.value), name: s.name })),
		forms: { record, use },
		oneBranch: locals.branch.active !== null
	};
};

/** The chosen patient, if they are a live record. */
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
	record: (event) =>
		formAction(event, STERILISATION_PERMISSION, newCycle, async (data) => {
			const load = parseLoad(data.load ?? '');
			return async (tx) => {
				refuseUnless(!('error' in load), 'error' in load ? load.error : '', 'load');
				const id = await recordCycle(tx, event, {
					steriliserId: Number(data.steriliserId),
					kind: data.kind,
					ranAt: fromClinic(data.ranOn, data.ranAt),
					program: data.program || null,
					temperatureC: data.temperatureC ? Number(data.temperatureC) : null,
					holdMinutes: data.holdMinutes ? Number(data.holdMinutes) : null,
					chemical: data.chemical,
					biological: data.biological,
					note: data.note || null,
					packs: 'packs' in load ? load.packs : [],
					shelfDays: data.shelfDays
				});
				return { redirect: `/dashboard/sterilisation/${id}`, text: 'Cycle recorded.' };
			};
		}),

	use: (event) =>
		ownedAction(
			event,
			STERILISATION_PERMISSION,
			usePacksForm,
			(data) => chosenPatient(data.patientId),
			async (tx, { ownerId, data }) => {
				const n = await usePacks(tx, event, ownerId, parsePackCodes(data.codes), null);
				return `Recorded ${n} pack${n === 1 ? '' : 's'} against the patient.`;
			}
		)
};
