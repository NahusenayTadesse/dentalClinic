/**
 * What a bill comes to once VAT is counted: its lines, less any discount, plus VAT on the part
 * that carries it.
 *
 * One rule for three readers — issuing a bill (`server/invoiceWrites.ts`), a refused discount
 * putting a bill back to full price, and the draft's preview on screen — so the figure a patient is
 * told before issue is the figure printed on the bill.
 *
 * **The discount is spread over the lines in proportion**, so a 10% discount takes 10% off the
 * taxable part and 10% off the exempt part. VAT is then charged on what is left of the taxable
 * part. Charging VAT on the undiscounted price would tax money the clinic never received.
 *
 * **Not registered means no VAT at all**, whatever the lines say: a clinic below the threshold pays
 * turnover tax on its own return, which puts nothing on the patient's bill.
 *
 * Non-goals: withholding (a payer withholds when it pays, not when the bill is issued), and turnover
 * tax, which is the clinic's own filing.
 */

/** A bill line, as the rule needs it. */
export type TaxLine = { lineTotal: number; taxable: boolean };

/** The clinic's VAT standing at the moment of issue. */
export type VatStanding = { registered: boolean; rate: number };

/** A bill's totals. `vat` and `rate` are null when no VAT is charged. */
export type BillTotals = {
	subtotal: number;
	discount: number;
	vat: number | null;
	rate: number | null;
	total: number;
};

/** Rounded to the cent, as money is everywhere else (`cents` in `invoiceStatus.ts`). */
const cents = (n: number) => Math.round(n * 100) / 100;

/** The bill's totals under the clinic's VAT standing. */
export function billTotals(lines: TaxLine[], discount: number, vat: VatStanding): BillTotals {
	const subtotal = cents(lines.reduce((sum, l) => sum + l.lineTotal, 0));
	const off = cents(Math.min(Math.max(discount, 0), subtotal));
	const taxableGross = lines.filter((l) => l.taxable).reduce((sum, l) => sum + l.lineTotal, 0);

	if (!vat.registered || taxableGross <= 0 || vat.rate <= 0) {
		return { subtotal, discount: off, vat: null, rate: null, total: cents(subtotal - off) };
	}
	// The discount's share of the taxable part, in proportion to that part's share of the bill.
	const taxableNet = subtotal > 0 ? taxableGross * (1 - off / subtotal) : 0;
	const charged = cents((taxableNet * vat.rate) / 100);
	return {
		subtotal,
		discount: off,
		vat: charged,
		rate: vat.rate,
		total: cents(subtotal - off + charged)
	};
}
