/**
 * How the patient access log's record types and actions read on screen. One map for the chart's
 * "who opened this", its Access log tab and the System report's ledger, so a part of the chart is
 * called the same thing wherever somebody asks who looked at it.
 *
 * Keyed by string rather than by the schema's enum, which client code cannot import: an unknown
 * type falls back to its own name rather than failing, so a new record type shows up — named
 * plainly — before anyone remembers to label it here.
 */
export const VIEWED_RECORD_LABEL: Record<string, string> = {
	summary: 'Overview',
	allergies: 'Allergies',
	conditions: 'Conditions',
	medications: 'Medications',
	note: 'Notes',
	prescription: 'Prescriptions',
	file: 'Files',
	procedure: 'Dental chart',
	treatmentPlan: 'Treatment plans',
	invoice: 'Billing',
	consent: 'Consents',
	labCase: 'Lab work',
	perio: 'Periodontal chart',
	ortho: 'Orthodontics'
};

/** What was done: opened on screen, or printed — paper that has left the building. */
export const VIEW_ACTION_LABEL: Record<string, string> = { view: 'Opened', print: 'Printed' };

/** The parts of the chart in Amharic, for the overview's "who opened this" in an Amharic screen. */
const VIEWED_RECORD_LABEL_AM: Record<string, string> = {
	summary: 'አጠቃላይ እይታ',
	allergies: 'አለርጂዎች',
	conditions: 'ሕመሞች',
	medications: 'መድኃኒቶች',
	note: 'ማስታወሻዎች',
	prescription: 'የመድኃኒት ማዘዣዎች',
	file: 'ፋይሎች',
	procedure: 'የጥርስ ገበታ',
	treatmentPlan: 'የሕክምና ዕቅዶች',
	invoice: 'ክፍያ',
	consent: 'ስምምነቶች',
	labCase: 'የላብራቶሪ ሥራ',
	perio: 'የድድ ገበታ',
	ortho: 'ኦርቶዶንቲክስ'
};

/** "Opened Dental chart", "Printed Billing" — or, in Amharic, "የጥርስ ገበታ ተከፍቷል". */
export function viewedLabel(action: string, recordType: string, lang: 'en' | 'am' = 'en'): string {
	if (lang === 'am') {
		const part =
			VIEWED_RECORD_LABEL_AM[recordType] ?? VIEWED_RECORD_LABEL[recordType] ?? recordType;
		return `${part} ${action === 'print' ? 'ታትሟል' : 'ተከፍቷል'}`;
	}
	return `${VIEW_ACTION_LABEL[action] ?? action} ${VIEWED_RECORD_LABEL[recordType] ?? recordType}`;
}
