/**
 * The rules of the dental chart that both sides need: which codes are teeth, which surfaces a tooth
 * has, how a span of teeth is written, and what state each tooth is in.
 *
 * Client-safe on purpose. The server enforces these when a procedure is saved, and the odontogram
 * draws with them; a copy on each side would be two opinions about what "tooth 55" means. The
 * `tooth` table's rows are generated from `teethInQuadrant` too, so the table, the check and the
 * picture all come from one definition.
 *
 * Teeth are FDI (ISO 3950) codes: the first digit is the quadrant, clockwise from the patient's
 * upper right (1–4 permanent, 5–8 primary), the second the position from the midline. See
 * `db/schema/teeth.ts` for why FDI rather than the American 1–32.
 *
 * Non-goals: periodontal charting (pocket depths, mobility, furcation). That is a grid of numbers
 * per tooth per visit and wants its own table, not columns bolted onto procedures.
 */

/** A permanent quadrant has eight teeth; a primary one five, because a child has no premolars. */
export function teethInQuadrant(quadrant: number): number {
	return quadrant >= 5 ? 5 : 8;
}

/** Whether `code` names a real tooth: 11–18 … 41–48, 51–55 … 81–85. */
export function isFdiTooth(code: number): boolean {
	if (!Number.isInteger(code)) return false;
	const quadrant = Math.floor(code / 10);
	const position = code % 10;
	return quadrant >= 1 && quadrant <= 8 && position >= 1 && position <= teethInQuadrant(quadrant);
}

/** Quadrant names, indexed by the code's first digit. */
const QUADRANT: Record<number, string> = {
	1: 'Upper right',
	2: 'Upper left',
	3: 'Lower left',
	4: 'Lower right',
	5: 'Upper right',
	6: 'Upper left',
	7: 'Lower left',
	8: 'Lower right'
};

const PERMANENT_POSITION = [
	'central incisor',
	'lateral incisor',
	'canine',
	'first premolar',
	'second premolar',
	'first molar',
	'second molar',
	'third molar'
];

/** A child has no premolars: positions 4 and 5 are molars in the primary dentition. */
const PRIMARY_POSITION = [
	'central incisor',
	'lateral incisor',
	'canine',
	'first molar',
	'second molar'
];

/**
 * "Lower left first molar" — what the tooth is called, for a picker and for the `tooth` table.
 * One definition for both, so the name a form offers and the name a report prints cannot differ.
 */
export function toothName(code: number): string {
	const quadrant = Math.floor(code / 10);
	const names = quadrant >= 5 ? PRIMARY_POSITION : PERMANENT_POSITION;
	return `${QUADRANT[quadrant]} ${names[(code % 10) - 1]}`;
}

/** The grouping a clinician thinks in — "the molars", "the anteriors". */
export function toothType(code: number): 'incisor' | 'canine' | 'premolar' | 'molar' {
	const name = toothName(code);
	if (name.includes('incisor')) return 'incisor';
	if (name.includes('canine')) return 'canine';
	if (name.includes('premolar')) return 'premolar';
	return 'molar';
}

/**
 * Incisors and canines: positions 1–3 in either dentition. They have an incisal edge and no
 * occlusal surface; molars and premolars the reverse.
 */
export function isAnterior(code: number): boolean {
	return code % 10 <= 3;
}

/**
 * The surface letters, in the order they are written. Mesial, occlusal or incisal, distal, then
 * buccal and lingual — so a three-surface filling reads "MOD" on a molar and "MID" on an incisor,
 * the way a dentist writes it on paper.
 */
export const SURFACE_ORDER = ['M', 'O', 'I', 'D', 'B', 'L'] as const;

/** One surface letter. */
export type Surface = (typeof SURFACE_ORDER)[number];

/** What each letter stands for, for a tooltip or a legend. */
export const SURFACE_NAMES: Record<Surface, string> = {
	M: 'Mesial',
	O: 'Occlusal',
	I: 'Incisal',
	D: 'Distal',
	B: 'Buccal / labial',
	L: 'Lingual / palatal'
};

