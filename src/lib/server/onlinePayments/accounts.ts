/**
 * The clinic's accounts at payment gateways: adding one, changing it, switching it on and off, and
 * reading its keys back for a call to the gateway.
 *
 * **Keys are decrypted only here, and only for a call** (`server/secrets.ts`). `gatewayAccounts`
 * gives the setup screen a hint of the main key's last four characters and the settings that are not
 * secret; `credentialsFor` hands the decrypted keys to an adapter and nothing else.
 *
 * Each gateway asks for different things, listed as data in `$lib/paymentGateways.ts`. What it marks
 * secret goes into one encrypted object; the rest into `settings`. On an edit an empty secret keeps
 * the one stored — unless the gateway changed, when the old keys mean nothing and all are asked for.
 */
import { and, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { paymentGateway, paymentMethods } from '$lib/server/db/schema';
import { notDeleted, softDeletePaymentGateway } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { decryptSecret, encryptSecret, secretHint } from '$lib/server/secrets';
import { refuseUnless } from '$lib/server/childCrud';
import {
	GATEWAY_INFO,
	type GatewayFieldKey,
	type GatewayMode,
	type PaymentGateway
} from '$lib/paymentGateways';
import type { GatewayCredentials } from '$lib/server/payGateways/types';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/** The stored secrets, decrypted — string values only, whatever the JSON held. */
function readSecrets(stored: string): Record<string, string> {
	const parsed: unknown = JSON.parse(decryptSecret(stored));
	const secrets: Record<string, string> = {};
	if (parsed && typeof parsed === 'object') {
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === 'string') secrets[key] = value;
		}
	}
	return secrets;
}

/** The accounts, for the setup screen — everything but the keys, which only a hint stands for. */
export async function gatewayAccounts(reader: Reader = db) {
	return reader
		.select({
			id: paymentGateway.id,
			provider: paymentGateway.provider,
			label: paymentGateway.label,
			mode: paymentGateway.mode,
			secretHint: paymentGateway.secretHint,
			settings: paymentGateway.settings,
			enabled: paymentGateway.enabled
		})
		.from(paymentGateway)
		.where(notDeleted(paymentGateway))
		.orderBy(desc(paymentGateway.enabled), paymentGateway.label);
}

/** The accounts the desk can take money through. */
export async function enabledGateways(reader: Reader = db) {
	return reader
		.select({
			id: paymentGateway.id,
			provider: paymentGateway.provider,
			label: paymentGateway.label,
			mode: paymentGateway.mode
		})
		.from(paymentGateway)
		.where(and(eq(paymentGateway.enabled, true), notDeleted(paymentGateway)))
		.orderBy(paymentGateway.label);
}

/** What a save posts: the account, and whichever of the fields its gateway uses. */
export type GatewayInput = {
	id?: number;
	provider: PaymentGateway;
	label: string;
	mode: GatewayMode;
	enabled: boolean;
	fields: Partial<Record<GatewayFieldKey, string | undefined>>;
};

/**
 * The payment method a gateway's money is recorded as — its own, by name, made the first time it is
 * needed. A method of that name is reused whatever its state: the name is unique, and two methods
 * for one gateway would split its takings across two lines of the day's report.
 */
async function methodFor(tx: Tx, provider: PaymentGateway, userId?: string): Promise<number> {
	const name = GATEWAY_INFO[provider].methodName;
	const [found] = await tx
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(eq(paymentMethods.name, name))
		.limit(1);
	if (found) return found.id;
	return insertReturningId(tx, paymentMethods, {
		name,
		kind: 'other',
		description: `Taken online through ${GATEWAY_INFO[provider].name}`,
		createdBy: userId
	});
}

/**
 * Adds or changes an account, in the caller's transaction, audited — the keys only as "changed".
 * Every field the gateway asks for is required; on an edit of the same gateway, a secret left empty
 * keeps the stored one.
 */
