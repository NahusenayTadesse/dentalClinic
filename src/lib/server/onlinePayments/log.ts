/**
 * Every online payment at a branch over a window, for the gateways screen — what a clinic checks
 * its gateway's settlement report against. Read-only, and its own file so the setup screen does not
 * load the payment flow.
 */
import { and, desc, eq, gte } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { onlinePayment, patient, paymentGateway, transactions } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { patientFullName } from '$lib/server/patients';

/** Online payments asked for at the working branch since `since`, newest first. */
export async function recentOnlinePayments(branchCtx: Pick<BranchContext, 'active'>, since: Date) {
	return db
		.select({
			id: onlinePayment.id,
			askedAt: onlinePayment.createdAt,
			provider: onlinePayment.provider,
			// Attribution: a removed account still took the payment.
			account: paymentGateway.label,
			mode: paymentGateway.mode,
			reference: onlinePayment.reference,
			providerReference: onlinePayment.providerReference,
			amount: onlinePayment.amount,
			status: onlinePayment.status,
			error: onlinePayment.error,
			paidAt: onlinePayment.paidAt,
			receiptNumber: transactions.receiptNumber,
			patientId: onlinePayment.patientId,
			patient: patientFullName
		})
		.from(onlinePayment)
		.innerJoin(paymentGateway, eq(paymentGateway.id, onlinePayment.gatewayId))
		.leftJoin(patient, eq(patient.id, onlinePayment.patientId))
		.leftJoin(transactions, eq(transactions.id, onlinePayment.transactionId))
		.where(
			and(
				gte(onlinePayment.createdAt, since),
				notDeleted(onlinePayment),
				branchFilter(onlinePayment.branchId, branchCtx)
			)
		)
		.orderBy(desc(onlinePayment.createdAt))
		.limit(500);
}
