/**
 * Radiographs: the kinds of film a clinic takes, and which earlier film a new one is read against.
 * Client-safe — the Files tab, the viewer and the inbox all name projections from here, and
 * `server/patientFiles.ts` checks a posted one against the same list.
 *
 * A radiograph is read against the last one of the same thing. Bone loss, a widening periapical
 * shadow, caries creeping under a filling — all are changes, invisible on one film and plain on
 * two side by side. So the viewer opens with the film chosen and, beside it, the newest earlier
 * film of the same projection and tooth (or of the same projection, for a panoramic, which is the
 * whole mouth).
 *
 * Non-goals: measuring on the image (calibration differs per sensor, and a length read off an
 * uncalibrated pixel grid is a number that looks like a fact), and DICOM — browsers cannot draw
 * it, and every sensor's own software exports JPEG or PNG.
 */

/** The projections, as the schema lists them. */
export const PROJECTIONS = [
	'periapical',
	'bitewing',
	'panoramic',
	'occlusal',
	'cephalometric',
	'cbct'
] as const;
export type Projection = (typeof PROJECTIONS)[number];

/** How a dentist names each. */
export const PROJECTION_LABEL: Record<Projection, string> = {
	periapical: 'Periapical',
	bitewing: 'Bitewing',
	panoramic: 'Panoramic (OPG)',
	occlusal: 'Occlusal',
	cephalometric: 'Cephalometric',
	cbct: 'CBCT slice'
};

/** Whether a value is one of the projections — for a posted form. */
export function isProjection(value: unknown): value is Projection {
	return typeof value === 'string' && (PROJECTIONS as readonly string[]).includes(value);
}

/** The projections that show the whole mouth, so a tooth does not narrow the comparison. */
const WHOLE_MOUTH: readonly Projection[] = ['panoramic', 'cephalometric'];

/** What a film needs to be compared: when it was made, of what, and where. */
export type Film = {
	id: number;
	projection: Projection | null;
	toothId: number | null;
	/** `takenOn` if recorded, else when it was attached — ISO `YYYY-MM-DD…`. */
	madeOn: string;
};

/**
 * The film to read `film` against: the newest one made before it, of the same projection and —
 * unless the projection shows the whole mouth — the same tooth. A film with no projection
 * recorded matches on tooth alone. Null when there is none.
 */
export function compareCandidate<F extends Film>(film: F, films: F[]): F | null {
	const sameView = (other: F) => {
		if (other.id === film.id || other.madeOn > film.madeOn) return false;
		if (other.madeOn === film.madeOn && other.id > film.id) return false;
		if (film.projection && other.projection !== film.projection) return false;
		if (film.projection && WHOLE_MOUTH.includes(film.projection)) return true;
		return film.toothId === null || other.toothId === film.toothId;
	};
	return (
		films
			.filter(sameView)
			.sort((a, b) => (a.madeOn === b.madeOn ? b.id - a.id : a.madeOn < b.madeOn ? 1 : -1))[0] ??
		null
	);
}
