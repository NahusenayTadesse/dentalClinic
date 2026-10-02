import { contentCrud } from '$lib/server/crud';
import { allergen, medicine } from '$lib/server/db/schema/';
import { allergens } from '$lib/server/fastData';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * The medicine list.
 *
 * Until this screen existed the list was seed-only, so a clinic whose patient took something
 * unlisted had nowhere to record it except a free-text note that no allergy or bleeding-risk
 * check can read.
 *
 * `genericName` is the unique column, not `name` — the table has no `name`, and the duplicate
 * check has to land on the field the schema actually keeps unique.
 */
const crud = contentCrud({
	table: medicine,
	label: 'Medicine',
	addSchema: add,
	editSchema: edit,
	uniqueField: 'genericName',
	references: [
		{
			field: 'allergenId',
			table: allergen,
			as: 'allergen',
			options: allergens,
			optionsKey: 'allergenList'
		}
	],
	// "No family" arrives as `''`, which is not an id; "not controlled" as `''`, which is not a class.
	transform: (values) => ({
		...values,
		allergenId: Number(values.allergenId) || null,
		controlClass:
			values.controlClass === 'narcotic' || values.controlClass === 'psychotropic'
				? values.controlClass
				: null
	})
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
	 * Soft delete, super admin only. A patient's medication row and a prescription item both point
	 * here, so a retired medicine leaves the pickers while every record that names it stays
	 * readable.
	 */
	delete: lookupDeleteAction(medicine, 'medicine')
};
