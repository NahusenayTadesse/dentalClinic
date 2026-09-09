import { contentCrud } from '$lib/server/crud';
import { city, region } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { regions } from '$lib/server/fastData';
import { add, edit } from './schema';

/**
 * A lookup table with one foreign key. The `references` entry is what joins `region` for the
 * list and loads the picker's options; it pairs with the `reference` field in `./lookup.ts`.
 */
const crud = contentCrud({
	table: city,
	label: 'City',
	addSchema: add,
	editSchema: edit,
	references: [
		{ field: 'regionId', table: region, as: 'region', options: regions, optionsKey: 'regionList' }
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
	delete: lookupDeleteAction(city, 'city')
};
