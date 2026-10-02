/**
 * What a text message to a patient says, how many segments it costs, and where it can go.
 *
 * Client-safe, because the SMS settings screen previews a template's length and cost with the rule
 * the sender charges by. Relative imports only: the clinic settings schema reads the default
 * templates from here, and drizzle-kit loads the schema without SvelteKit's aliases.
 *
 * **Amharic by default.** Patients read Amharic; the time is the Ethiopian clock ("ጠዋት 3:00"),
 * because that is how a patient will hear "nine o'clock" when they think about it.
 *
 * **Segments, because that is what is paid for.** A message in Latin letters only is GSM-7: 160
 * characters, or 153 a part once it is split. One Ethiopic character makes the whole message UCS-2:
 * 70, or 67 a part. An Amharic reminder is two segments, not one, and the cost log says so.
 *
 * Non-goals: GSM-7's extended characters (`{ } [ ] ~ \ | ^ €`) counting double — the templates do
 * not use them — and delivery reports, which neither gateway's plain send returns.
 */

/**
 * The gateways the clinic can send through. Here rather than beside the table, because the SMS
 * screen's form offers them and server modules cannot reach the browser. Adding one is a value here
 * and an adapter in `server/sms/gateways.ts`.
 */
export const SMS_PROVIDERS = ['afromessage', 'geezsms'] as const;

/** One of `SMS_PROVIDERS`. */
export type SmsProviderName = (typeof SMS_PROVIDERS)[number];

/** The placeholders a template can use, and what each becomes. */
export const SMS_PLACEHOLDERS = {
	name: "The patient's given name",
	date: 'The Ethiopian date of the appointment',
	time: 'The time on the Ethiopian clock',
	clinic: "The branch's name",
	phone: "The branch's phone number",
	visit: 'What the visit is for — a check-up'
} as const;

/** One of the placeholder names. */
export type SmsPlaceholder = keyof typeof SMS_PLACEHOLDERS;

/** Whether `{key}` in a template is one of the placeholders. */
export function isPlaceholder(key: string): key is SmsPlaceholder {
	return key in SMS_PLACEHOLDERS;
}

/** What a clinic that never edits its templates sends. */
export const DEFAULT_SMS_TEMPLATES = {
	reminder: 'ሰላም {name}፣ {date} {time} ላይ በ{clinic} የጥርስ ቀጠሮ አለዎት። ለማዘዋወር {phone} ይደውሉ።',
	recall: 'ሰላም {name}፣ የ{visit} ጊዜዎ ደርሷል። ቀጠሮ ለመያዝ {clinic}ን በ{phone} ይደውሉ።'
} as const;

/**
 * A template with its placeholders filled. A placeholder with no value is left out rather than
 * printed as `{phone}`; an unknown `{word}` is left as written, so a typo shows in the preview.
 */
export function fillTemplate(
	template: string,
	values: Partial<Record<SmsPlaceholder, string | null>>
): string {
	return template
		.replace(/\{(\w+)\}/g, (whole, key: string) =>
			isPlaceholder(key) ? (values[key] ?? '') : whole
		)
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/** The GSM-7 basic character set: a message of only these is sent at 160 a segment. */
const GSM7 =
	'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

/** How many segments a message is sent as, and how it is encoded. */
export function smsSegments(text: string): { segments: number; encoding: 'gsm7' | 'ucs2' } {
	const chars = [...text];
	const gsm = chars.every((c) => GSM7.includes(c));
	const [single, part] = gsm ? [160, 153] : [70, 67];
	// UCS-2 counts code units; every Ethiopic character is one.
	const length = gsm ? chars.length : text.length;
	if (length === 0) return { segments: 0, encoding: gsm ? 'gsm7' : 'ucs2' };
	return {
		segments: length <= single ? 1 : Math.ceil(length / part),
		encoding: gsm ? 'gsm7' : 'ucs2'
	};
}

/** Where a patient stands for a text: already texted, asked not to be, unreachable, or ready. */
export type TextState = 'texted' | 'optedOut' | 'noMobile' | 'ready';

/**
 * A row's text state, by the rule `sendSms` refuses with — so a list never offers a send the
 * server will skip. A text already sent is shown whatever else is true: it happened.
 */
export function textState(
	phone: string | null | undefined,
	optedOut: boolean,
	textedAt: Date | string | null
): TextState {
	if (textedAt) return 'texted';
	if (optedOut) return 'optedOut';
	return ethiopianMobile(phone) ? 'ready' : 'noMobile';
}

/**
 * An Ethiopian mobile number in international form, `2519XXXXXXXX` or `2517XXXXXXXX`, from however
 * the front desk typed it — "0911 23 45 67", "+251 911 234567", "911234567". Null for anything that
 * is not an Ethiopian mobile (a landline, a foreign number, a typo), which is then not texted.
 */
export function ethiopianMobile(phone: string | null | undefined): string | null {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, '');
	const local = digits.startsWith('251')
		? digits.slice(3)
		: digits.startsWith('0')
			? digits.slice(1)
			: digits;
	// Ethio telecom mobiles start 9, Safaricom's 7; both are nine digits after the country code.
	return /^[79]\d{8}$/.test(local) ? `251${local}` : null;
}
