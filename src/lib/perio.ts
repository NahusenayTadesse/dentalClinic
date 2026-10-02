/**
 * The periodontal chart's rules: which sites a tooth is measured at, in what order the chart walks
 * them, what a reading may hold, and what an exam adds up to. Client-safe, so the grid and the
 * server agree on every one of them (`server/perio.ts` stores what this describes).
 *
 * **Six sites a tooth.** Distobuccal, buccal, mesiobuccal on the cheek side; distolingual, lingual,
 * mesiolingual on the tongue (palatal, on the upper arch). That is the full-mouth charting a
 * periodontist does and an inspector recognises; the six-point simplification some clinics use
 * (one reading per sextant) cannot be compared site by site across visits, which is the point.
 *
 * **Attachment, not depth, is what is lost.** A pocket can get shallower because the gum shrank
 * back while the tooth lost support. Clinical attachment level is depth plus recession — the gum
 * margin's distance below the enamel junction — and a change of 2 mm or more between visits is
 * the conventional threshold for "this got worse", past what a probe's own error explains. A
 * recession left blank counts as none: assistants record it where there is some.
 *
 * Non-goals: staging and grading (the 2017 classification needs radiographic bone loss and the
 * patient's history, which is the periodontist's judgement, not arithmetic), implants as their own
 * kind of site, and the primary dentition — a child's gums are screened, not charted like this.
 */
import { CHART_ROWS, toothType } from './teeth';

/** The six sites, cheek side then tongue side, each distal to mesial. */
export const PERIO_SITES = ['DB', 'B', 'MB', 'DL', 'L', 'ML'] as const;
export type PerioSite = (typeof PERIO_SITES)[number];

/** Which side of the tooth a site is on. */
export type PerioFace = 'buccal' | 'lingual';

/** A site's full name, for a label or a screen reader. */
export const PERIO_SITE_NAMES: Record<PerioSite, string> = {
	DB: 'distobuccal',
	B: 'buccal',
	MB: 'mesiobuccal',
	DL: 'distolingual',
	L: 'lingual',
	ML: 'mesiolingual'
};

/** The limits a reading must sit inside — a probe is marked to 15 mm. */
export const PERIO_LIMITS = {
	depth: { min: 0, max: 15 },
	/** Negative is a margin above the enamel junction: swollen or overgrown gum. */
	recession: { min: -5, max: 15 },
	mobility: { min: 0, max: 3 },
	furcation: { min: 0, max: 3 }
} as const;

/** The difference between two visits that counts as worse, in millimetres of attachment. */
export const WORSE_BY = 2;

/** A pocket this deep or deeper needs attention; the deeper threshold needs a periodontist. */
export const DEEP = 4;
export const VERY_DEEP = 6;

/** One site's readings. */
export type SiteReading = {
	depth: number | null;
	recession: number | null;
	bleeding: boolean;
	plaque: boolean;
};

/** One tooth's readings. */
export type ToothReading = {
	tooth: number;
	missing: boolean;
	mobility: number | null;
	/** Only on teeth with more than one root — `hasFurcation`. */
	furcation: number | null;
	sites: Record<PerioSite, SiteReading>;
};

/** The permanent teeth, in the order the chart draws them: upper right to upper left, then lower. */
export const PERIO_TEETH: number[] = [
	...CHART_ROWS.permanent.upper[0],
	...CHART_ROWS.permanent.upper[1],
	...CHART_ROWS.permanent.lower[0],
	...CHART_ROWS.permanent.lower[1]
];

/** Whether a tooth is on the upper arch. */
export function isUpper(tooth: number): boolean {
	const quadrant = Math.floor(tooth / 10);
	return quadrant === 1 || quadrant === 2;
}

/**
 * Whether a tooth has a furcation to grade: the molars, and the upper first premolars, which have
 * two roots often enough that a chart leaves room for one.
 */
export function hasFurcation(tooth: number): boolean {
	return toothType(tooth) === 'molar' || tooth === 14 || tooth === 24;
}

/**
 * A face's three sites in the order they sit on screen. The patient's right is drawn on the
 * viewer's left, so on those teeth the distal site is leftmost; on the other half, the mesial.
 */
export function sitesOnScreen(tooth: number, face: PerioFace): PerioSite[] {
	const quadrant = Math.floor(tooth / 10);
	const distalFirst = quadrant === 1 || quadrant === 4;
	const sites: PerioSite[] = face === 'buccal' ? ['DB', 'B', 'MB'] : ['DL', 'L', 'ML'];
	return distalFirst ? sites : [...sites].reverse();
}

/** A site with nothing recorded. */
export function emptySite(): SiteReading {
	return { depth: null, recession: null, bleeding: false, plaque: false };
}

/** A tooth with nothing recorded. */
export function emptyTooth(tooth: number, missing = false): ToothReading {
	return {
		tooth,
		missing,
		mobility: null,
		furcation: null,
		sites: {
			DB: emptySite(),
			B: emptySite(),
			MB: emptySite(),
			DL: emptySite(),
			L: emptySite(),
			ML: emptySite()
		}
	};
}

