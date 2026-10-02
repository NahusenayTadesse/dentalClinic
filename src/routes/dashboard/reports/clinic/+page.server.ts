import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { clinicStats, loadClinicSection } from '../clinic.server';

/** The clinic report: the shared report shape, read at the branch the viewer is working at (§15). */
export const load: PageServerLoad = ({ url, locals }) =>
	loadReport(
		url,
		'Clinic',
		(filters) => clinicStats(filters, locals.branch),
		(filters) => loadClinicSection(filters, locals.branch)
	);
