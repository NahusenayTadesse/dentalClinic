import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { patientAction } from '$lib/server/patientAction';
import { livePatientId, logPatientView } from '$lib/server/patients';
import { providerOptions } from '$lib/server/appointments';
import { chartableServices } from '$lib/server/procedures';
import {
	LAB_PERMISSION,
	labOptions,
	labWorkOptions,
	moveLabAction,
	openLabCase,
	patientLabCases
} from '$lib/server/labCases';
import { moveLabCase, newLabCase } from '$lib/forms/labCase';
import { whereLabel } from '$lib/teeth';
import type { Actions, PageServerLoad } from './$types';

/**
 * The patient's Lab work tab: every case sent out for them, from any branch (the chart is the
 * patient's, CLAUDE.md §15), and sending a new one.
 *
 * Reading is the chart's `patients.view`. Sending, receiving and fitting are `lab_cases.manage`,
 * checked in each action — the tab sits under `/dashboard/patients`, whose route rule is only the
 * floor (§9). The rules are `server/labCases.ts`'s; the moves are the board's, shared.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'labCase', event);

	const [cases, labs, work, providers, services, add, move] = await Promise.all([
		patientLabCases(patient.id),
		labOptions(),
		labWorkOptions(patient.id),
		providerOptions(),
		chartableServices(),
		superValidate({ send: true }, zod4(newLabCase), { errors: false }),
		superValidate(zod4(moveLabCase))
	]);

	return {
		cases,
		labs: labs.map((l) => ({
			value: String(l.value),
			name: l.turnaround ? `${l.name} · usually ${l.turnaround} days` : l.name
		})),
		work: [
			{ value: '', name: 'Not tied to charted work' },
			...work.map((w) => ({
				value: String(w.value),
				name: `${w.service ?? 'Procedure'} · ${whereLabel(w)}${w.status === 'planned' ? ' (planned)' : ''}`
			}))
		],
		providers: [
			{ value: '', name: 'Not recorded' },
			...providers.map((p) => ({ value: String(p.value), name: p.name }))
		],
		services: [
			{ value: '', name: 'Written on the docket' },
			...services.map((s) => ({ value: String(s.value), name: s.name }))
		],
		forms: { add, move },
		canManage: hasPermission(event.locals, LAB_PERMISSION)
	};
};

export const actions: Actions = {
	add: (event) =>
		patientAction(event, LAB_PERMISSION, newLabCase, async (tx, { patientId, data }) => {
			await openLabCase(tx, event, patientId, {
				labId: Number(data.labId),
				procedureId: Number(data.procedureId) || null,
				serviceId: Number(data.serviceId) || null,
				providerId: Number(data.providerId) || null,
				teeth: data.teeth || null,
				shade: data.shade || null,
				labFee: data.labFee || null,
				instructions: data.instructions || null,
				send: data.send,
				dueOn: data.dueOn || null
			});
			return data.send ? 'Sent to the lab.' : 'Docket saved. Mark it sent when it goes.';
		}),

	/** A move from the patient's own tab: the patient is the path's, and the case must be theirs. */
	move: (event) => moveLabAction(event, () => livePatientId(event))
};
