/**
 * Treatment packages: what the clinic offers, selling a prepaid one, and applying a bundle to a
 * draft bill. The rules are `$lib/packages.ts`'s; what a prepaid package covers when work is billed
 * is `packageCover.ts`'s, read by `invoiceWrites.ts`.
 *
 *   - **selling** a prepaid package is an ordinary issued bill with one line, and a
 *     `patient_package` row tying the patient to it — paid at the desk like any bill, with a
 *     deposit if they have one
 *   - **a bundle** re-prices the lines of a draft that hold its services; taking it off puts each
 *     line back to its charted fee. Only on a draft: an issued bill's prices are what the paper says
 *
 * Audit (§11): a sale is a `patient_package` row and its bill's own audit; a bundle applied or
 * removed is one `invoice_line` row naming the lines, not one row per line.
 *
 * Non-goals: refunding part of a prepaid package (a manager voids its bill, which ends the package,
 * and a new one is sold), and moving a package between patients.
 */
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	invoiceLine,
	patientPackage,
	procedures,
	services,
	treatmentPackage,
	treatmentPackageItem
} from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { notDeleted, softDeletePackageItems } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import { billFor } from '$lib/server/billing';
import { billingRefusals } from '$lib/server/cashDrawer';
import { createInvoice, issueInvoice } from '$lib/server/invoiceWrites';
import { allowancesFor } from '$lib/server/packageCover';
import { addClinicDays, clinicToday } from '$lib/clinicTime';
import { canEditInvoice } from '$lib/invoiceStatus';
import { bundleLines, bundlePrices, type PackageKind } from '$lib/packages';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/** The services in some packages, with each service's name and standard price. */
export async function itemsOf(packageIds: number[], reader: Reader = db) {
	if (!packageIds.length) return [];
	return reader
		.select({
			packageId: treatmentPackageItem.packageId,
			serviceId: treatmentPackageItem.serviceId,
			quantity: treatmentPackageItem.quantity,
			name: services.name,
			price: services.price
		})
		.from(treatmentPackageItem)
		.innerJoin(services, eq(services.id, treatmentPackageItem.serviceId))
		.where(
			and(inArray(treatmentPackageItem.packageId, packageIds), notDeleted(treatmentPackageItem))
		)
		.orderBy(asc(services.name));
}

/** The active packages of a kind, each with its services — what can be sold or applied now. */
export async function offeredPackages(kind: PackageKind, reader: Reader = db) {
	const packages = await reader
		.select({
			id: treatmentPackage.id,
			name: treatmentPackage.name,
			price: treatmentPackage.price,
			validDays: treatmentPackage.validDays,
			description: treatmentPackage.description
		})
		.from(treatmentPackage)
		.where(
			and(
				eq(treatmentPackage.kind, kind),
				eq(treatmentPackage.isActive, true),
				notDeleted(treatmentPackage)
			)
		)
		.orderBy(asc(treatmentPackage.name));
	const items = await itemsOf(
		packages.map((p) => p.id),
		reader
	);
	return packages
		.map((p) => ({ ...p, items: items.filter((i) => i.packageId === p.id) }))
		.filter((p) => p.items.length > 0);
}

/**
 * Replaces a package's services. Configuration, like the rest of the package: not audited (§11),
 * the rows carry who changed them. Patients who bought it keep counting against the services as
 * they are now — a clinic changing a package it has sold should retire it and add another.
 */
