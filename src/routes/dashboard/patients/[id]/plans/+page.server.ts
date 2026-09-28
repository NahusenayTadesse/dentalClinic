import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { providerOptions } from '$lib/server/appointments';
import { createPlan, patientPlans, plannableProcedures } from '$lib/server/treatmentPlans';
import { PLAN_PERMISSION, planAction } from './planAction';
import { newPlan } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The treatment plans tab: every plan this patient has been offered, and a new one from the work
 * planned on their chart.
 *
 * Reading it is the chart's `patients.view`. Drawing up a plan is `treatment_plans.manage`, checked
 * in the action; `can.plan` below only decides what the screen offers.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();

	await logPatientView(patient.id, 'treatmentPlan', event);

	const [plans, plannable, providers, form] = await Promise.all([
		patientPlans(patient.id),
		plannableProcedures(patient.id),
		providerOptions(),
		superValidate(zod4(newPlan))
	]);

	return {
		plans,
		plannable,
		providers: providers.map((p) => ({ value: String(p.value), name: p.name })),
		form,
		canPlan: hasPermission(event.locals, PLAN_PERMISSION)
	};
};

export const actions: Actions = {
	newPlan: (event) =>
		planAction(event, newPlan, async (tx, { patientId, data }) => {
			const planId = await createPlan(tx, event, {
				patientId,
				procedureIds: data.procedureIds,
				providerId: Number(data.providerId) || null,
				note: data.note?.trim() || null,
				branchId: event.locals.branch.active
			});
			return {
				redirect: `/dashboard/patients/${patientId}/plans/${planId}`,
				text: 'Draft plan started. Check the lines, then present it.'
			};
		})
};
