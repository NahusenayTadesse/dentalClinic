import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { branch, customers, patient } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/permissions';
import { livePatient, livePatientId, logPatientView, patientFullName } from '$lib/server/patients';
import { invoiceDetail } from '$lib/server/billing';
import { clinicToday } from '$lib/clinicTime';
import { messagesFor } from '$lib/i18n/messages';
import { BILLING_PERMISSION } from '../../billingAction';
import type { PageServerLoad } from './$types';

/**
 * A bill on paper, with what has been paid against it — the receipt as well, since each payment is
 * listed with its receipt number. Outside the dashboard layout (`+page@.svelte`), so it reads the
 * patient itself rather than from `parent()`. Opening it is logged as a **print**.
 *
 * A draft does not print: it has no number, and a paper bill without one is exactly the document
 * that cannot be traced back.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event.locals, BILLING_PERMISSION);
	const say = messagesFor(event.locals.lang).billing;
	const patientId = await livePatientId(event);
	const invoiceId = Number(event.params.invoiceId);
	if (!Number.isInteger(invoiceId) || invoiceId <= 0) error(404, say.bill.notFound);

	const bill = await invoiceDetail(patientId, invoiceId);
	if (!bill) error(404, say.bill.notThisPatient);
	if (bill.status === 'draft') error(409, say.print.draftNotPrinted);

	const [[person], [place], [payer]] = await Promise.all([
		db
			.select({ fullName: patientFullName, fileNo: patient.fileNo, phone: patient.phone })
			.from(patient)
			.where(and(eq(patient.id, patientId), livePatient()))
			.limit(1),
		bill.branchId === null
			? Promise.resolve([])
			: db
					.select({ name: branch.name, address: branch.address, phone: branch.phone })
					.from(branch)
					.where(eq(branch.id, bill.branchId))
					.limit(1),
		// Who the bill is addressed to when an employer or insurer pays it. Not filtered for
		// deletion: a bill issued to a payer stays addressed to them.
		bill.customerId === null
			? Promise.resolve([])
			: db
					.select({ name: customers.name })
					.from(customers)
					.where(eq(customers.id, bill.customerId))
					.limit(1)
	]);
	if (!person) error(404, say.print.patientNotFound);

	await logPatientView(patientId, 'invoice', event, { recordId: invoiceId, action: 'print' });

	return {
		// Paper records what happened: a refund waiting for a manager, or refused, has not.
		bill: { ...bill, payments: bill.payments.filter((p) => p.approvalStatus === 'approved') },
		payer: payer?.name ?? null,
		patient: person,
		branch: place ?? { name: null, address: null, phone: null },
		printedOn: clinicToday()
	};
};
