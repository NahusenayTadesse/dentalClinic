import { error } from '@sveltejs/kit';

import { requirePermission } from '$lib/server/permissions';
import { livePatientId, logPatientView } from '$lib/server/patients';
import { fullRecord } from '$lib/server/patientRecord';
import { clinicToday } from '$lib/clinicTime';
import type { RequestHandler } from './$types';

/**
 * The patient's whole record as a file they can take to another clinic — the same content as the
 * printout, as JSON. Logged as the whole record exported.
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event.locals, 'patients.export');
	const patientId = await livePatientId(event);
	const record = await fullRecord(patientId);
	if (!record) error(404, 'Patient not found');
	await logPatientView(patientId, 'fullRecord', event, { action: 'export' });
	const name = `record-${record.person.fileNo ?? patientId}-${clinicToday()}.json`;
	return new Response(JSON.stringify({ exportedOn: clinicToday(), ...record }, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${name}"`,
			'Cache-Control': 'private, no-store'
		}
	});
};
