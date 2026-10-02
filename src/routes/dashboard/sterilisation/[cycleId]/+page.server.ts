import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { STERILISATION_PERMISSION, cycleDetail, readSporeTest } from '$lib/server/sterilisation';
import { sporeReading } from './schema';
import type { Actions, PageServerLoad } from './$types';

/** The cycle id from the path, or a 404 — never a query for `NaN`. */
function cycleIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Cycle not found');
	return id;
}

/**
 * One cycle: its readings, its packs and who each was opened for, and — while its spore test is
 * out — reading it. A failed cycle lists the patients its packs were used on, which is the reason
 * packs are recorded at all (`$lib/sterilisation.ts`).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const detail = await cycleDetail(locals.branch, cycleIdParam(params.cycleId));
	if (!detail) error(404, 'That cycle is not in this branch’s log.');
	return { ...detail, spore: await superValidate(zod4(sporeReading)) };
};

export const actions: Actions = {
	spore: (event) =>
		formAction(event, STERILISATION_PERMISSION, sporeReading, async (data) => async (tx) => {
			await readSporeTest(tx, event, cycleIdParam(event.params.cycleId), data.result);
			return data.result === 'pass'
				? 'Spore test passed.'
				: 'Cycle failed. Its unused packs are withdrawn; call the patients listed.';
		})
};
