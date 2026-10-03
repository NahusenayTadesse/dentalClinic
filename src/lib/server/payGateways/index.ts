/**
 * The payment gateways, each behind the same three calls (`types.ts`): start a checkout, ask about
 * one, and read our reference from a notification. `server/onlinePayments` calls these and nothing
 * else; which gateway it is is a key in a table.
 *
 * **These never throw.** A network failure, a timeout, a key that will not decrypt or parse, a
 * refusal — each comes back as `{ ok: false, error }` with a sentence the desk can read, never one
 * that carries a key. An adapter's request shapes are documented in its own file, with where they
 * were confirmed: the gateways' documentation is uneven, and some of it is only their SDKs.
 *
 * Adding a gateway: a value in `PAYMENT_GATEWAYS`, its fields in `GATEWAY_INFO`, an adapter here.
 */
import type { PaymentGateway } from '$lib/paymentGateways';
import type {
	CheckoutRequest,
	GatewayAdapter,
	GatewayCredentials,
	StartResult,
	VerifyResult
} from './types';
import { networkFailure } from './http';
import { chapa } from './chapa';
import { telebirr } from './telebirr';
import { arifpay } from './arifpay';
import { santimpay } from './santimpay';

const ADAPTERS: Record<PaymentGateway, GatewayAdapter> = { chapa, telebirr, arifpay, santimpay };

/** A thrown error as the desk reads it: the network's, or a key that could not be used. */
function failure(err: unknown): { ok: false; error: string } {
	if (err instanceof Error && (err.name === 'TimeoutError' || err instanceof TypeError)) {
		return { ok: false, error: networkFailure(err) };
	}
	// A key that would not parse says so in its own words (`privateKeyFrom`); nothing else does.
	const said =
		err instanceof Error && err.message.startsWith('The private key') ? err.message : null;
	return {
		ok: false,
		error:
			said ?? 'The gateway’s keys could not be used. Check them on the Payment Gateways screen.'
	};
}

/** Starts a checkout at a gateway. */
export async function startCheckout(
	provider: PaymentGateway,
	account: GatewayCredentials,
	request: CheckoutRequest,
	fetcher: typeof fetch = fetch
): Promise<StartResult> {
	try {
		return await ADAPTERS[provider].start(account, request, fetcher);
	} catch (err: unknown) {
		return failure(err);
	}
}

/** Asks a gateway whether a checkout was paid. */
export async function verifyCheckout(
	provider: PaymentGateway,
	account: GatewayCredentials,
	payment: { reference: string; sessionId: string | null },
	fetcher: typeof fetch = fetch
): Promise<VerifyResult> {
	try {
		return await ADAPTERS[provider].verify(account, payment, fetcher);
	} catch (err: unknown) {
		return failure(err);
	}
}

/** Our reference (or the gateway's session id) from a notification, or null. */
export function referenceIn(provider: PaymentGateway, body: unknown): string | null {
	try {
		return ADAPTERS[provider].referenceFrom(body)?.slice(0, 128) ?? null;
	} catch {
		return null;
	}
}
