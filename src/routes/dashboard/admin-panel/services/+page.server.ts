import { contentCrud } from '$lib/server/crud';
import { condition, services, serviceCategories } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { conditions, serviceCategory } from '$lib/server/fastData';
import { add, edit } from './schema';

/**
 * A lookup table with two foreign keys. Each `references` entry joins its table for the list and
 * loads the picker's options; they pair with the `reference` fields in `./lookup.ts`.
 */
const crud = contentCrud({
	table: services,
	label: 'Service',
	addSchema: add,
	editSchema: edit,
	references: [
		{
			field: 'categoryId',
			table: serviceCategories,
			as: 'category',
			options: serviceCategory,
			optionsKey: 'categoryList'
		},
		{
			field: 'conditionId',
			table: condition,
			as: 'condition',
			options: conditions,
			optionsKey: 'conditionList'
		}
	],
	// "No diagnosis" arrives as `''`, which is not an id.
	transform: (values) => ({ ...values, conditionId: Number(values.conditionId) || null })
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
	delete: lookupDeleteAction(services, 'service')
};
