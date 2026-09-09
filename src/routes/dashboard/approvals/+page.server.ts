import { APPROVAL_ENTITIES, pendingCounts } from '$lib/server/approvals';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const counts = await pendingCounts();

	return {
		queues: APPROVAL_ENTITIES.map(({ key, label, listHref }) => ({
			key,
			label,
			listHref,
			pending: counts[key] ?? 0
		}))
	};
};
