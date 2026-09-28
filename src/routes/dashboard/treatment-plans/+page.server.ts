import { acceptanceSince, awaitingAnswer } from '$lib/server/treatmentPlans';
import { addClinicDays, clinicToday } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/** The window case acceptance is measured over. A quarter evens out a slow week. */
const ACCEPTANCE_DAYS = 90;

/**
 * The follow-up list: every quote still awaiting an answer, the longest-waiting first, and how the
 * last quarter's quotes were answered.
 *
 * A presented plan is work the clinic could do and money it has not been told it cannot have; a
 * list is what stops it depending on somebody remembering to ring. Scoped to the branch being
 * worked at. Gated by `treatment_plans.manage` (`routeRules`).
 */
export const load: PageServerLoad = async ({ locals }) => {
	const since = addClinicDays(clinicToday(), -ACCEPTANCE_DAYS);
	const [waiting, acceptance] = await Promise.all([
		awaitingAnswer(locals.branch),
		acceptanceSince(since, locals.branch)
	]);
	return { waiting, acceptance, acceptanceDays: ACCEPTANCE_DAYS };
};
