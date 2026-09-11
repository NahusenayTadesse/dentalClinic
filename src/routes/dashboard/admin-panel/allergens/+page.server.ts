import { contentCrud } from '$lib/server/crud';
import { allergen } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * The allergen list, as a plain lookup screen.
 *
 * This is what makes coding the substance affordable: a clinic that meets something not on the
 * list adds it here rather than losing it to a free-text box that no report can read.
 */
const crud = contentCrud({
	table: allergen,
	label: 'Allergen',
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
	 * Soft delete, super admin only. `patient_allergies.allergen_id` is `restrict`, so a hard
	 * delete would be refused while any patient lists it; soft delete retires the option from
	 * the picker while every recorded allergy stays readable.
	 */
	delete: lookupDeleteAction(allergen, 'allergen')
};
