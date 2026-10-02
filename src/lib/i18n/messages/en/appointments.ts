import type { AppointmentStatus } from '$lib/appointmentStatus';

/**
 * The diary's words: the day view and its dialogs, the appointment list, reminders and recalls,
 * and what their actions answer. Status names live here rather than `STATUS_LABEL`, which the
 * server keeps in English for its own sentences.
 */
const status: Record<AppointmentStatus, string> = {
	scheduled: 'Scheduled',
	confirmed: 'Confirmed',
	arrived: 'Arrived',
	inChair: 'In chair',
	completed: 'Completed',
	noShow: 'No-show',
	cancelled: 'Cancelled'
};

/** What the button that moves an appointment into each status says. */
const action: Record<AppointmentStatus, string> = {
	scheduled: 'Undo arrival',
	confirmed: 'Mark confirmed',
	arrived: 'Mark arrived',
	inChair: 'Seat in chair',
	completed: 'Complete visit',
	noShow: 'Mark no-show',
	cancelled: 'Cancel'
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

import { HOURS_WORDS_EN } from '$lib/providerHours';

export const appointments = {
	status,
	action,
	day: {
		title: 'Appointments',
		previousDay: 'Previous day',
		nextDay: 'Next day',
		goToDate: 'Go to date',
		list: 'List',
		walkIn: 'Walk-in',
		book: 'Book',
		needsBranchTitle: 'Choose a branch in the top bar to see its day.',
		needsBranchBody: 'The day view is drawn by chair, and chairs belong to a branch. The',
		needsBranchLink: 'appointment list',
		needsBranchEnd: 'shows every branch.',
		closed: (name: string) =>
			`The clinic is closed today: ${name}. New bookings on this day are refused.`,
		count: (n: number) => plural(n, 'appointment', 'appointments'),
		noChairsTitle: 'This branch has no chairs yet.',
		noChairsBody: 'The day view has a column per chair. Add them under',
		noChairsLink: 'Admin Panel → Chairs',
		waiting: (n: number) => `Waiting (${n})`,
		nobodyWaiting: 'Nobody waiting.',
		inChair: (n: number) => `In the chair (${n})`,
		nobodyInChair: 'No one in a chair.',
		couldComeEarlier: 'Could come earlier',
		minutes: (n: number) => `${n} min`
	},
	grid: {
		noChair: 'No chair',
		clickToBook: 'Click an empty time to book',
		labOverdue: 'Lab work overdue',
		labBack: 'Lab work back to fit',
		appointment: 'Appointment'
	},
	book: {
		titleBook: 'Book an appointment',
		titleWalkIn: 'Add a walk-in',
		descBook: 'The chair and the dentist are checked for clashes, and closed days are refused.',
		descWalkIn: 'The patient is here now. The appointment starts now and is marked arrived.',
		planHeading: 'Booked for the agreed treatment:',
		planNote: 'It is reserved to this visit and ticked when the visit is completed.',
		walkIn: 'Walk-in',
		walkInHint: 'The patient is here now',
		whatFor: 'What for',
		firstVisit: 'First visit',
		firstVisitHint: 'First visit to the clinic',
		shortNotice: 'Short notice',
		shortNoticeHint: 'Will come earlier if a slot frees up',
		hoursTitle: 'The dentist is not working then',
		bookAnyway: 'Book anyway',
		submitBook: 'Book',
		submitWalkIn: 'Add walk-in'
	},
	dialog: {
		severeAllergy: (name: string) => `Severe allergy: ${name}`,
		labReady: (n: number) => `Lab work back — ready to fit (${n})`,
		labOverdue: (n: number) => `Overdue from the lab (${n})`,
		labOut: (n: number) => `At the lab (${n})`,
		file: 'File',
		notGiven: 'Not given',
		arrived: 'Arrived',
		waited: (gap: string) => `waited ${gap}`,
		finished: 'Finished',
		inChairFor: (gap: string) => `in chair ${gap}`,
		cancelled: 'Cancelled',
		patientChart: 'Patient chart',
		move: 'Move',
		cancelAppointment: 'Cancel appointment',
		moving: 'Moving',
		moveAppointment: 'Move appointment',
		cancelReason: 'Why is it cancelled?',
		cancelling: 'Cancelling'
	},
	complete: {
		heading: 'Work done at this visit',
		noClinical:
			'Recording the work needs clinical access. The visit can still be completed; the dentist charts the work.',
		usualFor: (type: string) => `Usual for ${type}`,
		thisVisit: 'this visit',
		planned: 'Planned for this patient',
		retiredService: 'Retired service',
		wholeMouth: 'whole mouth',
		nothingPlanned:
			'Nothing is planned for this patient. Work done on a tooth is charted on the dental chart.',
		completing: 'Completing',
		submit: 'Complete visit'
	},
	list: {
		title: 'Appointment list',
		dayView: 'Day view',
		when: 'When',
		whatFor: 'What for',
		flags: 'Flags',
		notGiven: 'Not given',
		noChair: 'No chair',
		firstVisit: 'First visit',
		shortNotice: 'Short notice'
	},
	reminders: {
		title: 'Reminders',
		intro:
			'Appointments at this branch still to come on one day. Ring each patient and record it here, so nobody is rung twice and the clinic can see whether reminding cuts no-shows.',
		tileAppointments: 'Appointments',
		tileLeft: 'Left to remind',
		tileConfirmed: 'Confirmed',
		tileEffect: 'No-shows when reminded',
		notEnough: (days: number) => `Not enough visits in the last ${days} days to compare`,
		against: (rate: number, reminded: number, notReminded: number, days: number) =>
			`Against ${rate}% when not reminded · ${reminded} and ${notReminded} visits, last ${days} days`,
		whichDay: 'Which day',
		empty: 'No appointments still to come at this branch on this day.',
		dialogTitle: (who: string) => `Reminded ${who}`,
		dialogDescription: 'Record that the patient has been reminded of this appointment.',
		recordIt: 'Record it',
		confirmed: 'Confirmed',
		confirmedHint: 'They said they will come',
		reminded: 'Reminded',
		notReminded: 'Not reminded',
		notYet: 'Not yet',
		todayAt: (clock: string) => `Today, ${clock}`,
		remindAgain: 'Remind again'
	},
	recalls: {
		title: 'Recalls',
		intro:
			'Patients due back at this branch who have not booked. A check-up completed in the diary adds the next one here by itself.',
		tileDue: 'Due in this window',
		tileOverdue: 'Overdue',
		tileBooked: 'Booked',
		tileCameBack: 'Came back when asked',
		notLongEnough: 'Nobody has been due long enough to tell',
		dueBack: 'Due back',
		howFarAhead: 'How far ahead',
		window: (days: number) => (days === 0 ? 'Overdue only' : `Next ${days} days`),
		empty: 'Nobody at this branch is due back in this window.',
		logCallTitle: (who: string) => `Log a call to ${who}`,
		logIt: 'Log it',
		howItWent: 'How it went',
		outcomeNoAnswer: 'No answer — try again',
		outcomeCallBack: 'Spoke — they will call back or asked to be rung later',
		outcomeDeclined: 'Declined — do not ring again for this',
		outcomeStopped: 'Stop — moved away, treated elsewhere, or died',
		notePlaceholder: 'Ring after 5pm · wants a Saturday',
		due: 'Due',
		overdueSuffix: ' · overdue',
		lastVisit: 'Last visit',
		calls: 'Calls',
		notRungYet: 'Not rung yet',
		triedEnough: 'Tried enough',
		rung: 'Rung',
		callsCell: (n: number, date: string) => `${n}× · last ${date}`,
		logACall: 'Log a call',
		book: 'Book'
	},
	/** What the actions answer: toasts and refusals the desk reads. */
	/** The dentist-hours warning (`$lib/providerHours.ts`). */
	hours: HOURS_WORDS_EN,
	/** Why a slot cannot be booked (`bookingProblems` in `server/appointments.ts`). */
	refusals: {
		closed: (closure: string) => `The clinic is closed that day (${closure}).`,
		chairGone: 'That chair no longer exists.',
		chairElsewhere: (chair: string) => `${chair} is at another branch.`,
		chairBooked: (patient: string) => `That chair is already booked for ${patient} at that time.`,
		dentistBusy: (time: string) => `That dentist already has an appointment at ${time}.`
	},
	toast: {
		invalid: 'Please check the form for errors',
		failed: 'Could not save. Please try again.',
		overrideHint: 'Tick “Book anyway” to keep this time.',
		chooseBranch: 'Choose a branch in the top bar first — an appointment is at one branch.',
		pickDateTime: 'Pick a date and a time.',
		patientGone: 'That patient no longer exists, or was merged into another record.',
		walkInAdded: 'Walk-in added and marked arrived',
		booked: 'Appointment booked',
		reserved: (n: number) =>
			` · ${plural(n, 'planned procedure', 'planned procedures')} booked for it`,
		missing: 'That appointment no longer exists here.',
		cannotMark: (label: string) => `It cannot be marked “${label}” from where it is now.`,
		marked: (label: string) => `Marked ${label.toLowerCase()}`,
		needsClinical:
			'Recording the work needs clinical access. Complete the visit without it, or ask the dentist.',
		onlyStarted: 'Only a visit that has started can be completed.',
		visitCompleted: 'Visit completed',
		recorded: (n: number) => ` · ${plural(n, 'procedure', 'procedures')} recorded`,
		nextDue: (date: string) => ` · next due ${date}`,
		startedCannotCancel: 'A visit that has started cannot be cancelled.',
		cancelled: 'Appointment cancelled',
		onlyNotStarted:
			'Only an appointment that has not started can be moved. Book a new one instead.',
		moved: 'Appointment moved',
		reminderRecorded: 'Reminder recorded',
		remindedConfirmed: 'Reminded, and marked confirmed',
		remindedAlready: 'Reminded — already confirmed',
		reminderGone: 'That appointment no longer exists.',
		reminderNotAhead: 'Only an appointment still to come can be reminded.',
		reminderNotHere: 'That appointment is not at this branch.',
		recallGone: 'That recall no longer exists.',
		recallNotWaiting: 'That recall is no longer waiting — it was booked or closed.',
		callNoAnswer: 'Call logged — no answer.',
		callBack: 'Call logged. Ring again when they asked.',
		callDeclined: 'Marked declined. They will not be rung again for this recall.',
		callStopped: 'Recall stopped.'
	}
};
