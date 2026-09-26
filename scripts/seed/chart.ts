/**
 * Where on the mouth a seeded procedure goes, decided by what its service is charted on.
 *
 * The first clinical seed wrote every procedure with no tooth at all, so every chart was an empty
 * mouth with a bill beside it. A filling needs a tooth and surfaces that tooth has, an extraction
 * a tooth, a bridge a span; this places each one the way `$lib/teeth.ts` says a clinician would
 * have to, so seeded rows pass the same rules the chart enforces on real ones.
 */
import { CHART_ROWS, surfacesOf, type Dentition } from '../../src/lib/teeth';
import type { ServiceArea } from '../../src/lib/serviceAreas';
import type { randomness } from './util';

type Random = ReturnType<typeof randomness>;

/** Every permanent tooth. */
const PERMANENT: number[] = [
	...CHART_ROWS.permanent.upper.flat(),
	...CHART_ROWS.permanent.lower.flat()
];
const PRIMARY: number[] = [...CHART_ROWS.primary.upper.flat(), ...CHART_ROWS.primary.lower.flat()];

/** Premolars and the first two molars, where most decay and most fillings are. */
const isBack = (t: number) => (t > 50 ? t % 10 >= 4 : t % 10 >= 4 && t % 10 <= 7);

/**
 * The teeth a patient of this dentition has, and the back ones among them.
 *
 * The first seed charted every patient on the adult set, so a seven-year-old had a denture on 27
 * and a wisdom tooth taken out. A child has baby teeth; between six and twelve, baby molars beside
 * the adult incisors and first molars that came in first — which is the whole reason the chart has
 * a mixed view.
 */
export function mouthFor(dentition: Dentition): { teeth: number[]; back: number[] } {
	const teeth =
		dentition === 'primary'
			? PRIMARY
			: dentition === 'mixed'
				? [
						...PRIMARY.filter((t) => t % 10 >= 3),
						...PERMANENT.filter((t) => t % 10 <= 2 || t % 10 === 6)
					]
				: PERMANENT;
	return { teeth, back: teeth.filter(isBack) };
}

/** A patient's mouth, as `mouthFor` describes it. */
export type Mouth = ReturnType<typeof mouthFor>;

/** The placement columns of a procedure row. */
export type Placement = {
	toothId: number | null;
	surfaces: string | null;
	toothRange: string | null;
};

/**
 * One or more surfaces the tooth has, in the order a dentist writes them — "O", "MO", "MOD".
 * Weighted towards the occlusal surface, as decay is.
 */
function surfacesFor(tooth: number, { pick, chance }: Random): string {
	const available = surfacesOf(tooth);
	const first = available.includes('O') && chance(0.6) ? 'O' : pick(available);
	const chosen = new Set([first]);
	while (chance(0.35) && chosen.size < available.length) chosen.add(pick(available));
	return available.filter((s) => chosen.has(s)).join('');
}

/**
 * A three-tooth span in one quadrant, as a bridge replacing the middle tooth is written.
 * Positions 3–7 so the span never runs off the end of the arch.
 */
function spanFor({ pick, between }: Random): string {
	const quadrant = pick([1, 2, 3, 4]);
	const start = between(3, 5);
	return [0, 1, 2].map((i) => quadrant * 10 + start + i).join(',');
}

/**
 * Where a procedure of this area goes, in this mouth. `tooth` fixes the tooth when the caller
 * already knows it — the filling planned for a decay found on 36 goes on 36.
 */
export function placeFor(
	area: ServiceArea,
	random: Random,
	mouth: Mouth,
	tooth?: number
): Placement {
	switch (area) {
		case 'mouth':
			return { toothId: null, surfaces: null, toothRange: null };
		case 'tooth':
			return { toothId: tooth ?? random.pick(mouth.teeth), surfaces: null, toothRange: null };
		case 'surface': {
			const t = tooth ?? random.pick(mouth.back);
			return { toothId: t, surfaces: surfacesFor(t, random), toothRange: null };
		}
		case 'range': {
			const span = spanFor(random);
			return { toothId: Number(span.split(',')[0]), surfaces: null, toothRange: span };
		}
	}
}

/** A back tooth in this mouth, for a finding the caller wants to plan treatment on. */
export function backTooth({ pick }: Random, mouth: Mouth): number {
	return pick(mouth.back);
}
