/**
 * ArifPay, as its official TypeScript SDK calls it. One host; the sandbox is a `/sandbox` path, and
 * the API key goes in the `x-arifpay-key` header.
 *
 *   - start: `POST /v0/checkout/session`, our reference as `nonce`, the bill as one item, and the
 *     clinic's settlement account as the single beneficiary. Answers `data.sessionId` and
 *     `data.paymentUrl`.
 *   - verify: `GET /v0/checkout/session/{sessionId}` — by ArifPay's id, not ours, which is why the
 *     session id is stored. Paid is `data.transaction.transactionStatus === 'SUCCESS'`.
 *   - notification: posts `nonce` and the session; it carries no signature, which does not matter
 *     here — it is only a reason to ask.
 */
import type { GatewayAdapter, GatewayCredentials } from './types';
import { money, pick, readJson, reason, text, TIMEOUT_MS } from './http';
import { internationalMobile } from './phone';

const base = (account: GatewayCredentials) =>
	`https://gateway.arifpay.net/v0${account.mode === 'test' ? '/sandbox' : ''}`;

/** How long ArifPay keeps the checkout open: a day, the same as the desk waits. */
const OPEN_FOR_MS = 24 * 60 * 60 * 1000;

const FAILED = new Set(['FAILED', 'CANCELLED', 'CANCELED', 'EXPIRED']);

export const arifpay: GatewayAdapter = {
	async start(account, request, fetcher) {
		const amount = Math.round(request.amount * 100) / 100;
		const phone = internationalMobile(request.phone);
		const response = await fetcher(`${base(account)}/checkout/session`, {
			method: 'POST',
			headers: {
				'x-arifpay-key': account.secrets.apiKey,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				cancelUrl: request.cancelUrl,
				errorUrl: request.cancelUrl,
				successUrl: request.returnUrl,
				notifyUrl: request.notifyUrl,
				nonce: request.reference,
				...(phone ? { phone } : {}),
				paymentMethods: [],
				expireDate: new Date(Date.now() + OPEN_FOR_MS).toISOString(),
				items: [{ name: request.title, quantity: 1, price: amount, description: request.title }],
				beneficiaries: [
					{
						accountNumber: account.settings.accountNumber,
						bank: account.settings.bank,
						amount
					}
				],
				lang: 'EN'
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const body = await readJson(response);
		const url = text(pick(body, 'data', 'paymentUrl'));
		const sessionId = text(pick(body, 'data', 'sessionId'));
		if (!response.ok || !url || !sessionId)
			return { ok: false, error: reason(body, response.status) };
		return { ok: true, checkoutUrl: url, sessionId };
	},

	async verify(account, payment, fetcher) {
		if (!payment.sessionId) return { ok: false, error: 'ArifPay gave no session id to ask about.' };
		const response = await fetcher(
			`${base(account)}/checkout/session/${encodeURIComponent(payment.sessionId)}`,
			{
				headers: { 'x-arifpay-key': account.secrets.apiKey, Accept: 'application/json' },
				signal: AbortSignal.timeout(TIMEOUT_MS)
			}
		);
		const body = await readJson(response);
		if (!response.ok) return { ok: false, error: reason(body, response.status) };
		// The session answering must be ours — a session id is only ever stored from our own start.
		const nonce = text(pick(body, 'data', 'nonce'));
		if (nonce && nonce !== payment.reference) {
			return { ok: false, error: 'ArifPay answered about a different payment.' };
		}
		const status = text(pick(body, 'data', 'transaction', 'transactionStatus'));
		return {
			ok: true,
			state: status === 'SUCCESS' ? 'paid' : status && FAILED.has(status) ? 'failed' : 'pending',
			amount: money(pick(body, 'data', 'totalAmount')),
			currency: null,
			providerReference: text(pick(body, 'data', 'transaction', 'transactionId')),
			providerStatus: status
		};
	},

	referenceFrom(body) {
		return text(pick(body, 'nonce')) ?? text(pick(body, 'sessionId')) ?? text(pick(body, 'uuid'));
	}
};
