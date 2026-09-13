import {
	patientAllergies,
	patientConditions,
	patientContacts,
	patientEmergencyContacts,
	patientMedications
} from '$lib/server/db/schema';
import { childCrud } from '$lib/server/childCrud';
import {
	addAllergy,
	addCondition,
	addContact,
	addEmergencyContact,
	addMedication,
	editAllergy,
	editCondition,
	editContact,
	editEmergencyContact,
	editMedication
} from '../schema';

/**
 * The child sections of a patient's chart, as configuration.
 *
 * Every one is audited (CLAUDE.md §11 — a patient's clinical children are on the list) and every
 * one names the permission a write needs. The split is the one `routeAccess.ts` describes: opening
 * the chart is `patients.view`; changing how to reach someone is `patients.edit`; changing what is
 * wrong with them or what they take is `patients.clinical`.
 *
 * The keys are the action names: `Allergy` becomes `addAllergy`, `editAllergy`, `deleteAllergy`,
 * and `childActionPaths('Allergy')` on the page posts to the same three.
 */

/**
 * The date a condition resolved or a medicine stopped: kept if it already had one, today if it has
 * just become so, and cleared if it no longer is.
 */
function settledOn(settled: boolean, existing: unknown): unknown {
	if (!settled) return null;
	if (existing) return existing;
	// The local date, not `toISOString()`'s UTC one — three hours behind here, which files anything
	// saved before 3 a.m. under yesterday.
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const SECTIONS = {
	Allergy: childCrud({
		table: patientAllergies,
		ownerColumn: 'patientId',
		label: 'Allergy',
		addSchema: addAllergy,
		editSchema: editAllergy,
		audit: 'patient_allergies',
		permission: 'patients.clinical'
	}),

	Condition: childCrud({
		table: patientConditions,
		ownerColumn: 'patientId',
		label: 'Condition',
		addSchema: addCondition,
		editSchema: editCondition,
		audit: 'patient_conditions',
		permission: 'patients.clinical',
		/*
		 * The resolved date follows the status rather than being typed. The date picker cannot be
		 * left empty, so offering it would stamp "resolved today" on every active condition; and a
		 * condition marked resolved with no date is exactly the record nobody can reason about later.
		 * Kept when it was already resolved, so re-saving a note does not move the date.
		 */
		transform: (values, _event, before) => ({
			...values,
			resolvedOn: settledOn(values.status === 'resolved', before?.resolvedOn)
		})
	}),

	Medication: childCrud({
		table: patientMedications,
		ownerColumn: 'patientId',
		label: 'Medication',
		addSchema: addMedication,
		editSchema: editMedication,
		audit: 'patient_medications',
		permission: 'patients.clinical',
		// Same reasoning as a condition's resolved date: stopping a medicine dates itself.
		transform: (values, _event, before) => ({
			...values,
			stoppedOn: settledOn(values.status === 'stopped', before?.stoppedOn)
		})
	}),

	Contact: childCrud({
		table: patientContacts,
		ownerColumn: 'patientId',
		label: 'Contact',
		addSchema: addContact,
		editSchema: editContact,
		audit: 'patient_contacts',
		permission: 'patients.edit'
	}),

	EmergencyContact: childCrud({
		table: patientEmergencyContacts,
		ownerColumn: 'patientId',
		label: 'Emergency contact',
		addSchema: addEmergencyContact,
		editSchema: editEmergencyContact,
		audit: 'patient_emergency_contacts',
		permission: 'patients.edit'
	})
};
