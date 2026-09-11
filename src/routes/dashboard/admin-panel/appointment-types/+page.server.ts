import { contentCrud } from '$lib/server/crud';
import { appointmentType } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/** Appointment types, as a plain lookup screen. */
const crud = contentCrud({
	table: appointmentType,
	label: 'Appointment Type',
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
	 * Soft delete, super admin only. `appointment.appointment_type_id` is `set null`, so retiring
	 * a type leaves past appointments standing rather than rewriting what they were for.
	 */
	delete: lookupDeleteAction(appointmentType, 'appointment type')
};
