import { contentCrud } from '$lib/server/crud';
import { serviceCategories } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * A plain lookup table: list, add, edit, soft delete. Everything but the delete comes from
 * `contentCrud`, which is why there is nothing here but the table and its schemas.
 */
const crud = contentCrud({
	table: serviceCategories,
	label: 'Service Category',
	addSchema: add,
	editSchema: edit
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
	delete: lookupDeleteAction(serviceCategories, 'service category')
};
