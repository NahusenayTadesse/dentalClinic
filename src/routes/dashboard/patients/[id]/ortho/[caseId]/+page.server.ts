import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { patientAction } from '$lib/server/patientAction';
import { providerOptions, recentVisits } from '$lib/server/appointments';
import {
	ORTHO_BILLING_PERMISSION,
	ORTHO_PERMISSION,
	billDueInstalments,
	nextStatuses,
	orthoCaseDetail,
	recordOrthoVisit,
	setOrthoStatus
} from '$lib/server/ortho';
import { clinicDate, clinicToday, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import { ORTHO_STATUS_LABEL } from '$lib/orthoPlan';
import { moveCase, newVisit, orthoStep } from '../schema';
import type { Actions, PageServerLoad } from './$types';

/** The case id from the path, or a 404 — never a query for `NaN`. */
function caseIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Case not found');
	return id;
}

/**
 * One orthodontic case: progress, the adjustment visits, and the payment plan instalment by
 * instalment with each bill. Recording a visit and moving the case on are `patients.clinical`;
 * billing what is due is `billing.invoice` — each checked in its action.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	const caseId = caseIdParam(event.params.caseId);
	const detail = await orthoCaseDetail(patient.id, caseId);
	if (!detail) error(404, 'That case is not on this patient’s record.');
	await logPatientView(patient.id, 'ortho', event, { recordId: caseId });

	const [providers, visits, visit, move, step] = await Promise.all([
		providerOptions(),
		recentVisits(patient.id),
		superValidate(
			{
				visitedOn: clinicToday(),
				nextInWeeks: '4',
				providerId: String(detail.case.providerId ?? '')
			},
			zod4(newVisit),
			{ errors: false }
		),
		superValidate(zod4(moveCase)),
		superValidate(zod4(orthoStep))
	]);
	return {
		...detail,
		next: nextStatuses(detail.case.status),
		providers: [
			{ value: '', name: 'Not recorded' },
			...providers.map((p) => ({ value: String(p.value), name: p.name }))
		],
		visits: detail.visits,
		visitOptions: [
			{ value: '', name: 'Not at a booked visit' },
			...visits.map((v) => ({
				value: String(v.id),
				name: `${formatEthiopianDate(new Date(clinicDate(v.startsAt)))} ${ethiopianClock(v.startsAt)}`
			}))
		],
		forms: { visit, move, step },
		canWrite: hasPermission(event.locals, ORTHO_PERMISSION),
		canBill: hasPermission(event.locals, ORTHO_BILLING_PERMISSION)
	};
};

export const actions: Actions = {
	visit: (event) =>
		patientAction(event, ORTHO_PERMISSION, newVisit, async (tx, { patientId, data }) => {
			await recordOrthoVisit(tx, event, patientId, caseIdParam(event.params.caseId), {
				visitedOn: data.visitedOn,
				work: data.work,
				nextInWeeks: data.nextInWeeks ? Number(data.nextInWeeks) : null,
				note: data.note || null,
				providerId: Number(data.providerId) || null,
				appointmentId: Number(data.appointmentId) || null
			});
			return 'Visit recorded.';
		}),

	move: (event) =>
		patientAction(event, ORTHO_PERMISSION, moveCase, async (tx, { patientId, data }) => {
			await setOrthoStatus(tx, event, patientId, caseIdParam(event.params.caseId), data.status);
			return `The case is now: ${ORTHO_STATUS_LABEL[data.status].toLowerCase()}.`;
		}),

	bill: (event) =>
		patientAction(event, ORTHO_BILLING_PERMISSION, orthoStep, async (tx, { patientId }) => {
			const n = await billDueInstalments(tx, event, patientId, caseIdParam(event.params.caseId));
			return `Billed ${n} instalment${n === 1 ? '' : 's'}. Take the payment on the Billing tab.`;
		})
};
