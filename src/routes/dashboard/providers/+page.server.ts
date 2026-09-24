import { contentCrud } from '$lib/server/crud';
import { employee, provider, providerSpecialty } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { employeeFullName } from '$lib/server/employeeName';
import { employees, specialties } from '$lib/server/fastData';
import { add, edit } from './schema';

/**
 * Providers — the clinical licence and diary settings attached to a member of staff.
 *
 * Two references rather than one: the employee whose record this is, and their specialty. The
 * employee reference is what makes `provider_live_employee_unique` reachable from the form — a
 * second provider row for the same person is reported against the picker that chose them.
 *
 * Not branch scoped (CLAUDE.md §15): a dentist who works two days at each branch is one provider,
 * and the booking overlap check is what stops them being in two places at once.
 */
const crud = contentCrud({
	table: provider,
	label: 'Dentist',
	addSchema: add,
	editSchema: edit,
	uniqueField: 'employeeId',
	references: [
		{
			field: 'employeeId',
			table: employee,
			as: 'employee',
			// `employee.name` is the given name alone; the list needs the name staff would say.
			nameColumn: employeeFullName,
			options: employees,
			optionsKey: 'employeeList'
		},
		{
			field: 'specialtyId',
			table: providerSpecialty,
			as: 'specialty',
			options: specialties,
			optionsKey: 'specialtyList'
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
	/**
	 * Soft delete, super admin only. `appointment.provider_id` is `set null`, so removing a
	 * clinician leaves their past appointments standing with the patient and the chair intact.
	 */
	delete: lookupDeleteAction(provider, 'dentist')
};
