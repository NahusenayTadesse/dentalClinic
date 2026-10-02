/**
 * The front-desk patient screens' words: the list, registration, the chart's header and tabs,
 * the overview, the patient picker and the merge section.
 *
 * The clinical tabs (dental chart, plans, notes, prescriptions, files, consents, lab work, access
 * log) are not here yet; they are translated as their own area.
 */
export const patients = {
	sex: { male: 'Male', female: 'Female' },
	/** The list's age bands, by `AGE_BANDS` value. */
	ageBands: {
		child: 'Under 13',
		teen: '13–17',
		adult: '18–39',
		middle: '40–64',
		senior: '65 and over',
		unknown: 'No birth date'
	},
	/** Whether the medical history was taken, by `HISTORY_STATES` value. */
	history: { never: 'Never taken', stale: 'Over a year old', current: 'Current' },
	/** The alerts, by `ALERTS` key — the list's facet and the chart header's badges. */
	alerts: {
		severeAllergy: 'Severe allergy',
		anyAllergy: 'Any allergy',
		bleedingRisk: 'Bleeding-risk medicine',
		osteonecrosisRisk: 'Bone-risk medicine',
		immunosuppressed: 'Immunosuppressed',
		noPhone: 'No phone number'
	},
	/** Why a record may be the same person, by the reason `possibleDuplicates` gives. */
	duplicateReasons: {
		'Same name and phone number': 'Same name and phone number',
		'Same name and father’s name': 'Same name and father’s name',
		'Same phone number': 'Same phone number'
	},
	file: (fileNo: string) => `File ${fileNo}`,
	noFileNumber: 'No file number',
	otherBranch: 'Other branch',
	notFromHere: 'This patient is not from this branch, but can be treated here.',
	notRecorded: 'Not recorded',
	payAtDesk: 'Pays at the desk',

	list: {
		title: 'Patients',
		register: 'Register a patient',
		emptyHere: 'No patients registered at this branch',
		emptyAll: 'No patients registered yet',
		elsewhere: (count: string) =>
			`${count} registered at other branches. Search by name or phone to find one — searches cover every branch.`,
		searching:
			'Searching every branch. Patients from elsewhere are marked, and can be treated here.',
		browsing:
			'Showing patients registered at this branch. Search by name, file number or phone to look across every branch.',
		registered: 'Registered',
		facets: {
			sex: 'Sex',
			age: 'Age',
			bloodType: 'Blood type',
			alerts: 'Alerts',
			allergies: 'Allergy',
			conditions: 'Condition',
			history: 'Medical history',
			referral: 'Heard of us',
			payer: 'Who pays'
		},
		columns: {
			patient: 'Patient',
			sex: 'Sex',
			age: 'Age',
			phone: 'Phone',
			alerts: 'Alerts',
			allergies: 'Allergies',
			conditions: 'Conditions',
			blood: 'Blood',
			history: 'History',
			referral: 'Heard of us',
			payer: 'Pays',
			registered: 'Registered',
			owes: 'Owes'
		},
		atTheDesk: 'At the desk'
	},

	register: {
		title: 'Register a patient',
		description:
			'Only the given name, father’s name and sex are required. Record what the patient can tell you now — the rest can be added on their chart.',
		duplicateTitle: 'This may be a patient who is already registered',
		duplicateHelp:
			'If one of these is the person in front of you, open their chart instead. If not, confirm below and register again.',
		notDuplicate: 'Not a duplicate',
		notDuplicateConfirm: 'I have checked — this is a different person',
		who: 'Who they are',
		givenName: 'Given name',
		fatherName: 'Father’s name',
		grandFatherName: 'Grandfather’s name',
		sex: 'Sex',
		fileNo: 'File number',
		fileNoPlaceholder: 'Leave empty if not assigned yet',
		bloodType: 'Blood type',
		birthDate: 'Birth date',
		knowsBirthDate: 'The patient knows their date of birth',
		dateOfBirth: 'Date of birth',
		approxAge: 'Approximate age',
		approxAgeHint: 'Saved as an estimated birth date, and shown with a ~.',
		reach: 'How to reach them',
		phone: 'Phone',
		altPhone: 'Second phone',
		health: 'Health',
		allergiesReported: 'Allergies the patient reports',
		allergiesNote: 'Recorded as severity “unknown”. A clinician grades each one on the chart.',
		otherNotes: 'Other medical notes',
		otherNotesPlaceholder: 'Anything that is not an allergy, condition or medicine',
		howCame: 'How they came, and who pays',
		heardThrough: 'Heard of us through',
		referredBy: 'Referred by',
		referredByPlaceholder: 'Dr Tesfaye at Bethel, her sister Almaz…',
		billedTo: 'Billed to',
		billedToHint: 'An employer or insurer. Leave empty when the patient pays at the desk.',
		registering: 'Registering',
		submit: 'Register patient'
	},

	/** What the desk is told after a save on these screens. */
	toast: {
		checkForm: 'Please check the form for errors',
		mayBeDuplicate: (count: number) =>
			`This may be someone already registered — ${count === 1 ? 'one patient matches' : `${count} patients match`}.`,
		fileNoTaken: 'Another patient already has this file number.',
		fileNoInUse: 'That file number is already in use.',
		registerFailed: 'Could not register the patient. Please try again.',
		registered: (name: string) => `${name} registered.`,
		saveFailed: 'Could not save. Please try again.',
		detailsUpdated: 'Details updated',
		reachUpdated: 'Contact and billing updated',
		historyTaken: 'History recorded as taken today',
		notesUpdated: 'Medical notes updated',
		merged: (rows: number) =>
			`Merged. ${rows} record${rows === 1 ? '' : 's'} moved to this chart; the old file number now leads here.`
	},

	chart: {
		ageNotRecorded: 'Age not recorded',
		ageYears: (age: number, estimated: boolean) => `${estimated ? 'About ' : ''}${age} years`,
		blood: (type: string) => `Blood ${type}`,
		owes: (amount: string) => `Owes ${amount}`,
		notFromHere: (branch: string) =>
			`This patient is not from this branch (${branch}), but can be treated here.`,
		registeredElsewhere: 'registered elsewhere',
		mergedFrom:
			'You followed a record that was merged into this one. This is the patient’s current chart.',
		medicalAlerts: 'Medical alerts',
		severeAllergy: (name: string) => `Severe allergy: ${name}`,
		allergy: (name: string) => `Allergy: ${name}`,
		noHistory: 'No medical history has been taken.',
		noHistoryWhy:
			'An empty allergy list here means nobody has asked yet — not that there are none.',
		staleHistory: (date: string) =>
			`The medical history is over a year old (taken ${date}). Ask again before treatment.`,
		record: 'Patient record',
		tabs: {
			overview: 'Overview',
			chart: 'Dental chart',
			perio: 'Gums',
			plans: 'Treatment plans',
			notes: 'Notes',
			prescriptions: 'Prescriptions',
			files: 'Files',
			consents: 'Consents',
			lab: 'Lab work',
			billing: 'Billing',
			access: 'Access log'
		}
	},

	overview: {
		pageTitle: (name: string) => `${name} — Patient`,
		notRecordedShort: 'Not recorded',
		ageYears: (age: number, estimated: boolean) => `${estimated ? 'About ' : ''}${age} years`,
		estimatedFromAge: ' (estimated from age)',
		notAssigned: 'Not assigned',
		notAsked: 'Not asked',
		unknown: 'Unknown',
		neverUpdated: 'Never updated',
		rows: {
			fullName: 'Full name',
			fileNo: 'File number',
			sex: 'Sex',
			birthDate: 'Birth date',
			age: 'Age',
			bloodType: 'Blood type',
			phone: 'Phone',
			altPhone: 'Second phone',
			memberNo: 'Member number',
			memberNoPlaceholder: 'Their policy or member number with the payer',
			textMessages: 'Text messages',
			textsYes: 'Reminders and recalls may be texted',
			textsNo: 'Asked not to be texted',
			textsOptOut: 'The patient asked not to be sent text messages',
			heardThrough: 'Heard of us through',
			referredBy: 'Referred by',
			billedTo: 'Billed to',
			registeredAt: 'Registered at',
			nextAppointment: 'Next appointment',
			lastVisit: 'Last visit',
			visits: 'Visits',
			openPlans: 'Open treatment plans',
			prescriptions: 'Prescriptions',
			billed: 'Billed',
			paid: 'Paid',
			balance: 'Balance',
			filesNotesConsents: 'Files · notes · consents',
			registeredOn: 'Registered on',
			registeredBy: 'Registered by',
			lastUpdated: 'Last updated',
			lastUpdatedBy: 'Last updated by'
		},
		visitCounts: (completed: number, booked: number, noShows: number) =>
			`${completed} completed of ${booked} booked · ${noShows} no-shows`,
		sections: {
			personal: 'Personal details',
			editPersonal: 'Edit personal details',
			reach: 'Reaching them, and billing',
			editReach: 'Edit contact and billing',
			history: 'Medical history',
			allergies: 'Allergies',
			conditions: 'Conditions',
			medications: 'Medications',
			contacts: 'Other contacts',
			emergency: 'Emergency contacts',
			appointments: 'Appointments',
			clinical: 'Clinical record',
			system: 'System information',
			views: 'Who opened this chart'
		},
		historyNotes: 'Notes',
		historyNotesPlaceholder:
			'Family history, past surgery — anything that is not an allergy, condition or medicine',
		historyMark: 'History',
		historyMarkConfirm: 'I asked the medical history questions today',
		historyTaken: (date: string, by: string | null) => `Taken ${date}${by ? ` by ${by}` : ''}.`,
		historyNever: 'Never taken.',
		noOtherNotes: 'No other notes.',
		bookAppointment: 'Book appointment',
		nextDue: 'Next due back:',
		aVisit: 'A visit',
		booked: 'Booked',
		overdue: 'Overdue',
		noRecall: 'No recall is set for this patient.',
		appointment: 'Appointment',
		noAppointments: 'No appointments yet.',
		deletedUser: 'Deleted user',
		noBranch: 'no branch',
		noViews: 'No views recorded.',
		wholeAccessLog: 'The whole access log →',
		/** An appointment's status, by `APPOINTMENT_STATUSES` value. */
		appointmentStatus: {
			scheduled: 'Scheduled',
			confirmed: 'Confirmed',
			arrived: 'Arrived',
			inChair: 'In chair',
			completed: 'Completed',
			noShow: 'No-show',
			cancelled: 'Cancelled'
		}
	},

	/** The child sections' tables and forms (`configs.ts`). */
	sections: {
		allergy: {
			entity: 'Allergy',
			plural: 'Allergies',
			allergen: 'Allergen',
			severity: 'Severity',
			severe: 'Severe',
			moderate: 'Moderate',
			mild: 'Mild',
			notAssessed: 'Not assessed',
			reaction: 'Reaction',
			reactionPlaceholder: 'Hives, swelling, anaphylaxis…'
		},
		condition: {
			entity: 'Condition',
			plural: 'Conditions',
			condition: 'Condition',
			status: 'Status',
			active: 'Active',
			suspected: 'Suspected',
			inRemission: 'In remission',
			resolved: 'Resolved',
			resolvedOn: 'Resolved on',
			note: 'Note'
		},
		medication: {
			entity: 'Medication',
			plural: 'Medications',
			asReported: 'Medicine (as the patient says it)',
			asReportedPlaceholder: 'Coumadin, "the blood thinner"…',
			formulary: 'Matches formulary medicine',
			dose: 'Dose',
			dosePlaceholder: '5 mg',
			frequency: 'How often',
			frequencyPlaceholder: 'Once daily',
			status: 'Status',
			taking: 'Taking',
			stopped: 'Stopped',
			notSure: 'Not sure',
			stoppedOn: 'Stopped on',
			note: 'Note'
		},
		contact: {
			entity: 'Contact',
			plural: 'Contacts',
			detail: 'Detail',
			detailPlaceholder: 'Email, username or number',
			kind: 'Kind',
			label: 'Label',
			labelPlaceholder: 'Work, home…',
			primary: 'Primary'
		},
		emergency: {
			entity: 'Emergency contact',
			plural: 'Emergency contacts',
			name: 'Name',
			relation: 'Relation',
			relationPlaceholder: 'Mother',
			phone: 'Phone',
			altPhone: 'Second phone',
			callFirst: 'Call first'
		}
	},

	picker: {
		label: 'Patient',
		change: 'Choose a different patient',
		placeholder: 'Name, file number or phone',
		searching: 'Searching…',
		none: 'No patient matches. Register them first from Patients → Register a patient.'
	},

	merge: {
		title: 'Duplicate records',
		find: 'Find another record',
		intoThis: 'Merge into this chart',
		confirmTitle: (who: string) => `Merge ${who} into this chart?`,
		confirmText:
			'Everything on that record — visits, treatment, bills, notes, allergies — moves here, and it becomes a pointer to this chart. Its file number will lead here. This is recorded and is not undone from the screen.',
		confirm: 'Merge',
		none: 'No other record shares this name or phone number. If this patient was registered twice under a different spelling, find the other record by name.',
		pickTitle: 'Merge another record into this chart',
		pickText:
			'The record you choose moves here and becomes a pointer to this chart. Check it is the same person first.'
	}
};
