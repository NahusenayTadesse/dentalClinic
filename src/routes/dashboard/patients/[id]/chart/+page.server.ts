import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { childActions, childCrud } from '$lib/server/childCrud';
import { procedures } from '$lib/server/db/schema';
import { livePatientId, logPatientView } from '$lib/server/patients';
import { providerOptions } from '$lib/server/appointments';
import {
	chartProcedures,
	chartableServices,
	procedureTransform,
	visitOptions
} from '$lib/server/procedures';
import { addProcedure, editProcedure } from './schema';
import type { PageServerLoad } from './$types';

/**
 * The dental chart tab: the odontogram and every procedure on the patient's record.
 *
 * Writes go through `childCrud`, like the overview's sections — owner stamped server-side, scoped
 * edits and deletes, an audit row in the same transaction — with `procedureTransform` deciding
 * everything the form must not: placement, fee, completion date, visit and branch. The screen is
 * its own rather than a `LookupSection` because the form changes shape with the service chosen.
 *
 * Every write needs `patients.clinical`; reading the chart needs only the route's `patients.view`.
 */

const SECTIONS = {
	Procedure: childCrud({
		table: procedures,
		ownerColumn: 'patientId',
		label: 'Procedure',
		addSchema: addProcedure,
		editSchema: editProcedure,
		audit: 'procedures',
		permission: 'patients.clinical',
		transform: procedureTransform
	})
};

export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();

	await logPatientView(patient.id, 'procedure', event);

	const [rows, services, providers, visits, addForm, editForm] = await Promise.all([
		chartProcedures(patient.id),
		chartableServices(),
		providerOptions(),
		visitOptions(patient.id),
		superValidate(zod4(addProcedure)),
		superValidate(zod4(editProcedure))
	]);

	return { procedures: rows, services, providers, visits, forms: { add: addForm, edit: editForm } };
};

export const actions = childActions(SECTIONS, livePatientId);
