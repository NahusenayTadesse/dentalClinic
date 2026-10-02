import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { providerOptions, recentVisits } from '$lib/server/appointments';
import { PERIO_PERMISSION, perioExams, startExam } from '$lib/server/perio';
import { patientAction } from '$lib/server/patientAction';
import { clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import { newExam } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The periodontal chart tab: every gum exam on the record, each added up and compared with the
 * one before, and starting a new one. Reading is the chart's `patients.view`; starting an exam is
 * `patients.clinical`, checked in the action (CLAUDE.md §9).
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'perio', event);

	const [exams, providers, visits, start] = await Promise.all([
		perioExams(patient.id),
		providerOptions(),
		recentVisits(patient.id),
		superValidate(zod4(newExam))
	]);

	return {
		exams,
		providers: [
			{ value: '', name: 'Not recorded' },
			...providers.map((p) => ({ value: String(p.value), name: p.name }))
		],
		visits: [
			{ value: '', name: 'Not at a visit' },
			...visits.map((v) => ({
				value: String(v.id),
				name: `${formatEthiopianDate(new Date(clinicDate(v.startsAt)))} ${ethiopianClock(v.startsAt)}${v.provider ? ` · ${v.provider}` : ''}`
			}))
		],
		forms: { start },
		canWrite: hasPermission(event.locals, PERIO_PERMISSION)
	};
};

export const actions: Actions = {
	start: (event) =>
		patientAction(event, PERIO_PERMISSION, newExam, async (tx, { patientId, data }) => {
			const id = await startExam(tx, event, patientId, {
				providerId: Number(data.providerId) || null,
				appointmentId: Number(data.appointmentId) || null
			});
			return {
				redirect: `/dashboard/patients/${patientId}/perio/${id}`,
				text: 'Exam started. The teeth already gone are marked missing.'
			};
		})
};
