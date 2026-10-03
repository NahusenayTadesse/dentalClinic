/**
 * Treatment packages: a clinic's own bundles of services at a price of their own. Client-safe and
 * pure — the billing screens and `server/packages.ts` apply the same rules.
 *
 * Two kinds, because clinics here sell them two ways:
 *
 *   - **prepaid** — bought and paid for up front ("six cleanings a year", a whitening course). It is
 *     sold as one bill; afterwards, the work it covers is billed at nothing — automatically, when a
 *     bill is raised from that work — until each service's count is used up or the package expires.
 *     Without that step the work would turn up as unbilled and be charged a second time.
 *   - **bundle** — a price for services done together ("check-up: examination, scaling and a
 *     bitewing for 1,500"). Nothing is sold in advance: on a draft bill that holds all its services,
 *     applying it re-prices those lines so they add up to the package price, each line keeping its
 *     share — so a dentist's commission and the reports still see what each service brought in.
 *
 * A third kind is a new member of `PACKAGE_KINDS` and a branch in `server/packages.ts`; the screens
 * read the label from here.
 *
 * Non-goals: packages that cover a share of a service (a discount is a discount), and packages
 * across patients (a family plan is one prepaid package per person).
 */

export const PACKAGE_KINDS = ['prepaid', 'bundle'] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

export const PACKAGE_KIND_LABEL: Record<PackageKind, string> = {
	prepaid: 'Prepaid — sold up front, work billed at nothing',
	bundle: 'Bundle — a price for services done together'
};

/** What is left of a patient's prepaid package for one service. */
export type Allowance = {
	patientPackageId: number;
	serviceId: number;
	left: number;
	/** `YYYY-MM-DD`, or null for a package that does not expire. */
	expiresOn: string | null;
	name: string;
};

/**
 * Which pieces of work a patient's prepaid packages cover: the package expiring soonest first, so
 * nothing is left to lapse while a later one is spent. `today` decides what has expired. Returns
 * the package and its name for each covered procedure.
 */
export function coverWork(
	allowances: Allowance[],
	work: { procedureId: number; serviceId: number | null }[],
	today: string
): Map<number, { patientPackageId: number; name: string }> {
	const live = allowances
		.filter((a) => a.left > 0 && (a.expiresOn === null || a.expiresOn >= today))
		.map((a) => ({ ...a }))
		.sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
	const covered = new Map<number, { patientPackageId: number; name: string }>();
	for (const w of work) {
		const allowance = live.find((a) => a.serviceId === w.serviceId && a.left > 0);
		if (!allowance) continue;
		allowance.left--;
		covered.set(w.procedureId, {
			patientPackageId: allowance.patientPackageId,
			name: allowance.name
		});
	}
	return covered;
}

/**
 * The lines a bundle applies to on a bill: for each of its services, as many lines of that service
 * as the bundle counts, taken from the lines no package has priced yet. Null when the bill does not
 * hold the whole bundle — half a check-up is not a check-up.
 */
export function bundleLines<L extends { id: number; serviceId: number | null }>(
	items: { serviceId: number; quantity: number }[],
	lines: L[]
): L[] | null {
	const free = [...lines];
	const taken: L[] = [];
	for (const item of items) {
		for (let n = 0; n < item.quantity; n++) {
			const at = free.findIndex((l) => l.serviceId === item.serviceId);
			if (at < 0) return null;
			taken.push(free[at]);
			free.splice(at, 1);
		}
	}
	return taken.length ? taken : null;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * New prices for a bundle's lines: each line's share of the package price, in proportion to its
 * own price, the cents left by rounding on the last line so they add up exactly. Lines with no
 * price share equally.
 */
export function bundlePrices(prices: number[], packagePrice: number): number[] {
	if (!prices.length) return [];
	const total = prices.reduce((s, p) => s + p, 0);
	const shares = prices.map((p) =>
		cents(total > 0 ? (packagePrice * p) / total : packagePrice / prices.length)
	);
	const drift = cents(packagePrice - shares.reduce((s, p) => s + p, 0));
	shares[shares.length - 1] = cents(shares[shares.length - 1] + drift);
	return shares;
}
