import { contentCrud } from '$lib/server/crud';
import { contactTypes } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * The patient contact channels, as a plain lookup screen.
 *
 * This is the screen that makes `patient_contacts` extendable without a developer, which is the
 * whole reason the type is a table rather than a `varchar` like `staff_contacts` uses.
 */
const crud = contentCrud({
	table: contactTypes,
	label: 'Contact Type',
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
	 * Soft delete, super admin only. `patient_contacts.contact_type_id` is `restrict`, so a hard
	 * delete would be refused while rows use it; soft delete leaves those rows readable.
	 */
	delete: lookupDeleteAction(contactTypes, 'contact type')
};
