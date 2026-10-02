/**
 * The words on paper a patient fills in or signs: the medical-history questionnaire and the frame
 * around a consent form. A consent's own wording is the clinic's, kept in `consent_template`.
 *
 * Printed in the language the patient reads, which is chosen when printing — not the interface's.
 */
export const forms = {
	patient: 'Patient',
	fileNo: 'File number',
	dateOfBirth: 'Date of birth',
	phone: 'Phone',
	date: 'Date',
	signature: 'Signature',
	name: 'Name',

	consent: {
		title: (type: string) => `Consent — ${type}`,
		treatment: 'Treatment',
		clinician: 'Clinician',
		patientSigns: 'Signature of the patient',
		guardianSigns:
			'For a child or a patient who cannot sign: name and signature of the parent or guardian',
		relationship: 'Relationship to the patient',
		witness: 'Witness: name and signature',
		clinicianSigns: 'Clinician: name and signature',
		types: {
			treatment: 'Dental treatment',
			surgical: 'Surgery or extraction',
			anaesthetic: 'Local anaesthetic or sedation',
			radiograph: 'Radiographs',
			photography: 'Clinical photographs',
			dataSharing: 'Sharing records'
		}
	},

	history: {
		title: 'Medical history',
		intro:
			'Your dentist needs to know about your health: some illnesses and medicines change how dental treatment is done safely. Please answer every question. What you write is kept confidential.',
		yes: 'Yes',
		no: 'No',
		details: 'If yes, please give details',
		onRecord: 'What we have on record — please correct anything that is wrong',
		allergies: 'Allergies',
		conditions: 'Conditions',
		medications: 'Medicines you take',
		none: 'None recorded',
		otherMedicines: 'Any other medicines, including herbal and traditional remedies',
		declaration:
			'I have answered these questions truthfully, to the best of my knowledge. I will tell the clinic if my health or my medicines change.',
		questions: {
			heart: 'Heart disease, a heart murmur, or an artificial heart valve?',
			bloodPressure: 'High blood pressure?',
			diabetes: 'Diabetes?',
			bleeding: 'Do you bleed for a long time after a cut, or have a bleeding disorder?',
			bloodThinners:
				'Do you take medicine that thins the blood, such as warfarin, aspirin or clopidogrel?',
			asthma: 'Asthma or another lung disease?',
			epilepsy: 'Epilepsy or fits?',
			liver: 'Hepatitis, jaundice or another liver disease?',
			kidney: 'Kidney disease?',
			immune: 'An illness or medicine that weakens the immune system, including HIV?',
			tuberculosis: 'Tuberculosis, now or in the past?',
			cancer: 'Cancer, radiotherapy to the head or neck, or chemotherapy?',
			boneMedicine: 'Medicine for the bones, such as alendronate or zoledronic acid?',
			steroids: 'Steroid tablets or injections in the last year?',
			allergy: 'An allergy to any medicine (such as penicillin), to latex, or to anaesthetic?',
			anaesthetic: 'A bad reaction to a dental injection or an anaesthetic?',
			pregnant: 'Are you pregnant or breastfeeding?',
			hospital: 'Have you been in hospital or had an operation in the last two years?',
			tobacco: 'Do you smoke, or chew khat?',
			other: 'Any other illness or condition we should know about?'
		}
	}
};
