import { APPROVAL_ENTITIES, rejectedCounts } from '$lib/server/approvals';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const counts = await rejectedCounts();

	return {
		queues: APPROVAL_ENTITIES.map(({ key, label, listHref }) => ({
			key,
			label,
			listHref,
			rejected: counts[key] ?? 0
		}))
	};
};
