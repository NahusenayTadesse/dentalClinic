import { contentCrud } from '$lib/server/crud';
import { expensesType } from '$lib/server/db/schema';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * Expense categories, as a plain lookup screen. It was the last name-and-description screen
 * written out by hand — a page, an edit dialog and a delete dialog over three hand-rolled
 * actions — and is now the same `contentCrud` + `LookupPage` pair as the admin panel's.
 */
const crud = contentCrud({
	table: expensesType,
	label: 'Expense Category',
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
	/** Soft delete, super admin only: expenses filed under it keep their category. */
	delete: lookupDeleteAction(expensesType, 'expense category')
};
