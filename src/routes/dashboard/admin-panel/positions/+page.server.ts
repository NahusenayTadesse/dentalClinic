import { contentCrud } from '$lib/server/crud';
import { position, department } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { departments } from '$lib/server/fastData';
import { add, edit } from './schema';

/**
 * A lookup table with one foreign key. The `references` entry joins department for the list and
 * loads the picker's options; it pairs with the `reference` field in `./lookup.ts`.
 */
const crud = contentCrud({
	table: position,
	label: 'Position',
	addSchema: add,
	editSchema: edit,
	references: [
		{
			field: 'departmentId',
			table: department,
			as: 'department',
			options: departments,
			optionsKey: 'departmentList'
		}
	]
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(position, 'position')
};