export async function saveGateway(
	tx: Tx,
	event: AuditRequest,
	input: GatewayInput
): Promise<number> {
	const userId = event.locals.user?.id;
	const info = GATEWAY_INFO[input.provider];

	const [before] = input.id
		? await tx
				.select()
				.from(paymentGateway)
				.where(and(eq(paymentGateway.id, input.id), notDeleted(paymentGateway)))
				.limit(1)
		: [];
	if (input.id) refuseUnless(Boolean(before), 'That account no longer exists.');
	const kept =
		before && before.provider === input.provider ? readSecrets(before.secretsEncrypted) : {};
	const typedSecret = info.fields.some((f) => f.secret && input.fields[f.key]?.trim());

	const secrets: Record<string, string> = {};
	const settings: Record<string, string> = {};
	for (const field of info.fields) {
		const typed = input.fields[field.key]?.trim() ?? '';
		const value = typed || (field.secret ? (kept[field.key] ?? '') : '');
		refuseUnless(
			Boolean(value),
			`Enter the ${field.label.toLowerCase()} ${info.name} gave you.`,
			field.key
		);
		if (field.secret) secrets[field.key] = value;
		else settings[field.key] = value;
	}
	const main = info.fields.find((f) => f.secret);
	const fields = {
		provider: input.provider,
		label: input.label.trim(),
		mode: input.mode,
		enabled: input.enabled,
		secretsEncrypted: encryptSecret(JSON.stringify(secrets)),
		secretHint: secretHint(main ? secrets[main.key] : ''),
		settings,
		paymentMethodId: await methodFor(tx, input.provider, userId),
		updatedBy: userId
	};

	if (before) {
		await tx.update(paymentGateway).set(fields).where(eq(paymentGateway.id, before.id));
		await recordAudit(tx, event, {
			table: 'payment_gateway',
			recordId: before.id,
			action: 'update',
			before,
			// Re-encrypting always gives new ciphertext; the audit says the keys changed only when
			// one was typed.
			after:
				typedSecret || before.provider !== input.provider
					? fields
					: { ...fields, secretsEncrypted: before.secretsEncrypted }
		});
		return before.id;
	}
	const id = await insertReturningId(tx, paymentGateway, { ...fields, createdBy: userId });
	await recordAudit(tx, event, { table: 'payment_gateway', recordId: id, action: 'create' });
	return id;
}

/** Removes an account, audited. Payments already asked for through it can still be checked. */
export async function removeGateway(tx: Tx, event: AuditRequest, id: number): Promise<void> {
	const [row] = await tx
		.select({ id: paymentGateway.id })
		.from(paymentGateway)
		.where(and(eq(paymentGateway.id, id), notDeleted(paymentGateway)))
		.limit(1);
	refuseUnless(Boolean(row), 'That account no longer exists.');
	await softDeletePaymentGateway(tx, id, event.locals.user?.id);
	await recordAudit(tx, event, { table: 'payment_gateway', recordId: id, action: 'delete' });
}

/**
 * An account with its keys decrypted, for one call to its gateway. Read whether or not the account
 * has since been removed — a payment asked for through it may still be paid, and must still be
 * checkable — so this is the one read of the table that does not filter `notDeleted()`.
 */
export async function credentialsFor(
	reader: Reader,
	gatewayId: number
): Promise<
	| { ok: true; provider: PaymentGateway; paymentMethodId: number; credentials: GatewayCredentials }
	| { ok: false; error: string }
> {
	const [row] = await reader
		.select()
		.from(paymentGateway)
		.where(eq(paymentGateway.id, gatewayId))
		.limit(1);
	if (!row) return { ok: false, error: 'That gateway account no longer exists.' };
	try {
		return {
			ok: true,
			provider: row.provider,
			paymentMethodId: row.paymentMethodId,
			credentials: {
				mode: row.mode,
				secrets: readSecrets(row.secretsEncrypted),
				settings: row.settings
			}
		};
	} catch (err: unknown) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'The stored key could not be read.'
		};
	}
}
