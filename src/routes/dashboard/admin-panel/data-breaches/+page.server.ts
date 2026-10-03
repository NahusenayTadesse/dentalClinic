import { contentCrud } from '$lib/server/crud';
import { dataBreach } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/** The breach log, as a lookup screen. Empty dates arrive as `''`, which is not a date. */
const crud = contentCrud({
	table: dataBreach,
	label: 'Breach',
	addSchema: add,
	editSchema: edit,
	uniqueField: 'title',
	transform: (values) => ({
		...values,
		occurredOn: values.occurredOn || null,
		reportedOn: values.reportedOn || null,
		notifiedOn: values.notifiedOn || null
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
	/** Soft delete, super admin only — for an entry made in error, not for a breach that is over. */
	delete: lookupDeleteAction(dataBreach, 'breach')
};
