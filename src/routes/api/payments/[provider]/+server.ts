// Where a payment gateway posts its notification that a checkout was paid (or was not).
//
// The address is given to the gateway on its dashboard; the Payment Gateways screen shows it. The
// body is read for one thing only — which of our payments it is about — and then this server asks
// the gateway itself (`onNotification`). So the route needs no secret and checks no signature: a
// forged notification can only make the server ask a question whose honest answer is no.
//
// Always 200 with nothing in it, whatever happened: a gateway retries on anything else, and the
// reply is not the place to tell a stranger which references exist.
import { json } from '@sveltejs/kit';
import { isPaymentGateway } from '$lib/paymentGateways';
import { onNotification } from '$lib/server/onlinePayments';
import type { RequestHandler } from './$types';

/** The body as JSON, or as form fields — Telebirr and others differ — or null. */
async function bodyOf(request: Request): Promise<unknown> {
	const raw = await request.text();
	try {
		return JSON.parse(raw);
	} catch {
		return Object.fromEntries(new URLSearchParams(raw));
	}
}

export const POST: RequestHandler = async ({ params, request }) => {
	if (!isPaymentGateway(params.provider)) return json({ ok: true });
	try {
		await onNotification(params.provider, await bodyOf(request));
	} catch (err: unknown) {
		console.error(`[online-payments] a ${params.provider} notification failed:`, err);
	}
	return json({ ok: true });
};

// Some gateways call the notify URL with GET and the reference in the query.
export const GET: RequestHandler = async ({ params, url }) => {
	if (!isPaymentGateway(params.provider)) return json({ ok: true });
	try {
		await onNotification(params.provider, Object.fromEntries(url.searchParams));
	} catch (err: unknown) {
		console.error(`[online-payments] a ${params.provider} notification failed:`, err);
	}
	return json({ ok: true });
};
