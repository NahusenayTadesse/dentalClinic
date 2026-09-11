import { contentCrud } from '$lib/server/crud';
import { dentalLab } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/** Dental laboratories, as a plain lookup screen. */
const crud = contentCrud({
	table: dentalLab,
	label: 'Dental Lab',
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
	 * Soft delete, super admin only. `lab_case.lab_id` is `restrict`, so a hard delete would be
	 * refused while any case is out with them; soft delete retires the lab from the picker while
	 * every case it ever made stays readable.
	 */
	delete: lookupDeleteAction(dentalLab, 'dental lab')
};
