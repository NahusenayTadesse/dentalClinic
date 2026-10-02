import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { patientAction } from '$lib/server/patientAction';
import { providerOptions } from '$lib/server/appointments';
import { ORTHO_PERMISSION, openCase, orthoCases } from '$lib/server/ortho';
import { clinicToday } from '$lib/clinicTime';
import { newCase } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The patient's orthodontic tab: every course of treatment, how far along it is and where its
 * payments stand, and starting a new one. Reading is the chart's `patients.view`; opening a case is
 * `patients.clinical`, checked in the action (CLAUDE.md §9).
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'ortho', event);

	const [cases, providers, open] = await Promise.all([
		orthoCases(patient.id),
		providerOptions(),
		superValidate(
			{
				startedOn: clinicToday(),
				appliance: 'fixedBoth',
				plannedMonths: 18,
				instalments: 12,
				deposit: 0
			},
			zod4(newCase),
			{ errors: false }
		)
	]);
	return {
		cases,
		providers: [
			{ value: '', name: 'Not recorded' },
			...providers.map((p) => ({ value: String(p.value), name: p.name }))
		],
		forms: { open },
		canWrite: hasPermission(event.locals, ORTHO_PERMISSION)
	};
};

export const actions: Actions = {
	open: (event) =>
		patientAction(event, ORTHO_PERMISSION, newCase, async (tx, { patientId, data }) => {
			const id = await openCase(tx, event, patientId, {
				providerId: Number(data.providerId) || null,
				appliance: data.appliance,
				startedOn: data.startedOn,
				plannedMonths: data.plannedMonths,
				totalFee: data.totalFee,
				deposit: data.deposit,
				instalments: data.instalments,
				notes: data.notes || null
			});
			return {
				redirect: `/dashboard/patients/${patientId}/ortho/${id}`,
				text: 'Case opened, with its payment plan.'
			};
		})
};
