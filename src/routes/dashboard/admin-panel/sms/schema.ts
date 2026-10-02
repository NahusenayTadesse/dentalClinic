import { z } from 'zod/v4';
import { SMS_PROVIDERS } from '$lib/smsTemplates';

/**
 * A gateway account. The API key is optional on an edit — empty keeps the stored one — and is never
 * sent back to the form, so the dialog always opens with it blank.
 */
export const account = z.object({
	id: z.coerce.number().int().positive().optional(),
	provider: z.enum(SMS_PROVIDERS, 'Choose the gateway'),
	label: z.string('Give the account a name').trim().min(2, 'Give the account a name').max(80),
	apiKey: z.string().trim().max(400).optional(),
	senderName: z.string().trim().max(32).optional(),
	senderId: z.string().trim().max(64).optional(),
	/** Birr per segment. Empty means not known, which the log shows as blank rather than as free. */
	costPerSegment: z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? null : v),
		z.coerce.number().min(0, 'A cost cannot be negative').max(100).nullable()
	),
	isDefault: z.boolean().default(false)
});
export type Account = z.infer<typeof account>;

/** The two message templates. */
export const templates = z.object({
	reminder: z.string().trim().min(10, 'Write the reminder').max(320, 'At most 320 characters'),
	recall: z.string().trim().min(10, 'Write the recall message').max(320, 'At most 320 characters')
});
export type Templates = z.infer<typeof templates>;

/** A test message through one account, to a number the person sending it can check. */
export const testSend = z.object({
	accountId: z.coerce.number().int().positive(),
	phone: z.string('Enter a mobile number').trim().min(9, 'Enter a mobile number').max(20)
});
export type TestSend = z.infer<typeof testSend>;

/** Removing an account. */
export const remove = z.object({ id: z.coerce.number().int().positive() });
