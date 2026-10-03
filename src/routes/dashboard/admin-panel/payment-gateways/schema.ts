import { z } from 'zod/v4';
import { GATEWAY_MODES, PAYMENT_GATEWAYS } from '$lib/paymentGateways';

/** A text field a gateway may ask for. Optional here: which are required depends on the gateway. */
const field = (max = 400) => z.string().trim().max(max).optional();

/**
 * A gateway account. One flat shape for every gateway — each uses some of the fields
 * (`GATEWAY_INFO`), and the server says which it is missing. Secrets are never sent back to the
 * form, so on an edit they open blank and blank keeps the stored one.
 */
export const gateway = z.object({
	id: z.coerce.number().int().positive().optional(),
	provider: z.enum(PAYMENT_GATEWAYS, 'Choose the gateway'),
	label: z.string('Give the account a name').trim().min(2, 'Give the account a name').max(80),
	mode: z.enum(GATEWAY_MODES).default('test'),
	enabled: z.boolean().default(true),
	secretKey: field(),
	apiKey: field(),
	merchantId: field(100),
	privateKey: field(5000),
	fabricAppId: field(100),
	appSecret: field(),
	merchantAppId: field(100),
	shortCode: field(50),
	accountNumber: field(50),
	bank: field(50)
});
export type Gateway = z.infer<typeof gateway>;

/** Removing an account. */
export const remove = z.object({ id: z.coerce.number().int().positive() });
