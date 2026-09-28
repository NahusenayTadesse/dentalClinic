import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission, requireSuperAdmin } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { providerOptions, recentVisits } from '$lib/server/appointments';
import {
	cancelPrescription as cancel,
	chartAllergies,
	currentMedicines,
	patientPrescriptions,
	prescribableMedicines,
	writePrescription
} from '$lib/server/prescriptions';
import { clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import { CLINICAL_PERMISSION, clinicalAction } from '../clinicalAction';
import { cancelPrescription, newPrescription } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The prescriptions tab: what this patient has been prescribed, and writing a new one. Reading is
 * the chart's `patients.view`; writing is `patients.clinical`; cancelling one written in error is a
 * super admin's, as every delete is (CLAUDE.md §9). The rules are `server/prescriptions.ts`'s.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'prescription', event);

	const [prescriptions, medicines, allergies, current, prescribers, visits, form, cancelForm] =
		await Promise.all([
			patientPrescriptions(patient.id),
			prescribableMedicines(),
			chartAllergies(patient.id),
			currentMedicines(patient.id),
			providerOptions({ prescribersOnly: true }),
			recentVisits(patient.id),
			superValidate(zod4(newPrescription)),
			superValidate(zod4(cancelPrescription))
		]);

	return {
		prescriptions,
		medicines,
		allergies,
		currentMedicines: current,
		prescribers: prescribers.map((p) => ({ value: String(p.value), name: p.name })),
		visits: visits.map((v) => ({
			value: String(v.id),
			name: `${formatEthiopianDate(new Date(clinicDate(v.startsAt)))} ${ethiopianClock(v.startsAt)}${v.provider ? ` · ${v.provider}` : ''}`
		})),
		forms: { add: form, cancel: cancelForm },
		canWrite: hasPermission(event.locals, CLINICAL_PERMISSION),
		canCancel: event.locals.isSuperAdmin === true
	};
};

export const actions: Actions = {
	add: (event) =>
		clinicalAction(event, newPrescription, async (tx, { patientId, data }) => {
			const id = await writePrescription(tx, event, patientId, {
				providerId: Number(data.providerId) || null,
				appointmentId: Number(data.appointmentId) || null,
				weightKg: data.weightKg || null,
				indication: data.indication,
				notes: data.notes || null,
				allergyAcknowledged: data.allergyAcknowledged,
				items: data.items.map((item) => ({
					medicineId: item.medicineId,
					dose: item.dose || null,
					frequency: item.frequency || null,
					durationDays: item.durationDays || null,
					quantity: item.quantity || null,
					instructions: item.instructions || null
				}))
			});
			return {
				redirect: `/dashboard/patients/${patientId}/prescriptions?written=${id}`,
				text: 'Prescription written. Print it for the patient.'
			};
		}),

	cancel: (event) => {
		requireSuperAdmin(event.locals);
		return clinicalAction(event, cancelPrescription, async (tx, { patientId, data }) => {
			await cancel(tx, event, patientId, data.prescriptionId);
			return 'Prescription cancelled. It stays on the audit trail.';
		});
	}
};