export async function savePackageItems(
	tx: Tx,
	userId: string | undefined,
	packageId: number,
	items: { serviceId: number; quantity: number }[]
) {
	const [found] = await tx
		.select({ id: treatmentPackage.id })
		.from(treatmentPackage)
		.where(and(eq(treatmentPackage.id, packageId), notDeleted(treatmentPackage)))
		.limit(1);
	refuseUnless(Boolean(found), 'That package no longer exists.');
	const ids = items.map((i) => i.serviceId);
	refuseUnless(new Set(ids).size === ids.length, 'A service is in the package twice.');
	refuseUnless(
		items.every((i) => Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 100),
		'Each service is in the package between 1 and 100 times.'
	);
	if (ids.length) {
		const known = await tx
			.select({ id: services.id })
			.from(services)
			.where(and(inArray(services.id, ids), notDeleted(services)));
		refuseUnless(known.length === ids.length, 'A service is no longer in the catalogue.');
	}
	const old = await tx
		.select({ id: treatmentPackageItem.id })
		.from(treatmentPackageItem)
		.where(and(eq(treatmentPackageItem.packageId, packageId), notDeleted(treatmentPackageItem)));
	await softDeletePackageItems(
		tx,
		old.map((o) => o.id),
		userId
	);
	if (items.length) {
		await tx
			.insert(treatmentPackageItem)
			.values(items.map((i) => ({ packageId, ...i, createdBy: userId })));
	}
}

/** A patient's prepaid packages, each with its services' counts used and left. */
export async function patientPackages(patientId: number) {
	const allowances = await allowancesFor(patientId);
	const today = clinicToday();
	const byPackage = new Map<number, (typeof allowances)[number][]>();
	for (const a of allowances) {
		byPackage.set(a.patientPackageId, [...(byPackage.get(a.patientPackageId) ?? []), a]);
	}
	const names = await itemsOf([...new Set(allowances.map((a) => a.packageId))]);
	return [...byPackage.values()].map((rows) => ({
		id: rows[0].patientPackageId,
		name: rows[0].name,
		soldOn: rows[0].soldOn,
		expiresOn: rows[0].expiresOn,
		expired: rows[0].expiresOn !== null && rows[0].expiresOn < today,
		items: rows.map((r) => ({
			service:
				names.find((n) => n.packageId === r.packageId && n.serviceId === r.serviceId)?.name ??
				'Service',
			total: r.total,
			used: r.used,
			left: r.left
		}))
	}));
}

/**
 * Sells a prepaid package: an issued bill with one line at the package's price, and the patient's
 * package from today. Returns the bill's id and the package's name.
 */
export async function sellPackage(
	tx: Tx,
	event: AuditRequest,
	input: { patientId: number; packageId: number; branchId: number | null }
): Promise<{ invoiceId: number; name: string }> {
	const [offer] = (await offeredPackages('prepaid', tx)).filter((p) => p.id === input.packageId);
	refuseUnless(Boolean(offer), 'Choose a prepaid package that is offered.', 'packageId');
	const invoiceId = await createInvoice(tx, event, {
		patientId: input.patientId,
		procedureIds: [],
		branchId: input.branchId,
		charges: [{ description: `Package: ${offer.name}`, quantity: 1, unitPrice: offer.price }]
	});
	const soldOn = clinicToday();
	const id = await insertReturningId(tx, patientPackage, {
		patientId: input.patientId,
		packageId: offer.id,
		invoiceId,
		branchId: input.branchId ?? undefined,
		soldOn,
		expiresOn: offer.validDays ? addClinicDays(soldOn, offer.validDays) : null,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'patient_package', recordId: id, action: 'create' });
	// Numbered last. Raising a bill from work locks the patient's packages (`coverageFor`) and, when
	// issued in the same transaction, then waits for the bill number; numbering this sale before
	// recording its package took the same two locks the other way round, and a sale and a bill for
	// one patient at one moment deadlocked.
	await issueInvoice(tx, event, input.patientId, invoiceId, { dueOn: null });
	return { invoiceId, name: offer.name };
}

/** A draft's work lines, with the service each was charted as and the fee it was charted at. */
async function workLines(reader: Reader, invoiceId: number) {
	return reader
		.select({
			id: invoiceLine.id,
			serviceId: procedures.serviceId,
			fee: procedures.fee,
			unitPrice: invoiceLine.unitPrice,
			description: invoiceLine.description,
			patientPackageId: invoiceLine.patientPackageId,
			bundlePackageId: invoiceLine.bundlePackageId
		})
		.from(invoiceLine)
		.innerJoin(procedures, eq(procedures.id, invoiceLine.procedureId))
		.where(
			and(
				eq(invoiceLine.invoiceId, invoiceId),
				notDeleted(invoiceLine),
				isNotNull(invoiceLine.procedureId)
			)
		)
		.orderBy(asc(invoiceLine.sortOrder), asc(invoiceLine.id));
}