/** The clinical attachment level at a site: depth plus recession, or null with no depth. */
export function attachmentLevel(site: SiteReading): number | null {
	return site.depth === null ? null : site.depth + (site.recession ?? 0);
}

/** What one exam adds up to. Percentages are of the sites on teeth that are present. */
export type PerioSummary = {
	teethPresent: number;
	sitesMeasured: number;
	meanDepth: number | null;
	/** Sites at `DEEP` mm or more, and at `VERY_DEEP` or more. */
	deep: number;
	veryDeep: number;
	bleedingPercent: number | null;
	plaquePercent: number | null;
	/** The worst attachment level anywhere in the mouth. */
	worstAttachment: number | null;
};

const percent = (part: number, whole: number) =>
	whole === 0 ? null : Math.round((part / whole) * 100);

/** Adds an exam up. A missing tooth's sites are not sites. */
export function perioSummary(teeth: ToothReading[]): PerioSummary {
	const present = teeth.filter((t) => !t.missing);
	const sites = present.flatMap((t) => PERIO_SITES.map((s) => t.sites[s]));
	const depths = sites.flatMap((s) => (s.depth === null ? [] : [s.depth]));
	const attachments = sites.flatMap((s) => {
		const level = attachmentLevel(s);
		return level === null ? [] : [level];
	});
	return {
		teethPresent: present.length,
		sitesMeasured: depths.length,
		meanDepth: depths.length
			? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
			: null,
		deep: depths.filter((d) => d >= DEEP).length,
		veryDeep: depths.filter((d) => d >= VERY_DEEP).length,
		bleedingPercent: percent(sites.filter((s) => s.bleeding).length, sites.length),
		plaquePercent: percent(sites.filter((s) => s.plaque).length, sites.length),
		worstAttachment: attachments.length ? Math.max(...attachments) : null
	};
}

/** A site's key, for a lookup across exams. */
export const siteKey = (tooth: number, site: PerioSite) => `${tooth}${site}`;

/**
 * How each site's attachment moved since an earlier exam: positive is worse. Only sites measured
 * both times, on a tooth present both times, are compared — a tooth lost in between is a loss the
 * chart shows as missing, not as a deeper pocket.
 */
export function attachmentChanges(
	earlier: ToothReading[],
	later: ToothReading[]
): Map<string, number> {
	const before = new Map(earlier.filter((t) => !t.missing).map((t) => [t.tooth, t]));
	const changes = new Map<string, number>();
	for (const tooth of later) {
		const then = before.get(tooth.tooth);
		if (!then || tooth.missing) continue;
		for (const site of PERIO_SITES) {
			const a = attachmentLevel(then.sites[site]);
			const b = attachmentLevel(tooth.sites[site]);
			if (a !== null && b !== null) changes.set(siteKey(tooth.tooth, site), b - a);
		}
	}
	return changes;
}

/** The sites that got worse by `WORSE_BY` or more, and those that got better by as much. */
export function changeCounts(changes: Map<string, number>): { worse: number; better: number } {
	let worse = 0;
	let better = 0;
	for (const change of changes.values()) {
		if (change >= WORSE_BY) worse++;
		else if (change <= -WORSE_BY) better++;
	}
	return { worse, better };
}

/**
 * What is wrong with an exam's readings, or null. The form's limits stop most of these; the server
 * asks again, because a posted chart is whatever the poster sent.
 */
export function perioProblem(teeth: ToothReading[]): string | null {
	const seen = new Set<number>();
	const inRange = (n: number | null, limits: { min: number; max: number }) =>
		n === null || (Number.isInteger(n) && n >= limits.min && n <= limits.max);

	for (const t of teeth) {
		if (!PERIO_TEETH.includes(t.tooth)) return `${t.tooth} is not an adult tooth.`;
		if (seen.has(t.tooth)) return `Tooth ${t.tooth} is charted twice.`;
		seen.add(t.tooth);
		if (!inRange(t.mobility, PERIO_LIMITS.mobility))
			return `Mobility on ${t.tooth} is graded 0 to 3.`;
		if (!inRange(t.furcation, PERIO_LIMITS.furcation))
			return `Furcation on ${t.tooth} is graded 0 to 3.`;
		if (t.furcation !== null && !hasFurcation(t.tooth))
			return `Tooth ${t.tooth} has one root, so no furcation.`;
		for (const site of PERIO_SITES) {
			const s = t.sites[site];
			if (!inRange(s.depth, PERIO_LIMITS.depth))
				return `The pocket at ${t.tooth} ${site} must be 0 to 15 mm.`;
			if (!inRange(s.recession, PERIO_LIMITS.recession))
				return `The recession at ${t.tooth} ${site} must be −5 to 15 mm.`;
		}
	}
	return null;
}
