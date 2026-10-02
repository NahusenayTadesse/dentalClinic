/**
 * Sterilisation: what a cycle's indicators mean, and whether an instrument pack from it may be
 * used. Client-safe — the log, the cycle page and the server's checks all read these, so the
 * screen never offers a pack the server would refuse.
 *
 * **Why packs, not just cycles.** An autoclave log alone answers "did the machine work". The
 * question an inspector — or a patient — asks after a failed spore test is the other one: *who was
 * treated with instruments from that load?* Each pack carries a code from its cycle, and the code
 * is recorded against the patient it was opened for. A failed cycle then names its patients.
 *
 * **Indicators.** A chemical indicator (the strip that changes colour) is read when the load comes
 * out, and decides whether its packs are released. A biological indicator (a spore test) is read a
 * day or two later, usually on one load a week; until then the cycle is pending but its packs may
 * be used — waiting two days for every load is not how a clinic runs, and is not what the
 * guidance asks. If the spores grow, the cycle fails after the fact: its unused packs are
 * withdrawn and its used ones are a list of patients to call.
 *
 * Non-goals: tracking single instruments (a pack is the unit a clinic here wraps and opens), and
 * reading the autoclave's own printout or data port — each machine's is its own.
 */

/** What a cycle is for: a load of instruments, or one of the machine's own daily tests. */
export const CYCLE_KINDS = ['load', 'bowieDick', 'vacuumTest'] as const;
export type CycleKind = (typeof CYCLE_KINDS)[number];

export const CYCLE_KIND_LABEL: Record<CycleKind, string> = {
	load: 'Instrument load',
	bowieDick: 'Bowie–Dick test',
	vacuumTest: 'Vacuum leak test'
};

/** An indicator's reading. `none` was not used; `pending` is a spore test not yet read. */
export const INDICATOR_RESULTS = ['pass', 'fail', 'pending', 'none'] as const;
export type IndicatorResult = (typeof INDICATOR_RESULTS)[number];

export type CycleStatus = 'passed' | 'failed' | 'pending';

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
	passed: 'Passed',
	failed: 'Failed',
	pending: 'Spore test pending'
};

/**
 * A cycle's outcome from its readings: failed if anything failed, pending while a spore test is
 * out, otherwise passed. A test cycle that failed means the machine must not be used until fixed.
 */
export function cycleStatus(chemical: IndicatorResult, biological: IndicatorResult): CycleStatus {
	if (chemical === 'fail' || biological === 'fail') return 'failed';
	if (biological === 'pending') return 'pending';
	return 'passed';
}

/** How long a wrapped pack stays sterile, unless the clinic says otherwise. */
export const DEFAULT_SHELF_DAYS = 30;

export type PackState = 'ready' | 'used' | 'expired' | 'withdrawn';

export const PACK_STATE_LABEL: Record<PackState, string> = {
	ready: 'Ready',
	used: 'Used',
	expired: 'Expired — resterilise',
	withdrawn: 'Withdrawn — cycle failed'
};

/**
 * Whether a pack can be opened for a patient. Used once only; never from a failed cycle; never past
 * its date — `today` and `expiresOn` are both clinic days, `YYYY-MM-DD`.
 */
export function packState(
	pack: { usedAt: unknown; expiresOn: string },
	status: CycleStatus,
	today: string
): PackState {
	if (pack.usedAt) return 'used';
	if (status === 'failed') return 'withdrawn';
	if (pack.expiresOn < today) return 'expired';
	return 'ready';
}

/** A pack's code: steriliser, cycle and pack, so the label alone says where to look. `2-0118-03`. */
export function packCode(steriliserId: number, cycleNo: number, n: number): string {
	return `${steriliserId}-${String(cycleNo).padStart(4, '0')}-${String(n).padStart(2, '0')}`;
}

/** Codes typed or scanned at the chair: one per line or separated by commas or spaces. */
export function parsePackCodes(raw: string): string[] {
	return [
		...new Set(
			raw
				.split(/[\s,;]+/)
				.map((c) => c.trim())
				.filter(Boolean)
		)
	];
}

/**
 * What a load held, as the nurse writes it: one kind of pack a line, the number first —
 * `6 exam kit`, `2 x extraction set`. A line with no number is one pack. An error names the line.
 */
export function parseLoad(
	raw: string
): { packs: { contents: string; count: number }[] } | { error: string } {
	const packs: { contents: string; count: number }[] = [];
	for (const line of raw.split('\n').map((l) => l.trim())) {
		if (!line) continue;
		const match = /^(\d+)\s*[x×*]?\s*(.*)$/i.exec(line);
		const count = match ? Number(match[1]) : 1;
		const contents = (match ? match[2] : line).trim();
		if (count < 1 || count > 100) return { error: `"${line}": between 1 and 100 packs a line.` };
		if (contents.length > 100) return { error: `"${line}": a shorter name, please.` };
		packs.push({ contents, count });
	}
	return { packs };
}
