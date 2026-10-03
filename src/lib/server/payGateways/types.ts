/**
 * The shape every payment gateway adapter has, so `server/onlinePayments.ts` never knows which one
 * it is talking to. An adapter does three things: start a checkout, ask whether one was paid, and
 * read our reference out of a notification. Nothing else in the app speaks a gateway's API.
 */
import type { GatewayMode } from '$lib/paymentGateways';

/** An account as an adapter sees it: its keys decrypted, for this one call only. */
export type GatewayCredentials = {
	mode: GatewayMode;
	secrets: Record<string, string>;
	settings: Record<string, string>;
};

/** What starting a checkout needs. `amount` is in birr; `reference` is ours, letters and digits. */
export type CheckoutRequest = {
	reference: string;
	amount: number;
	phone: string | null;
	firstName: string;
	lastName: string;
	/** A short line the gateway shows the patient: "Bill INV-…". */
	title: string;
	/** Where the patient's browser goes after paying, and after giving up. */
	returnUrl: string;
	cancelUrl: string;
	/** Where the gateway posts its notification. */
	notifyUrl: string;
};

/** A checkout started, or why not. */
export type StartResult =
	{ ok: true; checkoutUrl: string; sessionId: string | null } | { ok: false; error: string };

/** What the gateway says of a checkout. `amount` is what it says was paid, when it says. */
export type VerifyResult =
	| {
			ok: true;
			state: 'paid' | 'pending' | 'failed';
			amount: number | null;
			currency: string | null;
			providerReference: string | null;
			providerStatus: string | null;
	  }
	| { ok: false; error: string };

/** One gateway. `fetcher` is for tests. */
export type GatewayAdapter = {
	start(
		account: GatewayCredentials,
		request: CheckoutRequest,
		fetcher: typeof fetch
	): Promise<StartResult>;
	verify(
		account: GatewayCredentials,
		payment: { reference: string; sessionId: string | null },
		fetcher: typeof fetch
	): Promise<VerifyResult>;
	/**
	 * Our reference — or the gateway's session id, where that is all it sends — out of a
	 * notification's body. Only ever used to decide which payment to ask about.
	 */
	referenceFrom(body: unknown): string | null;
};