/**
 * The bundles on a draft: those applied, and those that fit the lines no package has priced yet —
 * for the buttons. A bill that is not a draft has neither.
 */
export async function bundlesOnBill(invoiceId: number, status: string) {
	if (status !== 'draft') return { applied: [], fitting: [] };
	const [lines, offered] = await Promise.all([workLines(db, invoiceId), offeredPackages('bundle')]);
	const free = lines.filter((l) => l.patientPackageId === null && l.bundlePackageId === null);
	const appliedIds = [
		...new Set(lines.flatMap((l) => (l.bundlePackageId ? [l.bundlePackageId] : [])))
	];
	const applied = appliedIds.length
		? await db
				.select({
					id: treatmentPackage.id,
					name: treatmentPackage.name,
					price: treatmentPackage.price
				})
				.from(treatmentPackage)
				.where(inArray(treatmentPackage.id, appliedIds))
		: [];
	return {
		applied,
		fitting: offered
			.filter((p) => bundleLines(p.items, free) !== null)
			.map((p) => ({ id: p.id, name: p.name, price: p.price }))
	};
}

/**
 * Applies a bundle to a draft: its lines re-priced to add up to the package price. Returns the
 * bundle's name, for the message.
 */
export async function applyBundle(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	packageId: number
): Promise<string> {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).onlyDraft);
	const [offer] = (await offeredPackages('bundle', tx)).filter((p) => p.id === packageId);
	refuseUnless(Boolean(offer), 'Choose a bundle that is offered.', 'packageId');
	const free = (await workLines(tx, invoiceId)).filter(
		(l) => l.patientPackageId === null && l.bundlePackageId === null
	);
	const lines = bundleLines(offer.items, free);
	refuseUnless(lines !== null, `This bill does not hold everything in ${offer.name}.`);
	const prices = bundlePrices(
		lines.map((l) => l.unitPrice),
		offer.price
	);
	for (const [i, line] of lines.entries()) {
		await tx
			.update(invoiceLine)
			.set({
				unitPrice: prices[i],
				lineTotal: prices[i],
				description: `${line.description} — in ${offer.name}`.slice(0, 255),
				bundlePackageId: offer.id,
				updatedBy: event.locals.user?.id
			})
			.where(eq(invoiceLine.id, line.id));
	}
	await recordAudit(tx, event, {
		table: 'invoice_line',
		recordId: invoiceId,
		action: 'update',
		detail: { bundle: offer.id, lines: lines.map((l) => l.id) }
	});
	return offer.name;
}

/** Takes a bundle off a draft: each of its lines back to the fee it was charted at. */
export async function removeBundle(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	invoiceId: number,
	packageId: number
) {
	const bill = await billFor(tx, patientId, invoiceId);
	refuseUnless(canEditInvoice(bill.status), billingRefusals(event).onlyDraft);
	const lines = (await workLines(tx, invoiceId)).filter((l) => l.bundlePackageId === packageId);
	refuseUnless(lines.length > 0, 'That package is not on this bill.');
	const [offer] = await tx
		.select({ name: treatmentPackage.name })
		.from(treatmentPackage)
		.where(eq(treatmentPackage.id, packageId))
		.limit(1);
	const suffix = offer ? ` — in ${offer.name}` : '';
	for (const line of lines) {
		await tx
			.update(invoiceLine)
			.set({
				unitPrice: line.fee ?? 0,
				lineTotal: line.fee ?? 0,
				description:
					suffix && line.description.endsWith(suffix)
						? line.description.slice(0, -suffix.length)
						: line.description,
				bundlePackageId: null,
				updatedBy: event.locals.user?.id
			})
			.where(eq(invoiceLine.id, line.id));
	}
	await recordAudit(tx, event, {
		table: 'invoice_line',
		recordId: invoiceId,
		action: 'update',
		detail: { bundleRemoved: packageId, lines: lines.map((l) => l.id) }
	});
}
