import { and, eq } from 'drizzle-orm';

import { childCrud, WriteRefused } from '$lib/server/childCrud';
import { customers, payerAuthorisation } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { db } from '$lib/server/db';
import { messagesFor } from '$lib/i18n/messages';
import { BILLING_PERMISSION } from './billingAction';
import { addAuthorisation, editAuthorisation } from './authorisationSchema';

/**
 * The patient's pre-authorisations from their payers — what the insurer agreed to pay, under what
 * reference, until when — as a `childCrud` section on the Billing tab. A bill to a payer that
 * requires one is issued only against an approved one with enough left (`server/payerCover.ts`).
 *
 * The form is `authorisationSchema.ts`; the `transform` here turns its amounts into numbers and
 * checks the payer.
 */
/** A posted amount as a number, or null for an empty box. */
const amount = (value: unknown) => {
	const n = Number(value);
	return value === '' || value === null || value === undefined || !Number.isFinite(n) ? null : n;
};

export const AUTHORISATIONS = {
	Authorisation: childCrud({
		table: payerAuthorisation,
		ownerColumn: 'patientId',
		label: 'Pre-authorisation',
		labelAm: 'ቅድመ ፈቃድ',
		addSchema: addAuthorisation,
		editSchema: editAuthorisation,
		audit: 'payer_authorisation',
		permission: BILLING_PERMISSION,
		transform: async (values, event) => {
			const words = messagesFor(event.locals.lang).billing.authorisations;
			const customerId = Number(values.customerId);
			const [payer] = await db
				.select({ id: customers.id })
				.from(customers)
				.where(and(eq(customers.id, customerId), notDeleted(customers)))
				.limit(1);
			if (!payer) throw new WriteRefused('customerId', words.choosePayer);
			const approvedAmount = amount(values.approvedAmount);
			if (values.status === 'approved' && (approvedAmount === null || approvedAmount <= 0)) {
				throw new WriteRefused('approvedAmount', words.needsAmount);
			}
			return {
				...values,
				customerId,
				requestedAmount: amount(values.requestedAmount),
				approvedAmount,
				validUntil: values.validUntil ? String(values.validUntil) : null,
				reference: values.reference || null,
				note: values.note || null
			};
		}
	})
};
