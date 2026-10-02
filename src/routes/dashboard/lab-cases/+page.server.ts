import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { labBoard, labCaseOwner, labPerformance, moveLabAction } from '$lib/server/labCases';
import { moveLabCase } from '$lib/forms/labCase';
import type { Actions, PageServerLoad } from './$types';

/**
 * The lab board: every case at this branch that is not finished — a docket still being prepared,
 * work out at a laboratory (overdue first to the eye, soonest due first in order), and work back
 * and waiting to be fitted — and how each laboratory has kept its promises over the past year.
 *
 * Gated by `lab_cases.manage` (`routeRules`); the move action checks it again, and finds the
 * patient from the case only if the case is at a branch the viewer may see (§15).
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [cases, performance, move] = await Promise.all([
		labBoard(locals.branch),
		labPerformance(locals.branch),
		superValidate(zod4(moveLabCase))
	]);
	return {
		cases,
		performance,
		summary: {
			preparing: cases.filter((c) => c.status === 'draft').length,
			out: cases.filter((c) => c.status === 'sent' || c.status === 'remake').length,
			overdue: cases.filter((c) => c.overdue).length,
			ready: cases.filter((c) => c.status === 'received').length
		},
		move
	};
};

export const actions: Actions = {
	move: (event) =>
		moveLabAction(event, async (caseId) => {
			const patientId = await labCaseOwner(caseId, event.locals.branch);
			if (patientId === null) error(404, 'That lab case is not at this branch.');
			return patientId;
		})
};
