/**
 * The online payment gateways a clinic can take money through, and what each asks the clinic to
 * type in. Client-safe: the setup screen draws its fields from here, and `server/payGateways/`
 * reads the same list to know what it has to work with.
 *
 * Several gateways can be switched on at once — a patient with Telebirr pays through Telebirr, one
 * with a bank card through Chapa — so there is no "the" gateway: the desk picks one each time.
 *
 * Adding a gateway is a value in `PAYMENT_GATEWAYS`, its entry in `GATEWAY_INFO`, and an adapter in
 * `server/payGateways/`. Its fields are data, so the setup dialog needs nothing new.
 *
 * Non-goals: refunds through a gateway (a refund goes back the way the Refunds queue says, as any
 * other) and payments by an employer or insurer, which arrive by bank transfer.
 */

export const PAYMENT_GATEWAYS = ['chapa', 'telebirr', 'arifpay', 'santimpay'] as const;

/** One of `PAYMENT_GATEWAYS`. */
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

/** Test keys charge nothing; live keys take real money. */
export const GATEWAY_MODES = ['test', 'live'] as const;
export type GatewayMode = (typeof GATEWAY_MODES)[number];

/**
 * Every credential or setting any gateway asks for. One flat list, so the setup form has one shape
 * whichever gateway is chosen; each gateway says which of them it uses.
 */
export const GATEWAY_FIELD_KEYS = [
	'secretKey',
	'apiKey',
	'merchantId',
	'privateKey',
	'fabricAppId',
	'appSecret',
	'merchantAppId',
	'shortCode',
	'accountNumber',
	'bank'
] as const;

/** One of `GATEWAY_FIELD_KEYS`. */
export type GatewayFieldKey = (typeof GATEWAY_FIELD_KEYS)[number];

/** A field a gateway asks for. A secret is stored encrypted and never shown again. */
export type GatewayField = {
	key: GatewayFieldKey;
	label: string;
	secret: boolean;
	/** A private key is several lines of PEM. */
	multiline?: boolean;
	placeholder?: string;
};

/** How a gateway is named, what it takes, and what it asks for. */
export type GatewayInfo = {
	name: string;
	/** What the patient can pay with, for the desk choosing a gateway. */
	takes: string;
	fields: GatewayField[];
	/** The payment method its money is recorded as, created when the first account is added. */
	methodName: string;
};

export const GATEWAY_INFO: Record<PaymentGateway, GatewayInfo> = {
	chapa: {
		name: 'Chapa',
		takes: 'Telebirr, CBE Birr, M-Pesa, bank cards',
		methodName: 'Chapa (online)',
		fields: [
			{
				key: 'secretKey',
				label: 'Secret key',
				secret: true,
				placeholder: 'CHASECK_TEST-… or CHASECK-…'
			}
		]
	},
	telebirr: {
		name: 'Telebirr',
		takes: 'Telebirr',
		methodName: 'Telebirr (online)',
		fields: [
			{ key: 'fabricAppId', label: 'Fabric app ID', secret: false },
			{ key: 'appSecret', label: 'App secret', secret: true },
			{ key: 'merchantAppId', label: 'Merchant app ID', secret: false },
			{ key: 'shortCode', label: 'Merchant code (short code)', secret: false },
			{
				key: 'privateKey',
				label: 'Private key',
				secret: true,
				multiline: true,
				placeholder: 'As Ethio Telecom gave it — PEM or base64'
			}
		]
	},
	arifpay: {
		name: 'ArifPay',
		takes: 'Telebirr, CBE Birr, Amole, HelloCash, bank cards',
		methodName: 'ArifPay (online)',
		fields: [
			{ key: 'apiKey', label: 'API key', secret: true },
			{
				key: 'accountNumber',
				label: 'Settlement account number',
				secret: false,
				placeholder: 'The clinic’s account the money settles to'
			},
			{
				key: 'bank',
				label: 'Settlement bank code',
				secret: false,
				placeholder: 'As ArifPay lists it, e.g. AWINETAA'
			}
		]
	},
	santimpay: {
		name: 'SantimPay',
		takes: 'Telebirr, CBE Birr, M-Pesa, bank cards',
		methodName: 'SantimPay (online)',
		fields: [
			{ key: 'merchantId', label: 'Merchant ID', secret: false },
			{
				key: 'privateKey',
				label: 'Private key',
				secret: true,
				multiline: true,
				placeholder: 'As SantimPay gave it — PEM or base64'
			}
		]
	}
};

/** Whether `name` is a gateway this version knows — for a webhook's path segment. */
export function isPaymentGateway(name: string): name is PaymentGateway {
	return (PAYMENT_GATEWAYS as readonly string[]).includes(name);
}

/** Where an online payment stands. */
export const ONLINE_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled'] as const;
export type OnlinePaymentStatus = (typeof ONLINE_PAYMENT_STATUSES)[number];
