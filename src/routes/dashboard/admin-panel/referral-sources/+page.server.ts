import { contentCrud } from '$lib/server/crud';
import { referralSource } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/** Referral sources, as a plain lookup screen. */
const crud = contentCrud({
	table: referralSource,
	label: 'Referral Source',
	addSchema: add,
	editSchema: edit,
	uniqueField: 'name'
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/**
	 * Soft delete, super admin only. `patient.referral_source_id` is `set null`, so retiring a
	 * source leaves the patients who came through it counted under nothing rather than deleted.
	 */
	delete: lookupDeleteAction(referralSource, 'referral source')
};
