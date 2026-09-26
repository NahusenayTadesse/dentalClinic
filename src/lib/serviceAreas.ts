/**
 * Where on the patient a service is charted, and what the charting form asks for as a result.
 *
 * Lives here rather than beside the `services` table because both sides need it: the schema's
 * enum, and the browser deciding whether to show a tooth picker or surface boxes. Anything under
 * `$lib/server` cannot be bundled for the client, so the list is spelled once, here, and the table
 * imports it.
 *
 * `mouth`   — no tooth: an examination, a scale and polish, an OPG
 * `tooth`   — one tooth, no surfaces: an extraction, a root canal, a crown
 * `surface` — one tooth and the faces worked on: a filling. "MOD" is three surfaces
 * `range`   — several teeth as one piece of work: a bridge, a partial denture, quadrant scaling
 */
export const SERVICE_AREAS = ['mouth', 'tooth', 'surface', 'range'] as const;

/** One of `SERVICE_AREAS`. */
export type ServiceArea = (typeof SERVICE_AREAS)[number];

/** How each area reads in a picker and a table. */
export const SERVICE_AREA_LABELS: Record<ServiceArea, string> = {
	mouth: 'Whole mouth',
	tooth: 'One tooth',
	surface: 'Tooth surfaces',
	range: 'Several teeth'
};
