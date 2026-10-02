import { error, redirect } from '@sveltejs/kit';

import { fileResponse, resolveStoredFile } from '$lib/server/files';
import { fileOwner } from '$lib/server/patientFiles';
import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import type { RequestHandler } from './$types';

/**
 * Serves one stored file.
 *
 * **What guards this.** A patient's file — a radiograph, a photograph, a scanned consent — is
 * recorded in `patient_file` with the patient it belongs to, so opening one needs `patients.view`,
 * the permission that opens the chart it hangs on, and is logged in that patient's access log.
 * Repeat fetches are folded together there (`logPatientView`), so a gallery of thumbnails is not
 * a flood.
 *
 * **Every other file** — an employee's identity document, a receipt — still has only the check
 * that the caller is signed in, and the 122-bit random name from `generateFileName` standing in
 * for a permission. Adequate against guessing, not against a leaked URL; those files get the same
 * treatment when their own tables record what owns them.
 */
export const GET: RequestHandler = async (event) => {
	const { params, locals } = event;
	if (!locals.user) throw redirect(302, '/login');

	// Rejects a name that resolves outside the store rather than resolving it and hoping.
	const filePath = resolveStoredFile(params.name);
	if (!filePath) throw error(404, 'Not found');

	const owner = await fileOwner(params.name);
	if (owner) {
		if (!hasPermission(locals, 'patients.view')) throw error(403, 'Not permitted');
		await logPatientView(owner.patientId, 'file', event, { recordId: owner.id });
	}

	return fileResponse(filePath, event.request);
};
