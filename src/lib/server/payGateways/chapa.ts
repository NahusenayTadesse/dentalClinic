/**
 * Chapa (developer.chapa.co). One host for test and live — the secret key decides which
 * (`CHASECK_TEST-…` against `CHASECK-…`) — and a bearer token on every call.
 *
 *   - start: `POST /v1/transaction/initialize` with our reference as `tx_ref`; the amount is a
 *     string. Answers `data.checkout_url`.
 *   - verify: `GET /v1/transaction/verify/{tx_ref}`. Paid is `data.status === 'success'`, with
 *     `data.amount`, `data.currency` and Chapa's own `data.reference`. Before the patient pays it
 *     answers without data, which is "not yet", not a failure.
 *   - notification: the dashboard's webhook posts `tx_ref`; the callback URL is a GET with `trx_ref`.
 */
import type { GatewayAdapter } from './types';
import { birr, money, pick, readJson, reason, text, TIMEOUT_MS } from './http';
import { localMobile } from './phone';

const BASE = 'https://api.chapa.co/v1';

/** Chapa refuses a description with anything but letters, digits, `-`, `_`, `.` and spaces. */
const plain = (s: string) => s.replace(/[^\p{L}\p{N}\-_. ]/gu, ' ').slice(0, 50);

export const chapa: GatewayAdapter = {
	async start(account, request, fetcher) {
		const response = await fetcher(`${BASE}/transaction/initialize`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${account.secrets.secretKey}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				amount: birr(request.amount),
				currency: 'ETB',
				tx_ref: request.reference,
				first_name: request.firstName,
				last_name: request.lastName,
				...(localMobile(request.phone) ? { phone_number: localMobile(request.phone) } : {}),
				callback_url: request.notifyUrl,
				return_url: request.returnUrl,
				customization: { description: plain(request.title) }
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const body = await readJson(response);
		const url = text(pick(body, 'data', 'checkout_url'));
		if (!response.ok || !url) return { ok: false, error: reason(body, response.status) };
		return { ok: true, checkoutUrl: url, sessionId: null };
	},

	async verify(account, payment, fetcher) {
		const response = await fetcher(
			`${BASE}/transaction/verify/${encodeURIComponent(payment.reference)}`,
			{
				headers: {
					Authorization: `Bearer ${account.secrets.secretKey}`,
					Accept: 'application/json'
				},
				signal: AbortSignal.timeout(TIMEOUT_MS)
			}
		);
		const body = await readJson(response);
		if (response.status === 401 || response.status === 403 || response.status >= 500) {
			return { ok: false, error: reason(body, response.status) };
		}
		const status = text(pick(body, 'data', 'status'));
		return {
			ok: true,
			state: status === 'success' ? 'paid' : status === 'failed' ? 'failed' : 'pending',
			amount: money(pick(body, 'data', 'amount')),
			currency: text(pick(body, 'data', 'currency')),
			providerReference: text(pick(body, 'data', 'reference')),
			providerStatus: status
		};
	},

	referenceFrom(body) {
		return text(pick(body, 'tx_ref')) ?? text(pick(body, 'trx_ref'));
	}
};
