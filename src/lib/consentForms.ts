/**
 * Consent forms on paper: the kinds of consent, the placeholders a clinic's wording may use, and
 * the wording a clinic starts with. Client-safe and relative-imports only — the schema reads
 * `CONSENT_TYPES`, and drizzle-kit loads the schema without SvelteKit's aliases.
 *
 * **The wording is the clinic's.** What a consent must say is a matter for the clinic and its
 * lawyer, not for software, so the defaults below are a starting point written in plain language,
 * kept in `consent_template` where a clinic can change them (Clinic Setup → Consent Forms). Each is
 * in English and Amharic, and the form prints in whichever the patient reads.
 *
 * Signing the paper is not recording the consent: the signed sheet is photographed onto the Files
 * tab and recorded on the Consents tab, as before. This only puts the right words in front of the
 * patient.
 *
 * Non-goals: signing on a screen (a tablet signature here is not yet what a court or the ministry
 * recognises), and other languages — Afaan Oromo and Tigrinya are a row each when a clinic needs
 * them, once the interface itself speaks them.
 */
import { fillPlaceholders } from './placeholders';

/** The kinds of consent, as `patient_consent.consent_type` lists them. */
export const CONSENT_TYPES = [
	'treatment',
	'surgical',
	'anaesthetic',
	'radiograph',
	'photography',
	'dataSharing'
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Whether a value is one of the kinds. */
export function isConsentType(value: unknown): value is ConsentType {
	return typeof value === 'string' && (CONSENT_TYPES as readonly string[]).includes(value);
}

/** What a consent's wording may name, and what each becomes on the printed form. */
export const CONSENT_PLACEHOLDERS = {
	patient: "The patient's full name",
	clinic: "The branch's name",
	treatment: 'The treatment chosen when printing, with its tooth',
	clinician: 'The clinician chosen when printing'
} as const;
export type ConsentPlaceholder = keyof typeof CONSENT_PLACEHOLDERS;

const KEYS = Object.keys(CONSENT_PLACEHOLDERS) as ConsentPlaceholder[];

/**
 * A consent's wording with its placeholders filled. A treatment or clinician not chosen is a blank
 * line to write on, not a gap: the paper is still signed in front of someone who can fill it in.
 */
export function fillConsent(
	body: string,
	values: Partial<Record<ConsentPlaceholder, string | null>>
): string {
	const blank = '________________';
	return fillPlaceholders(
		body,
		{
			...values,
			treatment: values.treatment || blank,
			clinician: values.clinician || blank
		},
		KEYS
	);
}

/** The wording a clinic starts with, one per kind, in both languages. */
export const DEFAULT_CONSENT_TEMPLATES: {
	consentType: ConsentType;
	name: string;
	bodyEn: string;
	bodyAm: string;
}[] = [
	{
		consentType: 'treatment',
		name: 'Dental treatment',
		bodyEn:
			'I, {patient}, agree to dental treatment at {clinic}: {treatment}.\n\nThe treatment, what it is for, and the other choices — including having no treatment — have been explained to me by {clinician}. I understand that the plan may need to change once treatment starts, and that I will be told if it does. I have been able to ask questions, and they have been answered.\n\nI understand the cost I have been quoted, and that I may withdraw this consent at any time before treatment.',
		bodyAm:
			'እኔ {patient}፣ በ{clinic} የጥርስ ሕክምና ለማድረግ ተስማምቻለሁ፦ {treatment}።\n\nሕክምናው፣ ለምን እንደሚደረግ እና ሌሎች አማራጮች — ሕክምና አለማድረግንም ጨምሮ — በ{clinician} ተብራርተውልኛል። ሕክምናው ከተጀመረ በኋላ ዕቅዱ ሊቀየር እንደሚችልና ከተቀየረ እንደሚነገረኝ ተረድቻለሁ። ጥያቄዎችን ለመጠየቅ ዕድል አግኝቻለሁ፣ መልስም ተሰጥቶኛል።\n\nየተነገረኝን ዋጋ ተረድቻለሁ፤ ሕክምናው ከመጀመሩ በፊት በማንኛውም ጊዜ ይህንን ስምምነት ማንሳት እንደምችል አውቃለሁ።'
	},
	{
		consentType: 'surgical',
		name: 'Surgery or extraction',
		bodyEn:
			'I, {patient}, agree to the following surgery or extraction at {clinic}: {treatment}.\n\n{clinician} has explained why it is needed and the other choices. I understand the risks, which include pain, swelling, bleeding, infection, a dry socket, damage to nearby teeth or fillings, and — rarely — numbness of the lip, chin or tongue that may last a long time, or an opening into the sinus from an upper tooth.\n\nI will follow the care instructions I am given, and return or call if bleeding, swelling or pain gets worse.',
		bodyAm:
			'እኔ {patient}፣ በ{clinic} የሚከተለውን ቀዶ ሕክምና ወይም ጥርስ ማውጣት ለማድረግ ተስማምቻለሁ፦ {treatment}።\n\n{clinician} ለምን እንደሚያስፈልግና ሌሎች አማራጮችን አብራርተውልኛል። ሊያጋጥሙ የሚችሉ ችግሮችን ተረድቻለሁ፦ ሕመም፣ እብጠት፣ ደም መፍሰስ፣ ኢንፌክሽን፣ ደረቅ ሶኬት፣ በአጠገብ ባሉ ጥርሶች ወይም ሙሌቶች ላይ ጉዳት፣ እና — አልፎ አልፎ — ለረጅም ጊዜ ሊቆይ የሚችል የከንፈር፣ የአገጭ ወይም የምላስ መደንዘዝ፣ ወይም ከላይኛው ጥርስ ወደ ሳይነስ መከፈት።\n\nየተሰጠኝን የእንክብካቤ መመሪያ እከተላለሁ፤ ደም መፍሰስ፣ እብጠት ወይም ሕመም ከተባባሰ እመለሳለሁ ወይም እደውላለሁ።'
	},
	{
		consentType: 'anaesthetic',
		name: 'Local anaesthetic or sedation',
		bodyEn:
			'I, {patient}, agree to local anaesthetic (an injection to numb the area) or sedation for {treatment} at {clinic}.\n\nI have told {clinician} about my health, my medicines and any allergy. I understand that the numbness lasts a few hours, that I must not bite or chew on the numb side until it wears off, and that rarely an injection causes bruising, a fast heartbeat, or numbness that lasts longer.\n\nIf I am sedated, an adult will take me home and stay with me, and I will not drive or sign anything important for the rest of the day.',
		bodyAm:
			'እኔ {patient}፣ በ{clinic} ለ{treatment} የማደንዘዣ መርፌ (አካባቢውን የሚያደነዝዝ) ወይም ማስታገሻ እንዲሰጠኝ ተስማምቻለሁ።\n\nስለ ጤናዬ፣ ስለምወስዳቸው መድኃኒቶችና ስላለብኝ አለርጂ ለ{clinician} ነግሬያለሁ። መደንዘዙ ለጥቂት ሰዓታት እንደሚቆይ፣ እስኪለቅ ድረስ በደነዘዘው ወገን መንከስ ወይም ማኘክ እንደሌለብኝ፣ እና አልፎ አልፎ መርፌው መሰንበር፣ የልብ ምት መፍጠን ወይም ረዘም ያለ መደንዘዝ ሊያስከትል እንደሚችል ተረድቻለሁ።\n\nማስታገሻ ከተሰጠኝ አንድ አዋቂ ሰው ወደ ቤት ወስዶኝ አብሮኝ ይቆያል፤ በቀሪው ቀን መኪና አልነዳም ወይም አስፈላጊ ሰነድ አልፈርምም።'
	},
	{
		consentType: 'radiograph',
		name: 'Radiographs',
		bodyEn:
			'I, {patient}, agree to dental radiographs (X-rays) at {clinic} as {clinician} advises.\n\nI understand that dental radiographs use a very small dose of radiation, that they show what cannot be seen by looking, and that they are kept as part of my record. I have said whether I am, or may be, pregnant.',
		bodyAm:
			'እኔ {patient}፣ {clinician} በሚመክሩት መሠረት በ{clinic} የጥርስ ራጅ (ኤክስሬይ) እንዲነሳልኝ ተስማምቻለሁ።\n\nየጥርስ ራጅ በጣም አነስተኛ የጨረር መጠን እንደሚጠቀም፣ በዓይን የማይታየውን እንደሚያሳይ እና የመዝገቤ አካል ሆኖ እንደሚቀመጥ ተረድቻለሁ። ነፍሰ ጡር መሆኔን ወይም ልሆን እንደምችል ተናግሬያለሁ።'
	},
	{
		consentType: 'photography',
		name: 'Clinical photographs',
		bodyEn:
			'I, {patient}, agree that {clinic} may take photographs of my mouth and face for my record and to plan my treatment.\n\nThe photographs are kept with my record and are not shown to anyone outside my care without my further written permission. I may withdraw this consent at any time.',
		bodyAm:
			'እኔ {patient}፣ {clinic} ለመዝገቤና ሕክምናዬን ለማቀድ የአፌንና የፊቴን ፎቶግራፍ እንዲያነሳ ተስማምቻለሁ።\n\nፎቶግራፎቹ ከመዝገቤ ጋር ይቀመጣሉ፤ ያለ ተጨማሪ የጽሑፍ ፈቃዴ ከሕክምናዬ ውጪ ላለ ማንም አይታዩም። ይህንን ስምምነት በማንኛውም ጊዜ ማንሳት እችላለሁ።'
	},
	{
		consentType: 'dataSharing',
		name: 'Sharing records',
		bodyEn:
			'I, {patient}, agree that {clinic} may share my dental record — notes, radiographs and treatment — with: ________________________________, for: ________________________________.\n\nNothing else is shared, and only for this purpose. I may withdraw this consent at any time, in writing.',
		bodyAm:
			'እኔ {patient}፣ {clinic} የጥርስ መዝገቤን — ማስታወሻዎች፣ ራጆችና ሕክምናዎች — ለ________________________________ ለ________________________________ ዓላማ እንዲያጋራ ተስማምቻለሁ።\n\nከዚህ ውጪ ምንም አይጋራም፣ ለዚህ ዓላማ ብቻ። ይህንን ስምምነት በማንኛውም ጊዜ በጽሑፍ ማንሳት እችላለሁ።'
	}
];