/** The surfaces a given tooth actually has: an incisor has no occlusal face, a molar no incisal edge. */
export function surfacesOf(code: number): Surface[] {
	return SURFACE_ORDER.filter((s) => (isAnterior(code) ? s !== 'O' : s !== 'I'));
}

/**
 * Surfaces as written, checked against the tooth and put in the order a dentist writes them.
 *
 * Returns an error message instead when the letters cannot be right: a letter that is not a surface,
 * or one this tooth does not have. "O" on an incisor is the mistake that actually happens, a
 * molar's habit carried across, and it would count an incisal restoration as an occlusal one in
 * every report after.
 */
export function normaliseSurfaces(
	raw: string,
	tooth: number
): { surfaces: string } | { error: string } {
	const letters = [...new Set(raw.toUpperCase().replace(/[^A-Z]/g, ''))];
	if (letters.length === 0) return { error: 'Choose at least one surface.' };

	const allowed = surfacesOf(tooth);
	const unknown = letters.filter((l) => !(SURFACE_ORDER as readonly string[]).includes(l));
	if (unknown.length) return { error: `${unknown.join(', ')} is not a tooth surface.` };

	const wrong = letters.filter((l) => !(allowed as string[]).includes(l));
	if (wrong.length) {
		const kind = isAnterior(tooth) ? 'a front tooth, which has an incisal edge' : 'a back tooth';
		return { error: `Tooth ${tooth} is ${kind}; it has no ${wrong.join(', ')} surface.` };
	}

	return { surfaces: SURFACE_ORDER.filter((s) => letters.includes(s)).join('') };
}

/**
 * A span of teeth — a bridge, a partial denture — as written, parsed into FDI codes.
 *
 * Accepts commas, spaces or both ("14, 15 16"), and a dash between two teeth of one quadrant
 * ("14-16") because that is how a bridge is written. The result is stored as a comma list in chart
 * order, so the same work entered two ways is stored one way.
 */
export function parseToothRange(raw: string): { teeth: number[] } | { error: string } {
	const teeth = new Set<number>();

	for (const part of raw.split(/[,\s]+/).filter(Boolean)) {
		const span = part.match(/^(\d{2})-(\d{2})$/);
		if (span) {
			const [from, to] = [Number(span[1]), Number(span[2])];
			if (!isFdiTooth(from) || !isFdiTooth(to)) return { error: `${part} is not a span of teeth.` };
			if (Math.floor(from / 10) !== Math.floor(to / 10)) {
				return { error: `${part} crosses quadrants; list the teeth instead.` };
			}
			for (let t = Math.min(from, to); t <= Math.max(from, to); t++) teeth.add(t);
			continue;
		}

		const tooth = Number(part);
		if (!/^\d{2}$/.test(part) || !isFdiTooth(tooth)) return { error: `${part} is not a tooth.` };
		teeth.add(tooth);
	}

	if (teeth.size < 2) return { error: 'A span needs at least two teeth.' };
	return { teeth: [...teeth].sort((a, b) => chartIndex(a) - chartIndex(b)) };
}

/**
 * Where a tooth sits reading the chart left to right, top row then bottom, as the dentist faces
 * the patient: 18 … 11, 21 … 28, then 48 … 41, 31 … 38. Primary teeth sort within the same rows.
 */
function chartIndex(code: number): number {
	const quadrant = Math.floor(code / 10);
	const position = code % 10;
	const q = quadrant > 4 ? quadrant - 4 : quadrant;
	const upper = q === 1 || q === 2;
	const leftHalf = q === 1 || q === 4;
	const offset = leftHalf ? 10 - position : 10 + position;
	return (upper ? 0 : 100) + offset;
}

/** The rows of the odontogram, each a left half and a right half as the dentist faces the patient. */
export const CHART_ROWS = {
	permanent: {
		upper: [
			[18, 17, 16, 15, 14, 13, 12, 11],
			[21, 22, 23, 24, 25, 26, 27, 28]
		],
		lower: [
			[48, 47, 46, 45, 44, 43, 42, 41],
			[31, 32, 33, 34, 35, 36, 37, 38]
		]
	},
	primary: {
		upper: [
			[55, 54, 53, 52, 51],
			[61, 62, 63, 64, 65]
		],
		lower: [
			[85, 84, 83, 82, 81],
			[71, 72, 73, 74, 75]
		]
	}
} as const;

