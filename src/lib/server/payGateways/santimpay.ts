/**
 * SantimPay. No published documentation; the shapes follow its official C# SDK, cross-checked with
 * the Node client the community maintains. Every request carries an ES256 JWT signed with the
 * clinic's EC private key (`keys.ts`).
 *
 *   - start: `POST /initiate-payment`, our reference as `id`, signed over
 *     `{ amount, paymentReason, merchantId, generated }`. Answers `url`.
 *   - verify: `POST /fetch-transaction-status`, signed over `{ id, merId, generated }` — `merId`,
 *     not `merchantId`. Paid is `Status === 'COMPLETED'`; `txnId` is SantimPay's reference.
 *   - notification: posts `thirdPartyId` (our id) and a `Signed-Token` header. The token is not
 *     checked — nothing in the body is believed.
 *
 * The amount checked against what was asked is `amount` where the reply has it, `totalAmount`
 * otherwise. If `totalAmount` includes a fee the patient paid, the check refuses the payment as
 * the wrong amount and the desk records it by hand — the safe way to be wrong.
 */
import type { GatewayAdapter, GatewayCredentials } from './types';
import { money, pick, readJson, reason, text, TIMEOUT_MS } from './http';
import { es256Jwt, privateKeyFrom } from './keys';
import { plusMobile } from './phone';

const base = (account: GatewayCredentials) =>
	account.mode === 'live'
		? 'https://services.santimpay.com/api/v1/gateway'
		: 'https://testnet.santimpay.com/api/v1/gateway';

const generated = () => Math.floor(Date.now() / 1000);

const FAILED = new Set(['FAILED', 'CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED']);

export const santimpay: GatewayAdapter = {
	async start(account, request, fetcher) {
		const key = privateKeyFrom(account.secrets.privateKey);
		const amount = Math.round(request.amount * 100) / 100;
		const merchantId = account.settings.merchantId;
		const phone = plusMobile(request.phone);
		const response = await fetcher(`${base(account)}/initiate-payment`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				id: request.reference,
				amount,
				reason: request.title,
				merchantId,
				signedToken: es256Jwt(
					{ amount, paymentReason: request.title, merchantId, generated: generated() },
					key
				),
				successRedirectUrl: request.returnUrl,
				failureRedirectUrl: request.cancelUrl,
				cancelRedirectUrl: request.cancelUrl,
				notifyUrl: request.notifyUrl,
				...(phone ? { phoneNumber: phone } : {})
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const body = await readJson(response);
		const url = text(pick(body, 'url'));
		if (!response.ok || !url) return { ok: false, error: reason(body, response.status) };
		return { ok: true, checkoutUrl: url.replace(/&amp;/g, '&'), sessionId: null };
	},

	async verify(account, payment, fetcher) {
		const key = privateKeyFrom(account.secrets.privateKey);
		const merchantId = account.settings.merchantId;
		const response = await fetcher(`${base(account)}/fetch-transaction-status`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				id: payment.reference,
				merchantId,
				signedToken: es256Jwt(
					{ id: payment.reference, merId: merchantId, generated: generated() },
					key
				)
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const body = await readJson(response);
		const status = text(pick(body, 'Status')) ?? text(pick(body, 'status'));
		if (!response.ok || !status) return { ok: false, error: reason(body, response.status) };
		const upper = status.toUpperCase();
		return {
			ok: true,
			state: upper === 'COMPLETED' ? 'paid' : FAILED.has(upper) ? 'failed' : 'pending',
			amount: money(pick(body, 'amount')) ?? money(pick(body, 'totalAmount')),
			currency: null,
			providerReference: text(pick(body, 'txnId')),
			providerStatus: status
		};
	},

	referenceFrom(body) {
		return (
			text(pick(body, 'thirdPartyId')) ??
			text(pick(body, 'clientReference')) ??
			text(pick(body, 'id'))
		);
	}
};
