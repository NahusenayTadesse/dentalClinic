import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission, requireSuperAdmin } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { recentVisits } from '$lib/server/appointments';
import { saveUploadedFile } from '$lib/server/files';
import { WriteRefused } from '$lib/server/childCrud';
import { attachFile, patientFiles, removeFile as remove } from '$lib/server/patientFiles';
import { clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import { CLINICAL_PERMISSION, clinicalAction } from '../clinicalAction';
import { attach, removeFile } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The files tab: radiographs, photographs and paper attached to the patient. Reading is the chart's
 * `patients.view` — and the same permission is what `/dashboard/files/[name]` asks before serving
 * one of these. Attaching is `patients.clinical`; removing is a super admin's, as every delete is.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'file', event);

	const [files, visits, form, removeForm] = await Promise.all([
		patientFiles(patient.id),
		recentVisits(patient.id),
		superValidate(zod4(attach)),
		superValidate(zod4(removeFile))
	]);

	return {
		files,
		visits: visits.map((v) => ({
			value: String(v.id),
			name: `${formatEthiopianDate(new Date(clinicDate(v.startsAt)))} ${ethiopianClock(v.startsAt)}`
		})),
		forms: { attach: form, remove: removeForm },
		canAttach: hasPermission(event.locals, CLINICAL_PERMISSION),
		canRemove: event.locals.isSuperAdmin === true
	};
};

export const actions: Actions = {
	attach: (event) =>
		clinicalAction(event, attach, async (tx, { patientId, data }) => {
			// Written before the row: a file cannot be rolled back, and an unreferenced file is the
			// harmless failure (`fileAudit.ts` reports it) where a row pointing at nothing is not.
			let storedName: string;
			try {
				storedName = await saveUploadedFile(data.file);
			} catch (err: unknown) {
				// `saveUploadedFile`'s refusals are written for the person uploading.
				throw new WriteRefused(
					'file',
					err instanceof Error ? err.message : 'That file could not be saved.'
				);
			}
			await attachFile(tx, event, patientId, {
				storedName,
				originalName: data.file.name,
				mimeType: data.file.type || null,
				sizeBytes: data.file.size,
				kind: data.kind,
				takenOn: data.takenOn || null,
				toothId: Number(data.toothId) || null,
				description: data.description ?? null,
				appointmentId: Number(data.appointmentId) || null
			});
			return 'File attached.';
		}),

	remove: (event) => {
		requireSuperAdmin(event.locals);
		return clinicalAction(event, removeFile, async (tx, { patientId, data }) => {
			await remove(tx, event, patientId, data.fileId);
			return 'File taken off the chart. It is kept, and the removal is on the audit trail.';
		});
	}
};