/** Which teeth to draw. `mixed` is both rows, for the years a child has some of each. */
export type Dentition = 'permanent' | 'primary' | 'mixed';

/**
 * The chart a patient's age suggests: primary under six, mixed until twelve, permanent after.
 *
 * Only the starting view — eruption varies by years between children, and the dentist can switch.
 * An unknown age starts on the adult chart, which is the right guess for most of a clinic's
 * patients.
 */
export function dentitionForAge(age: number | null): Dentition {
	if (age === null) return 'permanent';
	if (age < 6) return 'primary';
	if (age < 12) return 'mixed';
	return 'permanent';
}

/** The fields of a charted procedure the odontogram reads. */
export type ChartedProcedure = {
	status: string;
	toothId: number | null;
	surfaces: string | null;
	toothRange: string | null;
	removesTooth: boolean;
};

/**
 * What the chart draws on one tooth.
 *
 * `missing` — extracted here, or recorded as already gone
 * `condition` — a finding not yet treated: the thing to look at first
 * `planned` — work proposed and not done
 * `done` — treated here, or arrived treated (`existing`)
 *
 * Surfaces are gathered per state, so a molar with an old "O" filling and planned "MD" work shows
 * both.
 */
export type ToothState = {
	missing: boolean;
	condition: boolean;
	planned: boolean;
	done: boolean;
	surfaces: { condition: string; planned: string; done: string };
};

const EMPTY: ToothState = {
	missing: false,
	condition: false,
	planned: false,
	done: false,
	surfaces: { condition: '', planned: '', done: '' }
};

/** The teeth one procedure touches: its tooth, or every tooth in its span. */
function teethOf(p: ChartedProcedure): number[] {
	if (p.toothRange) {
		const parsed = parseToothRange(p.toothRange);
		if ('teeth' in parsed) return parsed.teeth;
	}
	return p.toothId === null ? [] : [p.toothId];
}

/** Merges surface letters into canonical order without repeats. */
function mergeSurfaces(a: string, b: string | null): string {
	return SURFACE_ORDER.filter((s) => a.includes(s) || (b ?? '').includes(s)).join('');
}

/**
 * Every charted tooth's state, from the patient's procedures.
 *
 * Cancelled and referred work is left off: neither is anything in the mouth. A tooth extracted
 * here is missing whatever else was charted on it before, because the older rows describe a tooth
 * that is no longer there.
 */
export function toothStates(procedures: ChartedProcedure[]): Map<number, ToothState> {
	const states = new Map<number, ToothState>();

	for (const p of procedures) {
		const kind =
			p.status === 'condition'
				? 'condition'
				: p.status === 'planned'
					? 'planned'
					: p.status === 'completed' || p.status === 'existing'
						? 'done'
						: null;
		if (!kind) continue;

		for (const tooth of teethOf(p)) {
			const state = states.get(tooth) ?? structuredClone(EMPTY);
			if (kind === 'done' && p.removesTooth) state.missing = true;
			state[kind] = true;
			state.surfaces[kind] = mergeSurfaces(state.surfaces[kind], p.surfaces);
			states.set(tooth, state);
		}
	}

	return states;
}

/**
 * Where a procedure is, as the chart and a quote both write it: its span, its tooth and surfaces,
 * or the whole mouth. Moved here from the chart's columns when treatment plans became its second
 * user.
 */
export function whereLabel(row: {
	toothId: number | null;
	surfaces: string | null;
	toothRange: string | null;
}): string {
	if (row.toothRange) return row.toothRange.replaceAll(',', ', ');
	if (row.toothId === null) return 'Whole mouth';
	return row.surfaces ? `${row.toothId} ${row.surfaces}` : String(row.toothId);
}
