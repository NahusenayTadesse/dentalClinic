/**
 * The billing screens' words: Who Owes, the cash drawer, a patient's Billing tab, a bill and its
 * printed copy, taking a payment — and what the billing writers say when they refuse a step.
 */
export const billing = {
	/** A bill's status as the badge says it; the rules stay in `$lib/invoiceStatus.ts`. */
	status: {
		draft: 'Draft',
		issued: 'Unpaid',
		partly: 'Part paid',
		paid: 'Paid',
		void: 'Void',
		awaitingManager: 'Awaiting a manager'
	},

	owes: {
		title: 'Billing',
		blurb:
			'What patients at this branch still owe, and the employers and insurers who pay for some.',
		cashDrawer: 'Cash drawer',
		receivables: 'Receivables',
		owedToClinic: 'Owed to the clinic',
		patientsWhoOwe: 'Patients who owe',
		billsAwaiting: 'Bills waiting for a manager',
		openAwaiting: 'Open the bills waiting for a manager',
		whoOwes: 'Who owes',
		nobodyOwes: 'No patient at this branch owes anything.',
		payersWhoOwe: 'Payers who owe',
		payer: 'Payer',
		unpaidBills: 'Unpaid bills',
		oldest: 'Oldest',
		owesColumn: 'Owes',
		openBills: 'Open bills'
	},

	cash: {
		title: 'Cash drawer',
		blurb: 'Cash payments at this branch go into the open drawer.',
		open: 'Open',
		closed: 'Closed',
		chooseBranch: 'Choose the branch you are working at, in the top bar, to see its drawer.',
		opened: 'Opened',
		float: 'Float',
		cashTaken: 'Cash taken',
		payments: (n: number) => `${n} payment${n === 1 ? '' : 's'}`,
		shouldHold: 'Should hold',
		countAndClose: 'Count and close',
		closedText:
			'The drawer is closed, so cash cannot be taken at this branch. Open it with what is in it.',
		openTheDrawer: 'Open the drawer',
		recentCounts: 'Recent counts',
		noCounts: 'No drawer has been counted at this branch yet.',
		openSubmit: 'Open',
		floatLabel: 'Float (birr)',
		floatHint:
			'What is in the drawer before the first patient pays — usually what was left in it last night.',
		closeDescription: (expected: string) =>
			`Count the cash in the drawer and type the total. It is compared with what the drawer should hold (${expected}).`,
		closeSubmit: 'Close the drawer',
		countedLabel: 'Counted (birr)',
		bankedLabel: 'Taken out to bank (birr)',
		bankedHint: "What leaves the drawer tonight. The rest stays as tomorrow's float.",
		notePlaceholder: 'Required if the count is off: what you know about why',
		counted: 'Counted',
		by: 'By',
		expected: 'Expected',
		overShort: 'Over / short',
		balanced: 'Balanced',
		banked: 'Banked',
		checkForm: 'Check the form.',
		notSaved: 'That could not be saved.',
		openedWith: (amount: string) => `Drawer open with ${amount}.`,
		closedBalanced: 'Drawer counted and closed. It balanced.',
		closedOff: (over: boolean, amount: string) =>
			`Drawer closed ${over ? 'over' : 'short'} by ${amount}.`
	},

	tab: {
		pageTitle: (name: string) => `${name} — Billing`,
		account: 'Account',
		owes: 'Owes',
		unbilled: 'Work not yet billed',
		unbilledHint: (n: number) => `${n} piece${n === 1 ? '' : 's'} of completed work`,
		raiseBill: 'Raise a bill',
		takePayment: 'Take a payment',
		bills: 'Bills',
		noBills:
			'No bills yet. A bill is raised from completed work — mark treatment done on the dental chart, or complete the visit in the diary.',
		raiseDescription:
			'Choose the completed work to bill. It starts as a draft: add other charges or a discount, then issue it.',
		startBill: 'Start the bill',
		completedWork: 'Completed work',
		nothingToBill: 'Nothing completed is waiting to be billed.',
		visitOf: (day: string) => `Visit of ${day}`,
		doneOn: (day: string) => `Done ${day}`,
		bill: 'Bill',
		date: 'Date',
		total: 'Total',
		paid: 'Paid',
		stillOwed: 'Still owed',
		draftStarted: 'Draft bill started. Check it, then issue it.',
		paymentRecorded: (amount: string) => `Payment of ${amount} recorded.`
	},

	bill: {
		vat: (rate: number) => `VAT (${rate}%)`,
		vatAtIssue: (rate: number) => `VAT (${rate}%), charged when issued`,
		chargeTaxable: 'VAT applies',
		chargeTaxableHint: 'Goods sold — a toothbrush, a whitening kit. Treatment is not taxed.',
		pageTitle: (name: string, number: string) => `${name} — ${number}`,
		notFound: 'Bill not found',
		notThisPatient: 'That bill is not on this patient’s record.',
		draftBill: 'Draft bill',
		allBills: 'All bills',
		void: 'Void',
		addWork: 'Add work',
		addCharge: 'Add a charge',
		throwAway: 'Throw away',
		throwAwayTitle: 'Throw this draft away?',
		throwAwayDescription:
			'It was never issued, so nothing is lost but the draft. Its work is unbilled again.',
		billTo: 'Bill to',
		aPayer: 'A payer',
		thePatient: 'The patient',
		changeWhoPays: 'Change who pays',
		issued: 'Issued',
		notYet: 'Not yet',
		due: 'Due',
		onTheDay: 'On the day',
		total: 'Total',
		stillOwed: 'Still owed',
		queue: 'Approvals → Discounts and Voids',
		voidAsked: (reason: string) =>
			`A void has been asked for (“${reason}”). It waits for a manager in`,
		voidAskedEnd: ', and takes no payment meanwhile.',
		discountWaits: (threshold: number) =>
			`Its discount is over ${threshold}% of the bill, so it waits for a manager in`,
		discountWaitsEnd: 'and takes no payment until then.',
		isVoid: (reason: string | null) =>
			`Void${reason ? `: ${reason}` : ''}. Its number is kept; its work can be billed again.`,
		refusedRequest: (reason: string) => `A manager refused a request on this bill: ${reason}`,
		lines: 'Lines',
		what: 'What',
		qty: 'Qty',
		price: 'Price',
		change: 'Change',
		changeLine: (description: string) => `Change ${description}`,
		remove: 'Remove',
		noLines: 'No lines.',
		subtotal: 'Subtotal',
		discount: 'Discount',
		add: 'Add',
		overThreshold: (share: string, threshold: number) =>
			`The ${share}% discount is over ${threshold}%: a manager approves it before it can be paid.`,
		issueTheBill: 'Issue the bill',
		addWorkTitle: 'Add completed work',
		addToBill: 'Add to bill',
		nothingElse: 'Nothing else completed is waiting to be billed.',
		chargeDescription:
			'Something that is not charted treatment: a missed-appointment fee, something sold.',
		addChargeSubmit: 'Add charge',
		whatFor: 'What for',
		whatForPlaceholder: 'Missed appointment',
		quantity: 'Quantity',
		priceEach: 'Price each (birr)',
		changeLineTitle: 'Change line',
		whatPatientReads: 'What the patient reads',
		discountDescription: (threshold: number) =>
			`In birr, off the whole bill. Over ${threshold}% of it, a manager approves it before the bill can be paid. 0 removes it.`,
		discountLabel: 'Discount (birr)',
		issueTitle: 'Issue this bill',
		issueDescription:
			'It gets its number and is fixed from now on — what the patient holds and what the system shows stay the same.',
		issueSubmit: 'Issue',
		paymentDue: 'Payment due',
		paymentDueHint: 'Leave it empty when the patient pays on the day.',
		whoPaysTitle: 'Who pays this bill',
		whoPaysDescription:
			"An employer or insurer that pays for this patient. Their bills are paid, and show as owed, on the payer's own page.",
		voidTitle: 'Void this bill',
		voidDescription:
			'A manager approves it in Approvals → Discounts and Voids. The bill keeps its number; its work can be billed again.',
		voidSubmit: 'Ask to void',
		why: 'Why',
		voidPlaceholder: 'Billed the wrong patient',
		added: 'Added to the bill.',
		chargeAdded: 'Charge added.',
		lineUpdated: 'Line updated.',
		lineRemoved: 'Line removed.',
		toPayer: 'The bill goes to the payer.',
		toPatient: 'The patient pays this bill.',
		discountSet: 'Discount set.',
		discountRemoved: 'Discount removed.',
		issuedNeedsManager:
			'Issued. Its discount is over the limit, so a manager must approve it before it can be paid.',
		issuedDone: 'Issued.',
		voidRequested: 'Void requested. A manager approves it in Approvals → Discounts and Voids.',
		discarded: 'Draft thrown away. Its work is unbilled again.',
		refundRequested:
			'Refund requested. A manager approves it in Approvals → Refunds before the money goes back.'
	},

	/** A bill's payments and refunds, under the bill. */
	payments: {
		title: 'Payments',
		receipt: 'Receipt',
		date: 'Date',
		how: 'How',
		amount: 'Amount',
		refund: 'Refund',
		waiting: 'waiting for approval',
		refused: 'refused',
		cash: (name: string) => `${name} (cash)`,
		giveBackTitle: 'Give money back',
		giveBackDescription:
			'A manager approves it in Approvals → Refunds. Only then does the bill owe it again, and only then does cash leave the drawer.',
		askRefund: 'Ask for the refund',
		atMost: (limit: string) => `At most ${limit} from this payment.`,
		givenBackBy: 'Given back by',
		why: 'Why',
		whyPlaceholder: 'Crown not fitted'
	},

	/** The bill on paper. */
	print: {
		vat: (rate: number) => `VAT (${rate}%)`,
		clinicTin: (tin: string) => `TIN ${tin}`,
		payerTin: 'Payer’s TIN',
		vatCharged: (rate: number) =>
			`VAT at ${rate}% is charged on goods; medical services are exempt.`,
		fallbackName: 'Dental clinic',
		bill: 'Bill',
		billVoid: 'Bill — VOID',
		patient: 'Patient',
		file: (no: string) => `File ${no}`,
		billTo: 'Bill to',
		issued: 'Issued',
		due: 'Due',
		what: 'What',
		qty: 'Qty',
		price: 'Price',
		total: 'Total',
		subtotal: 'Subtotal',
		discount: 'Discount',
		paid: 'Paid',
		receipt: 'Receipt',
		refundMark: ' (refund)',
		how: 'How',
		amount: 'Amount',
		stillOwed: (amount: string) => `Still owed: ${amount}`,
		paidInFull: 'Paid in full',
		vatExempt: 'Medical services are exempt from VAT.',
		receivedBy: 'Received by',
		forTheClinic: 'For the clinic',
		printed: (day: string) => `Printed ${day}`,
		draftNotPrinted: 'A draft bill is issued before it is printed.',
		patientNotFound: 'Patient not found'
	},

	/** Taking a payment against one bill or several. */
	pay: {
		payEverything: (amount: string) => `Pay everything owed (${amount})`,
		bill: 'Bill',
		owes: (amount: string) => `owes ${amount}`,
		amountToward: (number: string) => `Amount toward ${number}`,
		thisBill: 'this bill',
		allOfIt: 'All of it',
		paidBy: 'Paid by',
		cash: (name: string) => `${name} (cash)`,
		drawerShut:
			'The cash drawer is not open at this branch, so cash cannot be taken. Open it under',
		drawerPlace: 'Billing → Cash drawer',
		drawerShutEnd: 'first.',
		reference: 'Reference',
		referencePlaceholder: 'Bank or mobile-money reference, if there is one',
		referenceMobile: 'Transaction ID',
		referenceMobilePlaceholder: 'From the Telebirr / CBE Birr message, e.g. BX12AB34CD',
		total: 'Total',
		recording: 'Recording',
		record: 'Record payment'
	},

	/** What the billing writers say when they refuse a step. */
	/** Billing → Mobile Money: a day's transfers, ticked against the provider's statement. */
	mobile: {
		title: 'Mobile Money',
		blurb:
			'Telebirr, CBE Birr and bank transfers taken at this branch on one day. Open the provider’s statement and tick each one you find there; what stays unticked is money recorded but not yet seen to arrive.',
		tileCount: 'Transfers',
		tileTotal: 'Total',
		tileUnchecked: 'Not yet found on a statement',
		time: 'Time',
		receipt: 'Receipt',
		from: 'From',
		method: 'Method',
		reference: 'Reference',
		amount: 'Amount',
		checked: 'On the statement',
		checkedBy: (who: string, when: string) => `Found by ${who} · ${when}`,
		notChecked: 'Not found yet',
		markFound: 'Found it',
		unmark: 'Untick',
		byMethod: (method: string, count: number) => `${method} · ${count}`,
		empty: 'No transfers were taken at this branch on this day.',
		marked: 'Ticked as found on the statement',
		unmarked: 'Tick taken off',
		notHere: 'That transfer is not on this branch’s list.',
		noReference: 'No reference'
	},
	refused: {
		chooseBranch: 'Choose the branch you are working at before opening a drawer.',
		negativeFloat: 'A float cannot be negative.',
		alreadyOpen: 'The drawer is already open at this branch. Count and close it first.',
		noOpenDrawer: 'There is no open drawer at this branch.',
		negativeCount: 'A count cannot be negative.',
		bankedRange: 'Banked must be between nothing and what was counted.',
		countOff: (over: boolean, amount: number) =>
			`The count is ${over ? 'over' : 'short'} by ${amount}. Say what you know about why.`,
		alreadyBilled:
			'Some of that work is already billed, or no longer done. Reload and choose again.',
		chooseWork: 'Choose the work to bill.',
		payerFixed: 'Who pays is fixed once the bill is issued.',
		choosePayer: 'Choose a payer from the list.',
		onlyDraft: 'Only a draft bill can be changed.',
		issuedNotEdited: 'An issued bill is what the patient holds; it is not edited.',
		lineNotOnBill: 'That line is not on this bill.',
		onlyDraftDiscount: 'Only a draft bill can be discounted.',
		discountTooBig: 'A discount cannot be more than the bill.',
		alreadyIssued: 'This bill has already been issued.',
		needsLine: 'A bill needs at least one line.',
		discountOverBill: 'The discount is more than the bill. Change it first.',
		voidNotDiscard: 'An issued bill is voided, not discarded.',
		refundFirst:
			'Money has been paid against this bill. Refund it first; a bill is voided with nothing on it.',
		cannotVoid: 'This bill cannot be voided now.',
		sayWhyVoid: 'Say why it is being voided.',
		chooseMethod: 'Choose how it was paid.',
		drawerShut: 'The cash drawer is not open at this branch. Open it before handling cash.',
		enterAmount: 'Enter an amount against at least one bill.',
		billTwice: 'A bill appears twice in that payment.',
		referenceRequired:
			'Enter the transaction ID from the mobile-money message — it is how the payment is found on the statement.',
		referenceUsed: (receipt: string) =>
			`That reference is already recorded${receipt ? `, on receipt ${receipt}` : ''}. One transfer pays once.`,
		billWaiting: (number: string) =>
			`Bill ${number} is waiting for a manager to approve its discount or void.`,
		billCannotPay: (number: string) => `Bill ${number} cannot take a payment.`,
		moreThanOwed: (number: string, owed: number) =>
			`That is more than bill ${number} still owes (${owed}).`,
		notPayersBill: 'That bill is not billed to this payer.',
		paymentNotOnBill: 'That payment was not made against this bill.',
		nothingToRefund: 'This bill has nothing to refund.',
		enterRefund: 'Enter an amount to refund.',
		atMost: (available: number) => `At most ${available} of that payment can be refunded.`,
		refundedAlready: 'That payment has already been refunded in full, or is waiting to be.',
		sayWhyRefund: 'Say why the money is being given back.',
		chooseRefundMethod: 'Choose how it is being given back.'
	}
};
