import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import {
	acceptedProgress,
	addLines,
	answerPlan,
	completePlan,
	discardDraft,
	originalTotal,
	planAdjustments,
	planDetail,
	plannableProcedures,
	presentPlan,
	removeLine,
	updateLine,
	workToBook
} from '$lib/server/treatmentPlans';
import { addClinicDays, clinicToday } from '$lib/clinicTime';
import { DEFAULT_VALID_DAYS, canAddLines, planTotals } from '$lib/treatmentPlanStatus';
import { PLAN_PERMISSION, planAction } from '../planAction';
import { addWork, answer, confirmOnly, editLine, present, removeLineForm } from '../schema';
import type { Actions, PageServerLoad } from './$types';

/** The plan id from the path, or a 404 — never a query for `NaN`. */
function planIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Plan not found');
	return id;
}

/**
 * One treatment plan: its lines, what the patient said to each, and the next step — present a
 * draft, record an answer, or close the plan once the agreed work is done.
 *
 * Every step is an action that re-checks the plan belongs to this patient and allows the step
 * (`server/treatmentPlans.ts`); the page only offers the steps `$lib/treatmentPlanStatus.ts` says
 * the plan is at.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	const planId = planIdParam(event.params.planId);

	const plan = await planDetail(patient.id, planId);
	if (!plan) error(404, 'That plan is not on this patient’s record.');

	await logPatientView(patient.id, 'treatmentPlan', event, { recordId: planId });

	const today = clinicToday();
	const [plannable, adjustments, toBook, forms] = await Promise.all([
		canAddLines(plan.status) ? plannableProcedures(patient.id) : Promise.resolve([]),
		planAdjustments(planId),
		// Agreed work no live appointment holds yet: what "Book the agreed work" would take.
		workToBook(patient.id, planId),
		Promise.all([
			superValidate(zod4(addWork)),
			superValidate(zod4(editLine)),
			superValidate({ validUntil: addClinicDays(today, DEFAULT_VALID_DAYS) }, zod4(present)),
			superValidate(
				{
					decisions: plan.lines.map((line) => ({ itemId: line.id, decision: line.decision })),
					declineReason: plan.declineReason ?? ''
				},
				zod4(answer)
			),
			superValidate(zod4(removeLineForm)),
			superValidate(zod4(confirmOnly))
		])
	]);
	const [addForm, editForm, presentForm, answerForm, removeForm, confirmForm] = forms;

	return {
		plan,
		adjustments,
		originalTotal: originalTotal(planTotals(plan.lines).quoted, adjustments),
		progress: acceptedProgress(plan.lines),
		toBook: toBook.length,
		plannable,
		forms: {
			add: addForm,
			edit: editForm,
			present: presentForm,
			answer: answerForm,
			remove: removeForm,
			confirm: confirmForm
		},
		canPlan: hasPermission(event.locals, PLAN_PERMISSION)
	};
};

export const actions: Actions = {
	addWork: (event) =>
		planAction(event, addWork, async (tx, { patientId, data }) => {
			await addLines(
				tx,
				event,
				patientId,
				planIdParam(event.params.planId),
				data.procedureIds,
				data.reason
			);
			return 'Added to the plan.';
		}),

	editLine: (event) =>
		planAction(event, editLine, async (tx, { patientId, data }) => {
			await updateLine(tx, event, patientId, planIdParam(event.params.planId), data);
			return 'Line updated.';
		}),

	removeLine: (event) =>
		planAction(event, removeLineForm, async (tx, { patientId, data }) => {
			await removeLine(
				tx,
				event,
				patientId,
				planIdParam(event.params.planId),
				data.itemId,
				data.reason
			);
			return 'Line removed. The work is still planned on the chart.';
		}),

	present: (event) =>
		planAction(event, present, async (tx, { patientId, data }) => {
			await presentPlan(
				tx,
				event,
				patientId,
				planIdParam(event.params.planId),
				data.validUntil || null
			);
			return 'Presented. Record the patient’s answer here when they give it.';
		}),

	answer: (event) =>
		planAction(event, answer, async (tx, { patientId, data }) => {
			const decisions: Record<number, 'accepted' | 'declined'> = {};
			for (const d of data.decisions) {
				if (d.decision !== 'pending') decisions[d.itemId] = d.decision;
			}
			await answerPlan(tx, event, patientId, planIdParam(event.params.planId), {
				decisions,
				reason: data.declineReason ?? null
			});
			return 'Answer recorded.';
		}),

	complete: (event) =>
		planAction(event, confirmOnly, async (tx, { patientId }) => {
			await completePlan(tx, event, patientId, planIdParam(event.params.planId));
			return 'Plan completed.';
		}),

	discard: (event) =>
		planAction(event, confirmOnly, async (tx, { patientId }) => {
			await discardDraft(tx, event, patientId, planIdParam(event.params.planId));
			return {
				redirect: `/dashboard/patients/${patientId}/plans`,
				text: 'Draft discarded. The work is still planned on the chart.'
			};
		})
};
