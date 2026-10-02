import { logPatientView } from '$lib/server/patients';
import { patientFiles } from '$lib/server/patientFiles';
import { clinicDate } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/**
 * The radiograph viewer: the patient's radiographs, each with the day it was made — `takenOn`, or
 * the day it was attached when nobody said. Reading them is the chart's `patients.view`, the same
 * as the Files tab, and opening the viewer is logged as a read of the files; each image it shows
 * is logged again by the file route as it is fetched.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'file', event);

	const films = (await patientFiles(patient.id))
		.filter((f) => f.kind === 'radiograph' && f.mimeType?.startsWith('image/'))
		.map((f) => ({
			id: f.id,
			storedName: f.storedName,
			projection: f.projection,
			toothId: f.toothId,
			description: f.description,
			madeOn: f.takenOn ?? clinicDate(f.createdAt)
		}))
		.sort((a, b) => (a.madeOn === b.madeOn ? b.id - a.id : a.madeOn < b.madeOn ? 1 : -1));

	const asked = Number(event.url.searchParams.get('film'));
	return { films, initial: films.some((f) => f.id === asked) ? asked : (films[0]?.id ?? null) };
};
