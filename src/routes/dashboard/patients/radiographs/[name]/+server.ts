import { error } from '@sveltejs/kit';

import { fileResponse, resolveInboxFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * One inbox image, for its preview. Gated by the inbox's own route rule (`patients.clinical`), and
 * not logged to any patient's access log: until it is filed, it is nobody's on the record.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const filePath = resolveInboxFile(params.name);
	if (!filePath) error(404, 'Not in the inbox');
	return fileResponse(filePath, request, 'none');
};
