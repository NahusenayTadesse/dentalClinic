/**
 * What a patient's prepaid packages have left, and which work they cover — the read the bill uses
 * when it is raised from work, so covered work is billed at nothing rather than twice
 * (`$lib/packages.ts`). Its own module because `invoiceWrites.ts` reads it and `packages.ts`, which
 * sells packages, writes bills: one file for both would import itself.
 *
 * A package counts while it is not deleted and its sale bill is neither void nor deleted — a sale
 * a manager voided gives nothing. What it has used is the live bill lines it covered, on bills that
 * are not void; a line taken off a draft, or a draft thrown away, gives the use back.
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	invoice,
	invoiceLine,
	patientPackage,
	procedures,
	treatmentPackage,
	treatmentPackageItem
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { clinicToday } from '$lib/clinicTime';
import { coverWork, type Allowance } from '$lib/packages';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/**
 * Each live prepaid package of the patient, service by service, with how many are left. With
 * `lock`, the packages' rows are locked first, so two desks billing at once cannot both spend the
 * last cleaning.
 */
export async function allowancesFor(
	patientId: number,
	reader: Reader = db,
	lock = false
): Promise<(Allowance & { total: number; used: number; soldOn: string; packageId: number })[]> {
	const packagesQuery = reader
		.select({
			id: patientPackage.id,
			packageId: patientPackage.packageId,
			name: treatmentPackage.name,
			soldOn: patientPackage.soldOn,
			expiresOn: patientPackage.expiresOn
		})
		.from(patientPackage)
		.innerJoin(treatmentPackage, eq(treatmentPackage.id, patientPackage.packageId))
		.innerJoin(
			invoice,
			and(eq(invoice.id, patientPackage.invoiceId), notDeleted(invoice), ne(invoice.status, 'void'))
		)
		.where(and(eq(patientPackage.patientId, patientId), notDeleted(patientPackage)));
	const owned = lock ? await packagesQuery.for('update') : await packagesQuery;
	if (!owned.length) return [];
	const ids = owned.map((p) => p.id);

	const [items, used] = await Promise.all([
		reader
			.select({
				packageId: treatmentPackageItem.packageId,
				serviceId: treatmentPackageItem.serviceId,
				quantity: treatmentPackageItem.quantity
			})
			.from(treatmentPackageItem)
			.where(
				and(
					inArray(
						treatmentPackageItem.packageId,
						owned.map((p) => p.packageId)
					),
					notDeleted(treatmentPackageItem)
				)
			),
		reader
			.select({
				patientPackageId: invoiceLine.patientPackageId,
				serviceId: procedures.serviceId,
				n: sql<number>`count(*)`.mapWith(Number)
			})
			.from(invoiceLine)
			.innerJoin(procedures, eq(procedures.id, invoiceLine.procedureId))
			.innerJoin(
				invoice,
				and(eq(invoice.id, invoiceLine.invoiceId), notDeleted(invoice), ne(invoice.status, 'void'))
			)
			.where(and(inArray(invoiceLine.patientPackageId, ids), notDeleted(invoiceLine)))
			.groupBy(invoiceLine.patientPackageId, procedures.serviceId)
	]);

	return owned.flatMap((p) =>
		items
			.filter((i) => i.packageId === p.packageId)
			.map((i) => {
				const spent =
					used.find((u) => u.patientPackageId === p.id && u.serviceId === i.serviceId)?.n ?? 0;
				return {
					patientPackageId: p.id,
					packageId: p.packageId,
					serviceId: i.serviceId,
					name: p.name,
					soldOn: p.soldOn,
					expiresOn: p.expiresOn,
					total: i.quantity,
					used: spent,
					left: Math.max(0, i.quantity - spent)
				};
			})
	);
}

/**
 * Which of these pieces of work the patient's prepaid packages cover, read under lock — for the
 * bill being raised from them. The rule is `coverWork`'s.
 */
export async function coverageFor(
	tx: Tx,
	patientId: number,
	work: { procedureId: number; serviceId: number | null }[]
) {
	if (!work.length) return new Map<number, { patientPackageId: number; name: string }>();
	return coverWork(await allowancesFor(patientId, tx, true), work, clinicToday());
}
