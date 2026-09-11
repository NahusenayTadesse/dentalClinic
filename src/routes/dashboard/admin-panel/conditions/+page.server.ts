import { contentCrud } from '$lib/server/crud';
import { condition } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * The condition catalogue.
 *
 * Rows added here get `source: 'clinic'` from the column default, which is what protects them
 * from a future sync — that job only touches `seed` and `import` rows.
 */
const crud = contentCrud({
	table: condition,
	label: 'Condition',
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
	 * Soft delete, super admin only. `patient_conditions.condition_id` is `restrict`, so a hard
	 * delete would be refused while any patient carries it; soft delete retires it from the
	 * picker while every recorded diagnosis stays countable.
	 */
	delete: lookupDeleteAction(condition, 'condition')
};
