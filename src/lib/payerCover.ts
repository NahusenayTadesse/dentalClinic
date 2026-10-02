/**
 * How a bill billed to a payer divides between the payer and the patient.
 *
 * Three things can leave part of a bill with the patient, and they stack:
 *
 *   - **the payer's share** — an insurer covering 80% leaves 20% as the co-payment
 *   - **the member's yearly limit** — what the payer has already paid for this member this year
 *     counts against it, and what runs past it is the patient's
 *   - **the pre-authorisation** — a payer that requires one pays no more than what is left of it
 *
 * The payer's part is the smallest of the three; the patient's is the rest. Pure and client-safe:
 * `server/payerCover.ts` applies it at issue, and a bill page can show the same split before.
 *
 * Non-goals: per-service rules (a payer that covers fillings but not crowns), waiting periods and
 * deductibles. Clinics here mostly deal with employers who pay in full and a few insurers on a flat
 * share; those rules are what an insurer's own claims office decides, on the claim.
 */

/** The facts the split needs. A null limit or authorisation means none applies. */
export type CoverFacts = {
	total: number;
	coveragePercent: number;
	/** What is left of the member's yearly limit, or null for no limit. */
	limitLeft: number | null;
	/** What is left of the pre-authorisation, or null when the payer needs none. */
	authorisedLeft: number | null;
};

/** The split, and why the patient has any of it. */
export type CoverSplit = {
	payer: number;
	patient: number;
	/** What capped the payer's part below its share, if anything did. */
	cappedBy: 'limit' | 'authorisation' | null;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/** Divides a bill between its payer and its patient. */
export function coverSplit(facts: CoverFacts): CoverSplit {
	const total = cents(Math.max(facts.total, 0));
	const share = Math.min(Math.max(facts.coveragePercent, 0), 100);
	let payer = cents((total * share) / 100);
	let cappedBy: CoverSplit['cappedBy'] = null;

	if (facts.limitLeft !== null && payer > Math.max(facts.limitLeft, 0)) {
		payer = cents(Math.max(facts.limitLeft, 0));
		cappedBy = 'limit';
	}
	if (facts.authorisedLeft !== null && payer > Math.max(facts.authorisedLeft, 0)) {
		payer = cents(Math.max(facts.authorisedLeft, 0));
		cappedBy = 'authorisation';
	}
	return { payer, patient: cents(total - payer), cappedBy };
}
