import { describe, expect, it } from 'vitest';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from './db';
import { invoiceLine, patient, procedures, services, treatmentPackage, user } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { createInvoice } from './invoiceWrites';
import { applyBundle, removeBundle, savePackageItems, sellPackage } from './packages';
import { allowancesFor } from './packageCover';
import { clinicToday } from '$lib/clinicTime';

/**
 * Both kinds of package against real bills: a prepaid package bills the work it covers at nothing
 * until its count runs out, and a bundle re-prices a draft's lines to its price and back. Built
 * inside rollbacks; a patient billed to nobody, two priced services and a user are borrowed.
 */
describe('treatment packages', async () => {
	const [someone] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(isNull(patient.customerId), isNull(patient.deletedAt)))
		.limit(1);
	const priced = await db
		.select({ id: services.id, price: services.price })
		.from(services)
		.where(and(isNotNull(services.price), isNull(services.deletedAt)))
		.limit(2);
	const [clerk] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(someone && priced.length === 2 && clerk);

	const event = {
		locals: { user: clerk ? { id: clerk.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	/** A completed procedure of a service, as charting one would leave it. */
	const done = (
		tx: Parameters<Parameters<typeof inRollback>[0]>[0],
		serviceId: number,
		fee: number
	) =>
		insertReturningId(tx, procedures, {
			patientId: someone.id,
			serviceId,
			status: 'completed',
			fee,
			completedOn: clinicToday()
		});

	it.skipIf(!ready)('bills prepaid work at nothing until the count runs out', async () => {
		const result = await inRollback(async (tx) => {
			const [service] = priced;
			const packageId = await insertReturningId(tx, treatmentPackage, {
				name: 'Test cleanings',
				kind: 'prepaid',
				price: 2000,
				validDays: 365
			});
			await savePackageItems(tx, clerk.id, packageId, [{ serviceId: service.id, quantity: 2 }]);
			await sellPackage(tx, event, { patientId: someone.id, packageId, branchId: null });
			const work = [
				await done(tx, service.id, 800),
				await done(tx, service.id, 800),
				await done(tx, service.id, 800)
			];
			const billId = await createInvoice(tx, event, {
				patientId: someone.id,
				procedureIds: work,
				branchId: null
			});
			const lines = await tx
				.select({ price: invoiceLine.unitPrice, pp: invoiceLine.patientPackageId })
				.from(invoiceLine)
				.where(eq(invoiceLine.invoiceId, billId));
			const left = (await allowancesFor(someone.id, tx)).find(
				(a) => a.packageId === packageId
			)?.left;
			return {
				prices: lines.map((l) => l.price).sort(),
				covered: lines.filter((l) => l.pp).length,
				left
			};
		});
		expect(result.prices).toEqual([0, 0, 800]);
		expect(result.covered).toBe(2);
		expect(result.left).toBe(0);
	});

	it.skipIf(!ready)('re-prices a draft to the bundle price, and back', async () => {
		const result = await inRollback(async (tx) => {
			const [a, b] = priced;
			const packageId = await insertReturningId(tx, treatmentPackage, {
				name: 'Test check-up',
				kind: 'bundle',
				price: 1000
			});
			await savePackageItems(tx, clerk.id, packageId, [
				{ serviceId: a.id, quantity: 1 },
				{ serviceId: b.id, quantity: 1 }
			]);
			const billId = await createInvoice(tx, event, {
				patientId: someone.id,
				procedureIds: [await done(tx, a.id, 600), await done(tx, b.id, 900)],
				branchId: null
			});
			const total = async () =>
				(
					await tx
						.select({ t: invoiceLine.lineTotal })
						.from(invoiceLine)
						.where(eq(invoiceLine.invoiceId, billId))
				)
					.map((l) => l.t)
					.reduce((s, t) => Math.round((s + t) * 100) / 100, 0);
			await applyBundle(tx, event, someone.id, billId, packageId);
			const bundled = await total();
			await removeBundle(tx, event, someone.id, billId, packageId);
			return { bundled, back: await total() };
		});
		expect(result.bundled).toBe(1000);
		expect(result.back).toBe(1500);
	});
});
