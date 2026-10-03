/**
 * A patient's phone in the form each gateway wants. All start from `ethiopianMobile`, so a number
 * the SMS module would refuse is not sent to a gateway either — it is left off, and the patient
 * types it on the gateway's page.
 */
import { ethiopianMobile } from '$lib/smsTemplates';

/** `0911…` — Chapa's form. */
export function localMobile(phone: string | null): string | null {
	const intl = ethiopianMobile(phone);
	return intl ? `0${intl.slice(3)}` : null;
}

/** `251911…` — ArifPay's and Telebirr's form. */
export function internationalMobile(phone: string | null): string | null {
	return ethiopianMobile(phone);
}

/** `+251911…` — SantimPay's form. */
export function plusMobile(phone: string | null): string | null {
	const intl = ethiopianMobile(phone);
	return intl ? `+${intl}` : null;
}
