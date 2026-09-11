import { contentCrud } from '$lib/server/crud';
import { providerSpecialty } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/** Clinician specialties, as a plain lookup screen. */
const crud = contentCrud({
	table: providerSpecialty,
	label: 'Specialty',
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
	/** Soft delete, super admin only. `provider.specialty_id` survives it and stays readable. */
	delete: lookupDeleteAction(providerSpecialty, 'specialty')
};
