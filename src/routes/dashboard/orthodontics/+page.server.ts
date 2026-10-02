import { orthoBoard } from '$lib/server/ortho';
import type { PageServerLoad } from './$types';

/**
 * The orthodontic board for the branch being worked at: every case still being seen, who is due
 * back, and whose instalments are due to bill or overdue. Gated by `patients.view` — it names
 * patients — and read only: billing is on each case, by someone with `billing.invoice`.
 */
export const load: PageServerLoad = async ({ locals }) => ({
	cases: await orthoBoard(locals.branch)
});
