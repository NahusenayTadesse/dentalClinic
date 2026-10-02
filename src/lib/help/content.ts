/**
 * The amno system manual.
 *
 * One source for three surfaces: the searchable Help page, the printable manual,
 * and the route map. An instruction can therefore never be right in one place and
 * stale in another.
 *
 * Written for the people who actually run the business, not for developers. Every
 * topic answers "where is it, what do I click, and what happens when I do".
 *
 * Light markup is available in every `steps` and `notes` string:
 *   **bold**   — something you click, or a screen name
 *   `code`     — literal text, a route, or a column name
 */

export type HelpTopic = {
	id: string;
	title: string;
	/** The one-line answer. Shown under the title, and in search results. */
	summary: string;
	/** Where in the system this lives — a menu path, or a route. */
	where?: string;
	/** The permission a user needs before this screen appears for them at all. */
	permission?: string;
	/** Numbered instructions, in the order you would really do them. */
	steps?: string[];
	/** Things that are easy to get wrong, or worth knowing before you start. */
	notes?: string[];
	/** Extra words someone might search for that are not in the text above. */
	keywords?: string[];
};

export type HelpSection = {
	id: string;
	title: string;
	blurb: string;
	topics: HelpTopic[];
};

export const HELP_SECTIONS: HelpSection[] = [
	/* ------------------------------------------------------------------ */
	{
		id: 'start',
		title: 'Getting started',
		blurb:
			'What this system is, how to sign in, how to read the screen, and the handful of habits that make every other section easier.',
		topics: [
			{
				id: 'what-is-this',
				title: 'What the amno system is',
				summary:
					'One place to run a dental clinic: the patients and their charts, the diary, the work done in the chair, the staff who do it, the money in and out, and the stock the clinic uses.',
				notes: [
					'It replaces the paper cards, the appointment book and the spreadsheets that used to hold them. Because everything sits in one database, an allergy recorded at the desk is the allergy the dentist sees at the chair, and a figure on a report is the figure the person who entered it saw.',
					'Every screen lives under `/dashboard`. Nothing is public: if you are not signed in you are sent to the login page, whatever address you typed.',
					'The system is built and maintained by **amno ERP Solutions**. The footer of the menu names them, and support requests go through them.',
					'A visit runs through the system in one line: a **patient** is found or registered, **booked** into a chair, **arrives**, is **charted** on the dental chart by the dentist, and the **visit is completed** with the work done recorded. Most screens are one step of that, or the staff, money and stock behind it.'
				],
				keywords: ['erp', 'overview', 'purpose', 'about', 'system', 'amno']
			},
			{
				id: 'signing-in',
				title: 'Signing in and signing out',
				summary:
					'Your username and password are issued by an administrator. There is no self sign-up.',
				where: 'Menu → the button with your name, bottom of the sidebar',
				steps: [
					'Open the system and enter your username and password on the login screen.',
					'If the password is wrong, the message says so without saying which half was wrong — that is deliberate.',
					'To leave, open the menu at the bottom of the sidebar and press **Logout**. This ends the session on the server, not only in this browser.'
				],
				notes: [
					'Sessions expire. If a page suddenly bounces you to the login screen, nothing has broken and nothing you had already saved is lost — sign back in and carry on.',
					'Forgot your password? The **Forgot password** link on the login screen emails you a reset link. If it does not arrive, the email on your account may be wrong — an administrator can correct it in **Admin Panel → Users**, and you can then ask again.',
					'Never share an account. Every record in the system is stamped with who entered it and who approved it, and a shared login makes both stamps meaningless.'
				],
				keywords: ['login', 'logout', 'password', 'session', 'expired', 'sign in', 'sign out']
			},
			{
				id: 'change-password',
				title: 'Changing your own password',
				summary: 'You can change your own password at any time without involving an administrator.',
				where: '`/dashboard/change-password`',
				steps: [
					'Open **Change password** from the account menu at the bottom of the sidebar.',
					'Enter your current password, then the new one twice.',
					'Press **Save**. You stay signed in on this device.'
				],
				notes: [
					'The current password is required, so someone who walks up to an unlocked screen still cannot lock you out.',
					'There is a password generator on the user forms in the admin panel if you want a strong one suggested for you.'
				],
				keywords: ['password', 'security', 'change', 'reset']
			},
			{
				id: 'layout',
				title: 'Finding your way around',
				summary:
					'The menu down the left is grouped by the kind of work you are doing. Each group opens into the screens inside it.',
				steps: [
					'**Dashboard** — today at a glance: appointments booked, work done, money in and out, and supplies running low.',
					'**Patients** — find or register a patient, and open their chart: the overview, and the dental chart.',
					'**Appointments** — the day view of every chair, the appointment list, and the dentists.',
					'**Approvals, Rejections** — the changes waiting for a second person, and the ones sent back.',
					'**Customers** — employers and insurers who pay for a patient’s care.',
					'**Employees** — people, attendance and leave.',
					'**Finance** — salaries, overtime, deductions, transactions and expenses.',
					'**Supplies** — stock, suppliers and supply types.',
					'**Reports** — every ledger in the system, filtered and exportable.',
					'**Clinic Setup** — branches, chairs, closures, services and their prices, and the clinical lists: allergens, conditions, medicines.',
					'**Admin Panel** — users, roles, and the staff, money and location lists the forms choose from.'
				],
				notes: [
					'On a phone the whole menu is behind the button in the top-left corner; it closes itself as soon as you pick something.',
					'**You will not see every group.** The menu is filtered by your permissions, and a group whose screens you may not open disappears entirely rather than showing links that would refuse you.',
					'The logo at the top of the menu is a link home; so is the **Dashboard** entry.'
				],
				keywords: ['menu', 'sidebar', 'navigation', 'where is', 'layout', 'mobile']
			},
			{
				id: 'permissions-basics',
				title: 'Why you cannot see everything',
				summary:
					'Every screen sits behind a named permission. Your role decides which ones you hold, and the menu shows only what you hold.',
				steps: [
					'An administrator gives you a **role** — Payroll Officer, Store Keeper, Operations, and so on.',
					'A role is a bundle of **permissions**, each one a name like `payroll.manage` or `approvals.approve`.',
					'The menu, the buttons on a page and the server all read the same list. A link is never shown that would refuse you when you clicked it.'
				],
				notes: [
					'If you type an address you do not hold the permission for, you get a refusal page rather than the screen. That is the gate doing its job, not a fault.',
					'A user can also be given **special permissions** on top of their role, for a one-off responsibility that does not deserve a whole new role.',
					'Someone holding every permission in the system is a **super admin**. That is not a flag anyone sets — it is what holding the complete set means. Super admins see the destructive actions (permanent delete, override) that are hidden from everyone else.',
					"Missing a screen you need? Ask an administrator to add the permission to your role rather than working around it in someone else's account."
				],
				keywords: [
					'permission',
					'role',
					'403',
					'access denied',
					'cannot see',
					'hidden',
					'super admin'
				]
			},
			{
				id: 'tables',
				title: 'Using the tables',
				summary:
					'Almost every screen in the system is a table, and they all behave the same way: search, sort, choose columns, filter, export.',
				steps: [
					'Type in the **search box** above a table to narrow it down. It looks across every visible column at once, so a patient’s name, a phone number or an amount all work.',
					'Click a **column heading** to sort by it. Click again to reverse the order.',
					'Use the **columns** dropdown to hide columns you do not need. Wide tables — payroll especially — read far better with half the columns switched off.',
					'Use the **filter menus** above the table to pick exact values from a column: one service, two departments, three statuses.',
					'Use the **download button** for **Print** (opens the browser print dialog, where "Save as PDF" writes a file) or **Export to CSV** (opens in Excel).',
					'Click the first cell of a row, or the action button at the end of it, to open that record in full.'
				],
				notes: [
					'Searching, sorting, hiding columns and filtering only change what **you** are looking at right now. They never change the data and nobody else sees the effect.',
					'The export and the print take the table **as it stands** — filtered, sorted, with hidden columns left out. Filter first, then export, and you get exactly the sheet you wanted.',
					'Printing chooses its own paper: portrait A4 for narrow tables, landscape A3 for the very wide ones, with the heading row repeated on every page.',
					'Numbers are printed as a ledger — thousands separated, two decimals — while phone numbers, TINs and reference numbers are left exactly as typed.'
				],
				keywords: [
					'search',
					'sort',
					'filter',
					'export',
					'csv',
					'excel',
					'print',
					'pdf',
					'columns',
					'table'
				]
			},
			{
				id: 'query-builder',
				title: 'The advanced filter (query builder)',
				summary:
					'When picking values from a list is not enough, the advanced filter narrows by several fields at once: "consumables at or below their reorder level", "one supplier\'s items in grams".',
				where:
					'The **Advanced filter** button above the tables that have one — stock levels and suppliers',
				steps: [
					'Press **Advanced filter** to open the condition builder.',
					'Choose a field, then an operator — *is*, *is not*, *greater than*, *between*, *before*, *after*, *in the last N days*, *contains*, *is empty*.',
					'Add more conditions with **Add condition**. They combine with **and** by default; switch to **any** to match rows that satisfy at least one.',
					'Press **Clear** to drop the whole set and see everything again.'
				],
				notes: [
					'Text fields offer *contains*, *starts with*, *ends with*; dates offer *before*, *after*, *in the last / next N days*; numbers offer the comparisons and *between*; yes/no fields offer *is true* / *is false*.',
					'The filtering happens in your browser over the rows already on screen, so it is instant, and it never changes anything stored.'
				],
				keywords: ['advanced', 'filter', 'condition', 'query', 'between', 'greater than', 'builder']
			},
			{
				id: 'saving',
				title: 'Saving, and what the red messages mean',
				summary:
					'Nothing is saved until you press the button, and you always get a message telling you exactly what happened.',
				steps: [
					'Fill in the form. Required fields are marked, and most lists only offer values that already exist in the admin panel.',
					'Press **Save** (or **Add**, on a new record).',
					'A message appears in the corner. Green means it saved. Red means something needs fixing, and the field with the problem is outlined in red with the reason underneath it.'
				],
				notes: [
					'Close a form without saving and your typing is discarded. Nothing half-finished is ever kept.',
					'Red messages are not failures on your part — they are the system refusing something that would have caused a problem later: a patient registered twice, an end date before its start date, a filling charted on a surface the tooth does not have.',
					'If a save fails on the server, **nothing** from that save is written. A payroll run that fails halfway does not leave half a payroll behind; it is all or nothing.'
				],
				keywords: ['save', 'error', 'red', 'validation', 'required', 'discard', 'transaction']
			},
			{
				id: 'dates',
				title: 'Dates, months and the Ethiopian calendar',
				summary:
					'Payroll periods and most date labels are shown in the Ethiopian calendar. The date pickers still work the way you expect.',
				notes: [
					'Payroll and salary screens are addressed by month — `Meskerem_2017` and the like — because a payroll run belongs to a month, not to a range of days.',
					'Reports take a **start date** and an **end date**, and both ends are included: a range ending today includes everything entered today.',
					'When you land on a monthly screen without choosing a month, the system sends you to the current one. Change the month from the selector at the top of the page.'
				],
				keywords: ['date', 'ethiopian', 'calendar', 'month', 'meskerem', 'range', 'period']
			},
			{
				id: 'help-panel',
				title: 'The help panel and this page',
				summary:
					'The round **?** button gives you help for the screen you are on. This page is the whole manual in one place.',
				steps: [
					'Press the **?** button in the corner of any screen, or just press the `?` key, to open help for that screen.',
					'The panel has an **EN / አማርኛ** switch for the screens that carry a translation.',
					'For anything the panel does not cover, come here — this page holds every topic and the full route map, and it is searchable.',
					'Press **Download the manual** at the top of this page to print the whole thing, or save it as a PDF.'
				],
				notes: [
					'The `?` key is ignored while you are typing in a box, so it never interrupts a form.',
					'The panel closes itself when you move to another screen, so it can never explain the wrong page.'
				],
				keywords: ['help', 'question mark', 'manual', 'pdf', 'amharic', 'shortcut']
			},
			{
				id: 'dark-mode',
				title: 'Dark mode and personal settings',
				summary:
					'The light/dark switch and your avatar live in the account menu at the bottom of the sidebar.',
				notes: [
					'The choice is remembered on this device, per browser. It is a display preference and nothing more.',
					'Print output is always on white paper regardless of the theme you are using.'
				],
				keywords: ['dark', 'light', 'theme', 'avatar', 'profile', 'settings']
			},
			{
				id: 'attachments',
				title: 'Attachments and uploaded files',
				summary:
					'Receipts, radiographs, patient photographs, withholding certificates and staff documents are stored by the system and served only to signed-in users.',
				steps: [
					"Use the file field on the form — payment receipt, withholding receipt, an employee's ID — and pick the file.",
					'Save the form. The file is stored and the record links to it.',
					'Open the record later and click the link to view or download it.'
				],
				notes: [
					'Files are served from `/dashboard/files/…` and require a session. A link pasted into a chat is useless to anyone not signed in.',
					'Attach the document at the moment you record the transaction. Chasing a receipt three months later is the single most common reason a month will not reconcile.'
				],
				keywords: ['file', 'upload', 'attachment', 'receipt', 'scan', 'document', 'photo']
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'approvals',
		title: 'Approvals — how nothing is done by one person alone',
		blurb:
			'The rule that runs through the whole system: whoever enters a record is not the person who releases it. This section explains what that means in practice.',
		topics: [
			{
				id: 'maker-checker',
				title: 'The maker–checker rule',
				summary:
					'A record you create starts as **pending**. Somebody else has to approve it before it counts anywhere else in the system.',
				steps: [
					'You create a record — an employee, a salary change, an expense, a payroll run, a customer.',
					'It is saved immediately with the status **pending**, stamped with your name as the requester.',
					'It appears in the approval queue for that kind of record.',
					'Somebody with the approval permission opens the queue, ticks the record and presses **Approve** or **Reject**.',
					'Once approved, the record starts counting: it appears in listings, joins the reports, and can be paid or acted on.'
				],
				notes: [
					'A pending record is **not** invisible — you can see it and correct it. It just does not count yet. A pending employee cannot be paid; a pending payroll run pays nobody.',
					'You cannot approve your own request. Ticking your own row and pressing approve leaves it pending and tells you why.',
					'The one exception is the `approvals.override` permission, held by very few people. When they release their own request, it is recorded as an override — the trail says the same person did both halves.',
					'Records that pre-date the approval system read as "Approved before this system was in place" rather than as approved by nobody.'
				],
				keywords: [
					'approval',
					'pending',
					'maker checker',
					'four eyes',
					'segregation',
					'override',
					'workflow'
				]
			},
			{
				id: 'approval-queues',
				title: 'The approval queues',
				summary: 'One queue per kind of record, plus an overview showing what is waiting in each.',
				where: 'Menu → **Approvals** → `/dashboard/approvals`',
				permission: 'approvals.view to see the counts, approvals.approve to settle anything',
				steps: [
					'Open **Approvals → All Queues** to see how much is waiting in each queue.',
					'Open the queue you are responsible for — Employees, Salary Changes, Expenses, Payroll Runs, Discounts and Voids, and the rest.',
					'Read the rows. Columns that point at another record are links, so you can open the patient or the employee behind a row before deciding.',
					'Tick the rows you have decided on. Tick the header box to take the whole page at once.',
					'Press **Approve**, or press **Reject** and give a reason — a rejection without a reason is refused.'
				],
				notes: [
					'The queues cover **employees, salary changes, expenses, payroll runs, payroll adjustments, payers, discounts and voids** on invoices, and **refunds**.',
					'Approving in bulk is a real decision on every row you ticked. The count in the confirmation message is your check that you took what you meant to.',
					'If some of the ticked rows were your own requests, the rest are still settled and the message tells you exactly how many were left behind and why.',
					'Seeing the counts and settling them are two different permissions on purpose: a supervisor can watch the backlog without being able to clear it.'
				],
				keywords: ['approve', 'queue', 'pending', 'bulk', 'reject', 'reason', 'tick', 'select all']
			},
			{
				id: 'rejections',
				title: 'The rejections desk',
				summary:
					'Rejected records do not vanish. They collect in their own queues so that somebody can fix them or close them off.',
				where: 'Menu → **Rejections** → `/dashboard/rejections`',
				permission: 'rejections.view',
				steps: [
					'Open **Rejections → All Queues** to see what has been turned back.',
					'Open a queue and read the rejection reason on each row.',
					'Correct the underlying record and resubmit it, or leave it closed if it should never have been entered.'
				],
				notes: [
					'This is deliberately a separate desk from approvals. Clearing rejections is its own job, usually held by different people from the ones who approve.',
					"The rejection reason is part of the record's permanent history. It shows on the record itself, not only in the queue."
				],
				keywords: ['rejected', 'rejection', 'reason', 'resubmit', 'turned back', 'fix']
			},
			{
				id: 'system-info',
				title: 'The "system information" panel on a record',
				summary:
					'Every detail page ends with who entered the record, who released it, when, and who touched it last.',
				notes: [
					'**Entered by** is the person who first created the record. **Approved by** is the person who released it. **Last updated by** is whoever edited it most recently.',
					'A pending record reads "Not approved yet"; a rejected one points you at the notice above it.',
					'This panel is the fastest way to answer "who did this and when" without going near the audit log.'
				],
				keywords: ['audit', 'who', 'trail', 'entered by', 'approved by', 'history', 'system info']
			},
			{
				id: 'deleting',
				title: 'Deleting things',
				summary:
					'Deleting hides a record; it does not shred it. The history that depends on it stays intact.',
				notes: [
					"A deleted record disappears from the lists and the pickers, but the payments, payroll lines and reports that already referenced it keep working — this is why a deleted supplier does not blank out last year's purchases.",
					'Only a super admin sees the permanent delete action, and it is meant for genuine mistakes — a duplicate typed twice — not for tidying up history.',
					'If a record you expect is missing, it has usually either been deleted or is still pending approval. Check both before entering it again.'
				],
				keywords: ['delete', 'remove', 'soft delete', 'restore', 'missing', 'archive']
			}
		]
	},

	/* ------------------------------------------------------------------ */

	/* ------------------------------------------------------------------ */

	/* ------------------------------------------------------------------ */
	{
		id: 'appointments',
		title: 'Appointments',
		blurb: 'Booking the chairs, checking patients in, and keeping the day moving.',
		topics: [
			{
				id: 'booking-appointments',
				title: 'Booking an appointment',
				summary:
					'Click an empty time in a chair’s column, or press Book. The chair and the dentist are checked for clashes and closed days are refused.',
				where: 'Menu → **Appointments → Day View** → `/dashboard/appointments`',
				permission: 'appointments.book',
				steps: [
					'Choose the branch in the top bar — the day view shows one branch’s chairs.',
					'Click the chair and time, or press **Book**.',
					'Search for the patient by name, file number or phone. Severe allergies show beside each result.',
					'Pick what the visit is for — the length fills in from the appointment type — and, if you know them, the dentist.',
					'Book. If the chair or dentist is already taken, or the clinic is closed that day, you are told why and nothing is saved.'
				],
				notes: [
					'**Walk-in** is for a patient already standing at the desk: the appointment starts now and is marked arrived.',
					'Times are shown on the international clock with the Ethiopian time beside them — 9:00 is ጠዋት 3:00.',
					'A patient chart has a **Book appointment** button that opens the booking form with the patient already chosen.',
					'Cancelled and no-show appointments free their slot, and stay on the day faded so the history is visible.'
				],
				keywords: ['book', 'schedule', 'diary', 'calendar', 'walk-in', 'chair', 'slot']
			},
			{
				id: 'running-the-day',
				title: 'Running the day',
				summary:
					'Open an appointment to move it along: confirmed, arrived, in the chair, completed — or no-show or cancelled.',
				where: '`/dashboard/appointments`',
				permission: 'appointments.book',
				steps: [
					'**Mark confirmed** after the reminder call.',
					'**Mark arrived** when the patient reaches the desk. They appear under **Waiting**, with how long they have waited — red past half an hour.',
					'**Seat in chair** when treatment starts, and **Complete visit** when they leave. It lists the work planned for the patient and the usual services for the visit; tick what was done.',
					'**Mark no-show** for a patient who never came; **Cancel** asks for a reason.'
				],
				notes: [
					'Only an appointment that has not started can be moved. Once a patient has arrived, a new time is a new appointment.',
					'A finished, cancelled or no-show appointment cannot be reopened, so the history stays true.',
					'Work ticked when completing is dated to the visit, not to the day you close it, and credited to the visit’s dentist unless it was planned for another. Ticking needs **patients.clinical**; without it the visit completes on its own.',
					'**Could come earlier** lists patients marked short-notice who are booked later that day — the first people to call when a slot frees up.',
					'Every change is recorded in the audit trail.'
				],
				keywords: ['check in', 'arrived', 'waiting room', 'no-show', 'cancel', 'reschedule', 'move']
			},
			{
				id: 'dentists',
				title: 'Dentists and their licences',
				summary:
					'A dentist is a member of staff with a clinical record: a licence, a specialty, and whether they can be booked or prescribe.',
				where: 'Menu → **Appointments → Dentists** → `/dashboard/providers`',
				permission: 'providers.manage',
				steps: [
					'Add a dentist by choosing the member of staff — they must already be an employee.',
					'Record the licence number, who issued it and when it expires.',
					'Leave **Bookable** on for anyone who takes appointments; turn it off for a clinician who no longer sees patients but whose past work must stay attached to them.'
				],
				notes: [
					'The licence column counts down: red once expired, amber inside the last two months, and the line above the table says how many of each. Treating on an expired licence is a legal problem, not an administrative one.',
					'One member of staff has at most one dentist record; choosing somebody who already has one is refused.',
					'Only bookable dentists appear in the booking form. Removing a dentist leaves their past appointments standing.'
				],
				keywords: ['provider', 'dentist', 'licence', 'license', 'specialty', 'prescribe']
			},
			{
				id: 'appointment-list',
				title: 'Finding appointments',
				summary:
					'The appointment list searches by patient and filters by date, status, what for, dentist, chair, first visit and short notice.',
				where: 'Menu → **Appointments → Appointment List** → `/dashboard/appointments/list`',
				permission: 'appointments.view',
				notes: [
					'It shows the branch chosen in the top bar, or every branch when all are selected.',
					'Click a date to open that appointment on its day.',
					'Chairs are managed under **Admin Panel → Chairs**. A branch with no chairs has an empty day view.'
				],
				keywords: ['no-show report', 'history', 'search appointments']
			},
			{
				id: 'recalls',
				title: 'Bringing patients back',
				summary:
					'A completed check-up puts the patient on the recall list for their next one. The desk rings them and books it.',
				where: 'Menu → **Appointments → Recalls** → `/dashboard/recalls`',
				permission: 'appointments.book',
				steps: [
					'Give each appointment type that should bring a patient back its interval under **Clinic Setup → Appointment Types** — 6 for a check-up or a scale and polish, 1 for an orthodontic adjustment, 0 for none.',
					'Open **Recalls**. The longest overdue are at the top; choose how far ahead to look with the buttons over the table.',
					'Ring the patient and **Log a call**: no answer, spoke, declined, or stop.',
					'**Book** opens the diary with the patient and the visit already chosen.'
				],
				notes: [
					'Nobody types a recall. Completing a visit of a type with an interval creates the next one, due that many months after the visit, and closes the one it answered.',
					'Booking takes the patient off the list by itself. If that appointment is cancelled or missed, the recall comes back.',
					'A declined recall is kept, so the patient is not rung again for it.',
					'The patient’s chart says when they are next due, beside their appointments.'
				],
				keywords: ['recall', 'check-up', 'six months', 'reminder', 'come back', 'due']
			},
			{
				id: 'lab-work',
				title: 'Work sent to a dental laboratory',
				summary:
					'Crowns, bridges and dentures are tracked from the docket to the fitting, with the date the laboratory promised.',
				where:
					'The patient’s **Lab work** tab to send; Menu → **Appointments → Lab Work** → `/dashboard/lab-cases` for the board',
				permission: 'lab_cases.manage',
				steps: [
					'On the patient’s chart, open **Lab work → Send to a lab**. Choose the laboratory and the charted work it is for; its tooth comes with it.',
					'Leave **Due back** empty to use the laboratory’s usual turnaround, or enter the day they promised.',
					'When the parcel comes back, press **Received from the lab**; when the patient has it, **Fitted**.',
					'Work that came back wrong goes back with **Send back for a remake**, which counts against the laboratory.'
				],
				notes: [
					'The **Lab Work** board lists everything at this branch not yet fitted, with what is overdue.',
					'The day view marks a patient whose lab work is back or overdue, and the appointment says which.',
					'**How the laboratories have done**, under the board, shows each lab’s real turnaround, lateness and remakes over the past year.',
					'Laboratories and their usual turnaround are set under **Clinic Setup → Dental Labs**.'
				],
				keywords: ['lab', 'laboratory', 'crown', 'bridge', 'denture', 'remake', 'technician']
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'patients',
		title: 'Patients',
		blurb:
			'Finding patients, registering them once and only once, and keeping their chart safe to treat from.',
		topics: [
			{
				id: 'finding-patients',
				title: 'Finding a patient',
				summary:
					'Search by any of their names in any order, their file number, or any phone number connected to them.',
				where: 'Menu → **Patients** → `/dashboard/patients`',
				permission: 'patients.view',
				steps: [
					'Type what the patient tells you — a name, a file number or a phone number.',
					'Results from every branch appear; one registered elsewhere is marked with its branch and can still be treated here.',
					'Open the name to see the chart.'
				],
				notes: [
					'Without a search, the list shows only the patients of the branch chosen in the top bar. With one, it looks across every branch — so a patient who lost their card at one branch is found at the other instead of being registered again.',
					'An emergency contact’s phone finds the patient too: a parent calling about a child is found by the number they are calling from.',
					'The column headers filter by sex, age band, blood type, alerts, allergy, condition, medical history, how they heard of the clinic and who pays. **Registered** narrows by registration date, and **Charts** draws every filter as a chart.'
				],
				keywords: ['search', 'file number', 'phone', 'mrn', 'card', 'find']
			},
			{
				id: 'registering-patients',
				title: 'Registering a patient',
				summary:
					'Three things are required — given name, father’s name and sex. The system checks for an existing record before it saves.',
				where: 'Menu → **Patients → Register a patient** → `/dashboard/patients/add`',
				permission: 'patients.register',
				steps: [
					'Enter the names, sex, and a birth date if the patient knows it — otherwise their approximate age.',
					'Add a phone, any allergies they report, how they heard of the clinic, and who pays if it is not the patient.',
					'Register. If someone with the same name or phone already exists, the matches are shown: open theirs if it is the same person, or confirm it is someone else and register again.'
				],
				notes: [
					'A second record for one person is the most dangerous mistake this system allows: allergies on the first record do not appear on the second, and its empty list looks like “none reported”. That is why the duplicate check stops the save.',
					'An approximate age is stored as an estimated birth date and shown with a ~.'
				],
				keywords: ['new patient', 'duplicate', 'walk-in', 'age']
			},
			{
				id: 'patient-chart',
				title: 'The patient chart',
				summary:
					'Alerts first, then details, contacts, the medical history, allergies, conditions and medicines.',
				where: '`/dashboard/patients/[id]`',
				permission: 'patients.view to read; patients.edit and patients.clinical to change',
				notes: [
					'The red alerts panel lists severe allergies, medicines with a bleeding, bone or immunity risk, and other allergies — and warns when the medical history was never taken or is over a year old.',
					'Tick **I asked the medical history questions today** only when you did. Correcting a note is not taking a history, and marking it would make an old history look current.',
					'Marking a condition resolved or a medicine stopped records the date by itself.',
					'Every change to a chart is written to the audit trail, and every opening of a chart is recorded in the access log. Holders of **Read the audit trail** see the last few at the bottom of the page and the whole log on the **Access log** tab.'
				],
				keywords: ['allergy', 'condition', 'medication', 'warfarin', 'history', 'emergency contact']
			},
			{
				id: 'dental-chart',
				title: 'Charting teeth',
				summary:
					'The Dental chart tab: what an examination found, what is planned, what was done, and what the patient arrived with — on the teeth it concerns.',
				where: '`/dashboard/patients/[id]/chart`',
				permission: 'patients.view to read; patients.clinical to chart',
				steps: [
					'Open the patient and choose **Dental chart**. The medical alerts stay above the chart.',
					'Click a tooth, then **Chart on tooth**. For work on the whole mouth — an examination, a scale and polish — use **Chart a whole-mouth procedure**.',
					'Choose the service, then the status. The form asks only for what that service needs: surfaces for a filling, the tooth for an extraction, the span for a bridge.',
					'For **Done here**, say who did it and, if it was at a booked visit, which one.'
				],
				notes: [
					'A first examination is usually several **Finding** rows (the decay, the fracture), the **Planned** treatment for each on the same tooth, and **Already present** rows for old fillings and missing teeth. That is what makes the chart honest about what is untreated.',
					'Tooth numbers are FDI: the first digit is the quadrant (1 upper right, 2 upper left, 3 lower left, 4 lower right; 5–8 for a child’s teeth), the second counts from the middle. 36 is the lower left first molar.',
					'A fee left empty takes the service’s standard price. A finding and work done elsewhere are never charged, whatever is typed.',
					'An extraction marked done, or recorded as already present, draws the tooth as missing.',
					'Every procedure change is in the audit trail, and opening the dental chart is recorded in the access log separately from the overview.'
				],
				keywords: [
					'odontogram',
					'tooth',
					'teeth',
					'filling',
					'extraction',
					'caries',
					'surface',
					'FDI',
					'procedure',
					'treatment'
				]
			},
			{
				id: 'treatment-plans',
				title: 'Treatment plans and case acceptance',
				summary:
					'A plan quotes the work planned on the chart, records what the patient said to each line, and keeps the quote as it was given.',
				where: 'A patient’s **Treatment plans** tab, and **Patients → Plan Follow-up**',
				permission: 'patients.view to read; treatment_plans.manage to draw up, present and answer',
				steps: [
					'Chart the treatment as **Planned** on the dental chart first — a plan is made from planned work.',
					'On the **Treatment plans** tab press **New plan**, tick the work to quote, and say who is proposing it. It starts as a **draft**.',
					'On the draft, change a line’s wording or price if you need to — a discount agreed in the chair — or add and remove work. **Print draft** gives the patient something to take away before you commit to it.',
					'Press **Present to patient** and say how long the prices stand (90 days unless you change it).',
					'To correct a presented quote — a discount, a line re-priced after the X-ray, a line quoted twice — change or remove the line as before. You will be asked **why**, and the change is kept in the quote’s history for good.',
					'When the patient answers, mark **Yes** or **No** on every line — or **Yes to all** / **No to all** — and say why for anything they said no to. **Record the answer**.',
					'Book the agreed work as usual. When every agreed line is done on the chart, **Mark plan completed**.'
				],
				notes: [
					'Every change to a presented quote is kept under **Changes since it was presented**: what it was, what it became, why, who and when. Nothing there can be edited or deleted, and **First quoted** always shows what the patient was originally told. A reprinted quote says it was revised and what it first came to.',
					'Work can be added to a quote until the patient answers; after that, new work goes on a new plan. A change to a line the patient already agreed to is marked **Changed after it was agreed** — talk to them again. Removing a line from an answered plan updates its status (taking off the only “no” makes it accepted), and the last line cannot be removed.',
					'An expired, declined or completed quote cannot be changed. If the patient comes back, make a new plan: the old one stays as the record of what they were told.',
					'A quote past its **stands until** date reads as **Expired** everywhere and cannot be answered. Its work is free to go on a new plan at today’s prices.',
					'A piece of planned work can be on only one open plan at a time. Work on a declined or expired plan is free to be quoted again.',
					'Saying no to a line does not change the chart: the work stays planned, because the patient may come back to it.',
					'**Plan Follow-up** lists every quote still awaiting an answer at this branch, the longest-waiting first — the patients to ring. **Case acceptance** there is the share of quoted value patients agreed to over the last 90 days, counting only plans that have been answered.',
					'The reason for a no matters more than the no. “After the harvest”, “wants a second opinion” and “cannot afford it” each call for a different follow-up.',
					'Every step is in the audit trail, and opening or printing a plan is recorded in the access log.'
				],
				keywords: [
					'treatment plan',
					'quote',
					'estimate',
					'case acceptance',
					'follow-up',
					'declined',
					'accepted',
					'expired',
					'present',
					'adjustment',
					'revised',
					'discount'
				]
			},
			{
				id: 'clinical-notes',
				title: 'Clinical notes',
				summary:
					'What was found, what was done, and what was said on the phone — signed, and corrected by adding rather than changing.',
				where: 'A patient’s **Notes** tab',
				permission: 'patients.view to read; patients.clinical to write',
				steps: [
					'Press **Write a note**. Choose the kind — examination, treatment, telephone or other — and give it a one-line summary so the history can be read at a glance.',
					'Choose the visit it describes, if there was one, and the clinician.',
					'Tick **Sign it now** to commit to it. Leave it unticked to save a draft: only you can change, sign or throw away your draft.',
					'To correct a signed note, press **Amend** and write the correction. It is added beneath the original, signed by you.'
				],
				notes: [
					'A signed note is never changed or deleted. A note may be read years later by someone deciding whether care was reasonable, and both what was first written and the correction have to be there.',
					'A draft is marked as a draft for everyone; the tab counts your own unsigned drafts so they are not forgotten.',
					'Write telephone calls down. A call is a record too, and the one most often lost.'
				],
				keywords: [
					'note',
					'clinical note',
					'examination',
					'sign',
					'amend',
					'correction',
					'telephone'
				]
			},
			{
				id: 'prescriptions',
				title: 'Writing a prescription',
				summary:
					'A prescription is checked against the allergies on the chart as each medicine is chosen, and printed for the patient.',
				where: 'A patient’s **Prescriptions** tab',
				permission: 'patients.view to read; patients.clinical to write; a super admin to cancel',
				steps: [
					'Press **Write a prescription**. Read the allergies and what the patient already takes, shown first.',
					'Choose the prescriber — only clinicians marked **Can prescribe** under **Appointments → Dentists** are offered — and say what it is for.',
					'Weigh a child and enter the weight: it is what a child’s dose is worked from.',
					'Add each medicine with its dose, how often, for how many days, how much to hand over, and what the patient is told.',
					'Press **Write the prescription**, then **Print it for the patient**.'
				],
				notes: [
					'A medicine that clashes with an allergy on the chart — amoxicillin for a penicillin allergy — is marked the moment it is chosen. It can be written anyway only by ticking that you have checked, and that tick is recorded.',
					'The check needs each medicine’s **Allergy family**, set under **Admin Panel → Medicines**. A medicine without one is still matched by name.',
					'What it is for is required. It is what lets a clinic look back at how often it prescribes antibiotics, and why.',
					'A prescription is not changed once written — the patient holds the paper. One written in error is cancelled by a super admin and written again; both stay on the audit trail.',
					'Printing is recorded in the access log.'
				],
				keywords: [
					'prescription',
					'prescribe',
					'medicine',
					'antibiotic',
					'allergy',
					'dose',
					'print',
					'rx'
				]
			},
			{
				id: 'patient-files',
				title: 'Files, radiographs and old paper charts',
				summary:
					'Radiographs, photographs, letters and photographed paper charts, attached to the patient they belong to.',
				where: 'A patient’s **Files** tab',
				permission: 'patients.view to open; patients.clinical to attach; a super admin to remove',
				steps: [
					'Press **Attach a file** and say what it is.',
					'Choose the file. A radiograph is uploaded full size; a photograph is made smaller first, to save bandwidth.',
					'For a photographed paper chart, give **the date on the paper**, not today — that date is what makes the old record worth keeping.',
					'For a film of one tooth, give the tooth’s FDI number, like 36.'
				],
				notes: [
					'Click a file to open it full size in a new tab.',
					'Opening a patient’s file needs permission to view patients, and is recorded in who opened the chart — a file link sent to someone without that permission does not open.',
					'Removing a file takes it off the chart; the file itself is kept and the removal is on the audit trail.'
				],
				keywords: [
					'file',
					'radiograph',
					'x-ray',
					'photo',
					'scan',
					'upload',
					'paper chart',
					'attachment'
				]
			},
			{
				id: 'consents',
				title: 'Recording consent',
				summary:
					'What the patient agreed to, how, and before whom — and when they changed their mind.',
				where: 'A patient’s **Consents** tab',
				permission: 'patients.view to read; patients.clinical to record',
				steps: [
					'For a signed form, attach it on the **Files** tab first (as a consent form).',
					'On **Consents**, press **Add**. Choose what it is consent to, how it was given, and the date.',
					'For a child, say who gave it and their relationship — a seven-year-old does not consent to an extraction; a parent does.',
					'A verbal consent must name the clinician who witnessed it. Choose the treatment it is for, if it is for one, and the signed form if there is one.'
				],
				notes: [
					'Verbal consent before a witness is a proper record — it is how a patient who does not read consents. The witness is what stands behind it.',
					'Consent is withdrawn, never deleted: edit it and give the reason. It is dated the day it is withdrawn, and the history reads honestly.'
				],
				keywords: ['consent', 'agreement', 'witness', 'verbal', 'guardian', 'withdraw']
			},
			{
				id: 'merging-duplicates',
				title: 'Merging a duplicate record',
				summary:
					'When one patient was registered twice, everything is moved onto one record and the other leads to it.',
				where: 'The overview of the record to keep, under **Duplicate records**',
				permission: 'A super admin',
				steps: [
					'Open the chart of the record to keep — usually the older, fuller one.',
					'Under **Duplicate records**, the records with the same name or phone are listed with why. Press **Merge into this chart** on the other one, or **Find another record** to search by name.',
					'Confirm. Everything on the other record — visits, treatment, plans, bills and payments, notes, prescriptions, files, consents, allergies — moves here.'
				],
				notes: [
					'The other record becomes a pointer: its file number, on paper charts and old receipts, still leads to this chart.',
					'An allergy, condition or medicine both records have is kept once. A detail this record was missing, like a phone number, is filled from the other.',
					'Who opened the other record stays recorded against it, and is shown with this chart’s views.',
					'A merge is one entry in the audit trail, listing what moved. It is not undone from the screen.'
				],
				keywords: ['merge', 'duplicate', 'registered twice', 'same patient', 'combine']
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'people',
		title: 'Employees, attendance and leave',
		blurb:
			'The people who do the work: hiring them into the system, placing them, and tracking time and leave.',
		topics: [
			{
				id: 'add-employee',
				title: 'Adding an employee',
				summary:
					'One long form, in sections: personal details, contact, employment, salary and next of kin.',
				where: 'Menu → **Employees → Add New Employee** → `/dashboard/employees/add-employee`',
				permission: 'employees.create_followup',
				steps: [
					'**Personal** — full name, sex, date of birth, national ID, marital status, photograph.',
					'**Contact** — phone, email, region, city, subcity and the address details.',
					'**Employment** — department, position, employment status, education level, and the date they started. The employee is filed under the branch you are working at.',
					'**Salary** — the basic salary plus the transport, housing and position allowances. This is what payroll will use.',
					'**Emergency** — next of kin, their relationship and their phone number.',
					'Save. The employee is **pending** until approved.'
				],
				notes: [
					'A pending employee **cannot be paid.** Payroll refuses to include unapproved people and tells you how many it left out — so a new hire missing from a payroll run is almost always an unapproved record.',
					'The lists on this form — departments, positions, employment statuses, education levels — all come from the admin panel. Add the missing value there first rather than typing an approximation.',
					'Get the start date right. Leave accrual and length-of-service entitlements are counted from it.'
				],
				keywords: [
					'employee',
					'hire',
					'staff',
					'new',
					'onboard',
					'add',
					'personal',
					'salary',
					'allowance'
				]
			},
			{
				id: 'employee-lists',
				title: 'Finding an employee',
				summary: 'All active employees, and the inactive list.',
				where: 'Menu → **Employees**',
				steps: [
					'**All Active Employees** — everyone currently employed. Search by name, phone or ID.',
					'**Inactive** — people who have left, kept for history and for reports.',
					"Click a name to open the employee's profile."
				],
				notes: [
					'The list shows the employees of the branch chosen in the top bar. Someone who may see every branch sees everyone.',
					'Filter by department, position or status and print the result for a roster of one team.'
				],
				keywords: ['list', 'roster', 'branch', 'inactive', 'search', 'find', 'employee']
			},
			{
				id: 'employee-profile',
				title: 'The employee profile',
				summary:
					'Everything about one person: details, salary history, leave, attendance, documents and their ID card.',
				where: '`/dashboard/employees/single/[id]`',
				steps: [
					'Open the profile from any employee list.',
					'**Salary** shows the current package and its history, and is where salary changes, bonuses, deductions and overtime are entered for this person.',
					'**Leave history** shows every leave taken, the balance and the entitlement.',
					'**Add leave** records a new leave for them.',
					'**ID maker** produces a printable identity card from the photograph and details on file.',
					'The panel at the bottom shows who entered the record, who approved it and who last changed it.'
				],
				notes: [
					'A salary change is an approval item, not an edit. It is entered here, waits in the **Salary Changes** queue, and only then becomes the figure payroll uses.',
					'Update the photograph before printing an ID card — the card uses whatever is on file.'
				],
				keywords: [
					'profile',
					'employee',
					'single',
					'id card',
					'salary history',
					'leave history',
					'documents'
				]
			},
			{
				id: 'attendance',
				title: 'Attendance',
				summary:
					'A register of who came in and left each day. A scheduled working day with nothing recorded is an absence, and payroll deducts it.',
				where:
					'The **Attendance** tab at the top of the Employees screens → `/dashboard/employees/attendance`, and **Month** for the grid',
				permission: 'attendance.manage',
				steps: [
					'Open the register. It shows today, grouped by department, with whoever has not come first.',
					'Press **In** as each person arrives and **Out** as they leave. The clinic’s clock is stamped; nothing is typed.',
					'On a morning when everyone came, **Everyone scheduled is in** marks them all in at their scheduled start. Correct anyone who was late with **Times**.',
					'For someone away with a reason, press **Excused** and say why. That day is not deducted.',
					'Open **Month** to see every day of the month for everyone, absences in red.'
				],
				notes: [
					'**Absent means scheduled and not recorded.** The schedule is on each employee’s profile. Approved leave, clinic closures, excused days and days off are not absences.',
					'An absence is deducted as a thirtieth of the month’s basic pay. Lateness and leaving early are shown in minutes, and not deducted.',
					'Today reads “Not in yet” until it is over. Days before the branch started keeping the register, and before someone was hired, are not counted — so starting to use it does not turn the past into absences.',
					'Before paying a month, the unpaid salaries page lists anyone with working days still unrecorded. A day in a month already paid cannot be changed.',
					'Every change is on the audit trail.'
				],
				keywords: [
					'attendance',
					'present',
					'absent',
					'clock in',
					'clock out',
					'late',
					'register',
					'timesheet',
					'excused'
				]
			},
			{
				id: 'leave-basics',
				title: 'How leave works',
				summary:
					'Each leave type has an entitlement. Days accrue over time, are spent by approved leaves, and can expire under the policy you set.',
				where: 'Menu → **Employees → Leaves** → `/dashboard/employees/leaves`',
				permission: 'leaves.view_approved for the approved list',
				steps: [
					'A leave is requested for a person, with a type, a start date and an end date.',
					'It appears in **Pending**, where an approver settles it.',
					"Approved leave is deducted from that employee's balance and shows in **Approved**.",
					'Withdrawn or refused leave lands in **Cancelled**, with the reason.'
				],
				notes: [
					'**Half days.** Either boundary of a leave can be marked a half day. A single day marked half costs 0.5; a multi-day leave with both ends half costs a full day less than its calendar span. The figure the form previews is exactly the figure the balance is charged.',
					'The length is worked out once and stored on the leave, so the number you approved is the number that is spent — it is never silently recomputed later.',
					"Balances only move on **approved** leave. A pending request does not reduce anyone's balance."
				],
				keywords: [
					'leave',
					'holiday',
					'absence',
					'balance',
					'half day',
					'entitlement',
					'accrual',
					'annual'
				]
			},
			{
				id: 'leave-config',
				title: 'Leave types, entitlements, accrual and expiry',
				summary: 'The rules behind the balances, all set in the admin panel.',
				where: 'Menu → **Admin Panel**',
				permission: 'settings.manage',
				steps: [
					'**Leave Types** — the kinds of leave that exist: annual, sick, maternity, unpaid, and so on.',
					'**Annual Leave Entitlements** — how many days a person is due, usually stepped by length of service.',
					'**Leave Expiry Policy** — whether unused days carry into the next year, and for how long before they lapse.',
					'**Run Leave Accrual** — grants the accrued days across the workforce for a period.'
				],
				notes: [
					'Accrual also runs on a schedule of its own (`/api/cron/leave-accrual`). The manual run is there for a correction or a catch-up, not for routine use.',
					'Changing an entitlement changes what people are due from that point. Check the leave report afterwards to see what actually moved.'
				],
				keywords: [
					'leave type',
					'entitlement',
					'accrual',
					'expiry',
					'carry over',
					'policy',
					'cron',
					'grant'
				]
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'billing',
		title: 'Billing, payments and the cash drawer',
		blurb:
			'Billing a patient for work done, taking their money, and counting the drawer at the end of the day.',
		topics: [
			{
				id: 'raising-a-bill',
				title: 'Raising a bill',
				summary:
					'A bill is made from the completed work on the chart, as a draft, and issued once it is right.',
				where: 'A patient’s **Billing** tab',
				permission: 'billing.invoice',
				steps: [
					'Treatment has to be marked **done** first — on the dental chart, or by completing the visit in the diary. Only completed work with a fee can be billed.',
					'On the patient’s **Billing** tab press **Raise a bill** and tick the work. It starts as a **draft**.',
					'On the draft, add anything that is not charted treatment with **Add a charge** (a missed-appointment fee, something sold), change a line, or add a **discount**.',
					'Press **Issue the bill**. It gets its number (INV-year-number) and is fixed from then on. Set a due date only if the patient is not paying on the day.',
					'**Print** gives the patient the bill, with every payment and its receipt number on it.'
				],
				notes: [
					'An issued bill is never edited. What the patient holds and what the system shows stay the same.',
					'A piece of work goes on one bill. Once it is on a bill — even a draft — it is not offered again, unless that bill is thrown away or voided.',
					'A draft can be thrown away. An issued bill is **voided**, and only through a manager (below).',
					'Medical services are exempt from VAT, so no bill carries VAT.'
				],
				keywords: ['bill', 'invoice', 'charge', 'draft', 'issue', 'print', 'receipt']
			},
			{
				id: 'taking-payment',
				title: 'Taking a payment',
				summary:
					'One payment can settle several bills, and one bill can be paid off in several payments.',
				where: 'A patient’s **Billing** tab, or a bill’s own page → **Take a payment**',
				permission: 'billing.invoice',
				steps: [
					'Press **Take a payment**. Every bill that can be paid is listed with what it still owes.',
					'Type the amount against each bill being paid — or **Pay everything owed** — and choose how it was paid.',
					'Add the bank or mobile-money reference if there is one, and **Record payment**. Each payment gets a receipt number.'
				],
				notes: [
					'A payment can never be more than a bill still owes.',
					'**Cash** needs the cash drawer open at the branch you are working at. If it is shut, the form says so and the payment is refused.',
					'A bill waiting for a manager — for its discount, or to be voided — cannot take a payment until the manager decides.',
					'What a patient owes shows in red at the top of their chart, on the Billing tab, and in the patient list, for staff who can see billing.'
				],
				keywords: ['payment', 'pay', 'cash', 'bank', 'telebirr', 'installment', 'balance', 'owes']
			},
			{
				id: 'discounts-and-voids',
				title: 'Discounts and voids',
				summary:
					'A big discount, and any void, need a manager before they take effect — the two ways money leaves a cash practice unnoticed.',
				where: '**Approvals → Discounts and Voids**',
				permission: 'approvals.approve to decide; billing.invoice to ask',
				steps: [
					'A bill issued with a discount over the clinic’s limit (**Admin Panel → Billing Settings**, 10% unless changed) waits for a manager.',
					'To void an issued bill, open it and press **Void**, and say why. Only a bill with nothing paid against it can be voided — refund the money first.',
					'The manager approves or refuses it in **Approvals → Discounts and Voids**.'
				],
				notes: [
					'An approved discount stands; a refused one comes off, and the bill stands at its full price.',
					'An approved void makes the bill **Void**: it keeps its number, and its work can be billed again. A refused void leaves the bill as it was.',
					'Nobody approves their own request unless they hold the override permission, and that is recorded.'
				],
				keywords: ['discount', 'void', 'cancel', 'approve', 'manager', 'threshold']
			},
			{
				id: 'refunds',
				title: 'Giving money back',
				summary:
					'A refund is asked for at the desk and approved by a manager; only then does the bill owe it again, and only then does cash leave the drawer.',
				where: 'The bill’s own page → **Payments → Refund**',
				permission: 'billing.invoice to ask; approvals.approve to decide',
				steps: [
					'Open the bill, find the payment the money came from, and press **Refund** beside it.',
					'Enter how much, how it is being given back, and why. You cannot give back more than that payment put on the bill, less refunds of it already asked for.',
					'A manager approves it in **Approvals → Refunds**. A cash refund needs the drawer open at the branch when it is approved.'
				],
				notes: [
					'While it waits, the refund shows on the bill as *waiting for approval* and changes nothing. A refused one stays listed, struck through.',
					'Once approved it gets its own number (**RFD-…**), the bill owes the amount again, and a cash refund comes out of what the drawer should hold.',
					'To cancel a bill that has been paid, refund the payments first, then void it.'
				],
				keywords: ['refund', 'money back', 'return', 'reverse', 'overpaid', 'rfd']
			},
			{
				id: 'payers',
				title: 'Employers and insurers',
				summary:
					'A payer is an organisation that pays for some patients. Their bills go to them, and they pay many at once.',
				where: 'Menu → **Payers**; **Bill to** on a draft bill',
				permission: 'customers.record for the payer; billing.invoice for their bills',
				steps: [
					'Add the payer under **Payers → Add a payer**. It waits for approval like any new payer.',
					'Link a patient to their payer on registration. Every bill raised for that patient starts with **Bill to** set to the payer.',
					'On a draft bill, **Bill to** can be changed — to the patient, or to another payer. It is fixed once the bill is issued, and printed on it.',
					'When the payer pays, open them under **Payers** and press **Take a payment**. Put an amount against each bill the transfer covers.'
				],
				notes: [
					'A bill sent to a payer is in the payer’s row on **Who Owes**, not the patient’s — the desk chases whoever is paying.',
					'The patient still sees the bill on their own Billing tab, and can pay it themselves if the payer will not.'
				],
				keywords: [
					'insurer',
					'insurance',
					'employer',
					'company',
					'payer',
					'customer',
					'bill to',
					'credit'
				]
			},
			{
				id: 'cash-drawer',
				title: 'The cash drawer',
				summary:
					'Open it with a float in the morning; count it at night. The system says what it should hold.',
				where: '**Billing → Cash Drawer**',
				permission: 'billing.cash_session',
				steps: [
					'In the morning, **Open the drawer** with the float — what is in it before the first patient pays.',
					'Through the day the page shows the cash taken and what the drawer **should hold**.',
					'At night, count the cash and press **Count and close**. Type the total counted and how much is being taken out to bank; the rest is tomorrow’s float.',
					'If the count is over or short, say what you know about why. It will not close without a note.'
				],
				notes: [
					'One drawer per branch at a time. Cash cannot be taken while it is closed.',
					'What the drawer should hold is written down at the moment of the count, so nothing entered later can change a day already counted.',
					'**Recent counts** lists the last month with each day’s over or short — a drawer that keeps coming up short shows as a pattern.'
				],
				keywords: ['cash', 'drawer', 'till', 'float', 'count', 'variance', 'short', 'over', 'bank']
			},
			{
				id: 'who-owes',
				title: 'Who owes',
				summary: 'Everyone at this branch with unpaid bills, the most owed first.',
				where: 'Menu → **Billing → Who Owes**',
				permission: 'billing.invoice',
				notes: [
					'**Open bills** goes to the patient’s Billing tab, where the payment is taken.',
					'Bills sent to an employer or insurer are listed under **Payers who owe**, and not again under the patient.',
					'The count of bills waiting for a manager is shown beside it, with a link to the queue for those who decide.'
				],
				keywords: ['receivables', 'debt', 'outstanding', 'owes', 'unpaid']
			}
		]
	},

	{
		id: 'finance',
		title: 'Payroll and finance',
		blurb:
			'Paying people, and the money movements around it: overtime, deductions, payroll runs, transactions and expenses.',
		topics: [
			{
				id: 'payroll-cycle',
				title: 'The monthly payroll cycle',
				summary:
					'Attendance first, then overtime, bonuses and deductions, then the run, then the receipt — in that order, every month.',
				where: 'Menu → **Finance**',
				permission: 'salary.manage',
				steps: [
					'Make sure **attendance** for the month is entered and every new hire has been **approved**.',
					'Record **overtime**, **bonuses** and **deductions** dated in the month (`Finance → Overtime / Bonuses / Deductions`).',
					'Open **All UnPaid Salaries** for the month.',
					'Check the figures at the top: gross, tax, pension and net, for everyone or for those ticked.',
					'Tick who is being paid, press **Pay**, choose the account, the payment date and attach the transfer receipt.',
					'Pay. The run is created, every payslip written, and the transaction recorded — all in one go.',
					'The run then waits in the **Payroll Runs** approval queue.'
				],
				notes: [
					'The whole run is one transaction: if anything fails, nothing is written. You will never find half a month paid.',
					'**The figures on screen are a preview.** Each payslip is worked out again at the moment it is paid, from the same rules, so an overtime entry recorded after the page was opened is still paid — and nothing typed or changed in the browser can alter an amount.',
					'Somebody already paid for the month is refused rather than paid twice; reload the page and they are gone from the list.',
					'Unapproved employees are refused with a count, so if the total looks light, check the approvals queue before you check your arithmetic.',
					'Attach the bank transfer receipt at the moment you run it. That receipt is what reconciles the payroll to the bank statement.',
					'**Commission** is worked out, not entered. A salary with Commission set to Yes earns its percentage of the fees of every procedure the employee completed in the month, at the rate in force on the day of the work, and it is added to gross pay and taxed with it. Procedures not yet marked completed on the chart are not paid on.'
				],
				keywords: [
					'payroll',
					'run',
					'salary',
					'month',
					'pay',
					'process',
					'cycle',
					'net',
					'gross',
					'commission'
				]
			},
			{
				id: 'payroll-months',
				title: 'Months and periods',
				summary: 'Paying is done a month at a time; reading is done over any period you choose.',
				notes: [
					'**All UnPaid Salaries** is a month — a payroll run pays one — and opens on the current month. Change it with the selector at the top; the month is in the address, so a link to it can be sent.',
					'**Paid Salaries**, **Overtime**, **Bonuses** and **Deductions** are not months. Choose any date range, or the Month filter on Paid Salaries, and the totals at the top count everything that matches.'
				],
				keywords: ['month', 'period', 'ethiopian', 'unpaid', 'paid', 'select month', 'range']
			},
			{
				id: 'overtime-deductions',
				title: 'Overtime, bonuses and deductions',
				summary:
					'The variable parts of a payslip: dated entries the next run picks up, kept in one list each.',
				where:
					'Menu → **Finance → Overtime / Bonuses / Deductions** → `/dashboard/salary/ledger/overtime`',
				permission: 'salary.manage',
				steps: [
					'Open the list and press **Record**.',
					'Tick one or more employees — the list searches — then the date.',
					'Overtime: choose the type and the hours. The pay is worked out for each person from their approved salary on that day and the type’s rate, set in **Admin Panel → Overtime Types**.',
					'A bonus or a deduction: the amount, and for a deduction what kind and why.',
					'Everything dated in a month is paid by that month’s run.'
				],
				notes: [
					'All or nothing: if one chosen employee cannot be recorded — not approved, no salary that day, over the type’s hour limit — nobody is, and the message says who.',
					'**A paid month is closed.** An entry dated where an employee has already been paid would never be paid, so it is refused; paid entries cannot be changed or removed. Record a correction in the next unpaid month, or adjust the payslip.',
					'Each list filters by any date range, department, position, type and whether it has been paid, and totals what matches. The tabs switch lists and keep your dates.',
					'Every entry, change and removal is on the audit trail. Removing one is a super administrator’s.'
				],
				keywords: ['overtime', 'deduction', 'bonus', 'advance', 'penalty', 'allowance', 'variable']
			},
			{
				id: 'paid-salaries',
				title: 'Paid salaries and adjustments',
				summary: 'Every payslip ever paid, over any period, and how to correct one after the fact.',
				where: 'Menu → **Finance → Paid Salaries** → `/dashboard/salary/paid-salaries`',
				steps: [
					'Open **Paid Salaries**. Choose a date range or a month, and narrow by department, position, how it was paid or status.',
					'The totals at the top — gross, tax, both pension shares, net — count everything that matches.',
					'Click a month to open that run: its payslips, its bank receipts, its adjustments, and finalising it.',
					'To correct one payslip, open its run and use **Adjust**.'
				],
				notes: [
					'An adjustment is a new record, not an edit of the original payslip. The original stays exactly as it was paid, and the adjustment carries the correction with its own approval — that is what keeps a paid month auditable.',
					'Adjustments have their own approval queue, **Payroll adjustments**.'
				],
				keywords: ['paid', 'payslip', 'adjust', 'correction', 'history', 'month', 'print payslip']
			},
			{
				id: 'transactions',
				title: 'Transactions and expenses',
				summary:
					"Every movement of money that is not a customer collection, and the company's own spending.",
				where: 'Menu → **Finance → Transactions** → `/dashboard/salary/transactions`',
				permission: 'transactions.manage',
				steps: [
					'**Transactions** lists money in and money out, browsable by date range.',
					"**Expenses** (`/dashboard/salary/transactions/expenses`) is the company's own spending, by category.",
					'**Add expense** records one: category, amount, date, payment method, description and receipt.',
					'**Categories** manages the list the expense form chooses from.',
					'Expenses wait in the **Expenses** approval queue before they count.'
				],
				notes: [
					'Categorise expenses as you enter them. The money report is only as useful as the categories underneath it.',
					'A payroll run writes its own transaction automatically — you do not enter it a second time by hand.'
				],
				keywords: [
					'transaction',
					'expense',
					'spending',
					'category',
					'money out',
					'petty cash',
					'receipt'
				]
			},
			{
				id: 'tax-config',
				title: 'Tax, pension, VAT and withholding settings',
				summary: 'The rates payroll and billing apply, all set in one place.',
				where: 'Menu → **Admin Panel**',
				permission: 'settings.manage',
				steps: [
					'**Tax Types** — the income tax bands payroll applies.',
					'**Pension** — the employee and employer contribution rates.',
					'**Vat and Withhold** — the VAT rate and the withholding rates used on collections.',
					'**Payment Methods** — cash, transfer, cheque.',
					'**Overtime Types** — the overtime categories and their multipliers.'
				],
				notes: [
					'These change what the system calculates from the moment you save them. They do not rewrite anything already calculated — an old payslip keeps the rates it was paid under, which is correct.',
					'Change a rate at a month boundary wherever you can. Changing one mid-month makes the month hard to explain afterwards.'
				],
				keywords: [
					'tax',
					'pension',
					'vat',
					'withholding',
					'rate',
					'band',
					'payment method',
					'settings'
				]
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'supplies',
		title: 'Supplies and suppliers',
		blurb:
			'What the clinic keeps in store, who it was bought from, and what needs reordering before it runs out.',
		topics: [
			{
				id: 'stock-levels',
				title: 'Stock levels and reordering',
				summary:
					'Every supply carries a quantity and a reorder level. Fall below it and the item appears on the dashboard.',
				where: 'Menu → **Supplies → Stock Levels** → `/dashboard/supplies`',
				permission: 'supplies_suppliers.manage',
				steps: [
					'**Stock Levels** lists every item with how much is in store and whether it is returnable or consumable.',
					'Click an item to open it: its lots with their expiry dates, its movement history and its damaged records over a date range.',
					'**Add Supply** registers a new item: name, type, unit, whether it is returnable, whether it **expires**, and its reorder level.',
					"Stock comes in on the item's own page: **Change Quantity → Add**, with the quantity, the expiry date on the box, the lot number, the supplier, the cost per unit and the account it was paid from. A purchase is recorded as money out at the same time.",
					'Anything at or below its reorder level shows in **Supplies to reorder** on the dashboard home.'
				],
				notes: [
					'Set the reorder level to cover the time it actually takes to get more, not to zero. An alert that fires the day you run out is not an alert.',
					'Supply types are reference data and live in **Supplies → Supply Types**.',
					'Damaged and lost items are recorded against the item so the shrinkage is visible in the stock report rather than hidden in a quantity that quietly changed.',
					"Tick **Deductible** on a damage report only when the cost is to come out of someone's pay. Choose the employee; the deduction is priced at the item's last recorded delivery cost and appears on their next payslip. Deleting the report puts the units back into the lots they came from; the deduction is payroll and stays — delete it under **Salary → Deductions** if it should not stand."
				],
				keywords: [
					'stock',
					'inventory',
					'reorder',
					'quantity',
					'supply',
					'damaged',
					'level',
					'shortage'
				]
			},
			{
				id: 'stock-lots',
				title: 'Where the quantity comes from',
				summary:
					'Every delivery is kept as its own lot, and the quantity in store is the sum of them.',
				notes: [
					'The quantity is worked out from the lots each time it is shown, never kept as a running total, so it cannot drift from what was actually received and used.',
					'Using stock takes it from the lot that expires first. The oldest composite or anaesthetic is used before it goes off, and every movement names the lot it came from.',
					'An item marked **Expires** — anaesthetic, composite, bonding agent — cannot be received without the expiry date on the box, and a date that has already passed is refused. Other items may carry a date or not; an undated lot is used after every dated one.',
					'An expired lot is never issued. It stays in the quantity, because it is still on the shelf, until it is written off as damaged. The item’s page lists each lot, the next to be used at the top, red once it has expired and amber within three months of it.'
				],
				keywords: [
					'lot',
					'batch',
					'expiry',
					'expire',
					'first expired',
					'quantity',
					'stock',
					'derived'
				]
			},
			{
				id: 'suppliers',
				title: 'Suppliers',
				summary: 'Who you buy from, their details, and what you have bought from them.',
				where: 'Menu → **Supplies → Suppliers**',
				permission: 'supplies_suppliers.manage',
				steps: [
					'**Suppliers** lists them all with their contact details.',
					'**Add Supplier** creates one: name, TIN, phone, email and address.',
					'Open a supplier to see the purchases recorded against them.'
				],
				notes: [
					"Deleting a supplier hides them from the pickers but leaves the purchase history intact. That is why last year's figures do not change when you tidy the list.",
					'The advanced filter on this list is the fastest way to answer "who did we spend more than X with".'
				],
				keywords: ['supplier', 'vendor', 'purchase', 'buy', 'spend', 'contact', 'tin']
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'reports',
		title: 'Reports',
		blurb:
			'Ten report pages over the same data, each with charts and totals on top and the underlying ledger underneath.',
		topics: [
			{
				id: 'reports-how',
				title: 'How every report page works',
				summary:
					'Set the date range and the scope at the top; the charts and the totals answer for that slice; then pick a ledger to see the rows behind them.',
				where: 'Menu → **Reports** → `/dashboard/reports`',
				permission: 'reports.clinic, reports.finance, reports.hr or audit_logs.view, by page',
				steps: [
					'Choose the **start** and **end** dates. Both ends are included.',
					'Press **Filters** and narrow the scope: department, position, branch, customer, employment status, education, gender, employee, payment method, expense type — plus a search over the open ledger and a page size. The badge on the button counts how many narrowings are active.',
					'Read the tiles and the charts: they are the totals for exactly that slice.',
					'Choose a **section** below them to load the detail rows: payslips, attendance, expenses, stock movements, and so on.',
					'Filter the detail table further if you need to, then print or export it.'
				],
				notes: [
					'Only the ledger you ask for is fetched. The tiles and charts stay fast however much history the range covers, because the expensive part is the one table you chose.',
					'Every detail table exports and prints like any other table in the system, so a board pack is a matter of choosing the range and pressing the button.',
					'A total that looks wrong is nearly always a scope question — check the date range and the branch filter before anything else.',
					'**Your query follows you.** Move to another report with the buttons under the heading and the range and the filters come with it, so a slice set once can be read across People, Payroll, Compensation, Time & Leave, Stock and Money without setting it again.'
				],
				keywords: ['report', 'range', 'filter', 'export', 'chart', 'total', 'section', 'ledger']
			},
			{
				id: 'reports-pages',
				title: 'What each report covers',
				summary: 'Nine pages, grouped by the question you are asking.',
				steps: [
					'**Overview** (`/dashboard/reports`) — the company at a glance: payroll and revenue together.',
					'**Clinic** — production per dentist, procedures by service, case acceptance, recalls, what is owed and for how long, cash drawer counts and lab turnaround.',
					'**People** — headcount, hires, terminations, the workforce as it stands.',
					'**Payroll** — runs, payslips, adjustments, receipts and salary changes.',
					'**Compensation** — bonuses, overtime, commissions and deductions.',
					'**Time & Leave** — attendance, leaves taken and leave granted.',
					'**Stock** — stock levels, supply adjustments and damaged items.',
					'**Money** — transactions, expenses and services rendered.',
					'**System** — the audit log: who did what, and when; and the patient record access log: who opened whose chart.'
				],
				notes: [
					'The permissions split the same way the questions do: `reports.clinic` for the clinic page, `reports.hr` for people and leave, `reports.finance` for the money and stock pages, `audit_logs.view` for the system report.',
					'The clinic report reads the branch chosen in the top bar. Production there is the fee of work completed, not money collected — that is the Money report.',
					'The stock report is also linked from the supplies menu, because that is where you are standing when you want it.'
				],
				keywords: [
					'people',
					'payroll',
					'compensation',
					'leave',
					'stock',
					'money',
					'audit',
					'system'
				]
			},
			{
				id: 'audit-log',
				title: 'The audit log',
				summary:
					'A record of what happened in the system, readable by the people responsible for it.',
				where: 'Menu → **Reports → System** → `/dashboard/reports/system`',
				permission: 'audit_logs.view',
				notes: [
					"Use it for a question the record's own system-information panel cannot answer — a change you cannot account for, or a sequence of events you need in order.",
					'It is a report like any other: set the range, filter it, export it.'
				],
				keywords: ['audit', 'log', 'history', 'who did', 'trail', 'system', 'security']
			},
			{
				id: 'access-log',
				title: 'Who has opened a patient’s chart',
				summary:
					'Every opening and printing of a part of a patient’s chart is recorded. Read it per patient, or per member of staff.',
				where:
					'The patient’s **Access log** tab, or Menu → **Reports → System** → section **Patient Record Access**',
				permission: 'audit_logs.view',
				steps: [
					'For one patient — when they ask who has seen their record — open their chart and the **Access log** tab.',
					'For one member of staff, open the System report, choose **Patient Record Access**, set the range, and search their name.'
				],
				notes: [
					'Each row says which part of the chart was opened — notes, prescriptions, billing — not only that the chart was.',
					'Repeat openings by the same person within ten minutes count once, so the log shows visits rather than clicks.',
					'Views of a record merged into another are shown under the surviving chart.'
				],
				keywords: ['access', 'privacy', 'who looked', 'viewed', 'opened', 'confidential']
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'admin',
		title: 'Admin panel',
		blurb:
			'Users, roles and every reference list the rest of the system chooses from. Small screens, wide consequences.',
		topics: [
			{
				id: 'admin-overview',
				title: 'What the admin panel is',
				summary:
					'The lists that populate every dropdown in the system, plus the accounts and roles of the people using it.',
				where: 'Menu → **Admin Panel** → `/dashboard/admin-panel`',
				permission: 'settings.manage; users and roles need their own',
				notes: [
					'If a form does not offer the value you need, this is where you add it — then go back to the form.',
					'These lists are shared by everybody. Renaming a department renames it on every employee attached to it.',
					'Deleting a reference value hides it from the pickers without breaking the records already using it.'
				],
				keywords: [
					'admin',
					'settings',
					'configuration',
					'reference',
					'lists',
					'dropdown',
					'master data'
				]
			},
			{
				id: 'users',
				title: 'User accounts',
				summary: 'Creating accounts, assigning roles, and resetting passwords.',
				where: 'Menu → **Admin Panel → Users** → `/dashboard/admin-panel/users`',
				permission: 'users.manage',
				steps: [
					'**Add user** creates an account: name, username, password and the role it carries.',
					'Use the password generator rather than inventing one, and hand it over in person.',
					'Open a user to change their name, email or role, or add a special permission. A forgotten password is reset by the user, from the login screen.',
					'When somebody leaves, remove their access here the same day.'
				],
				notes: [
					'A **special permission** is granted to one person on top of their role, for a responsibility that does not justify a whole new role.',
					'One account per person, always. Every approval in the system names a person, and a shared account makes that name worthless.'
				],
				keywords: ['user', 'account', 'password', 'role', 'access', 'special permission', 'leaver']
			},
			{
				id: 'roles',
				title: 'Roles and permissions',
				summary:
					'A role is a named bundle of permissions. Change the bundle and everyone holding it changes with it.',
				where: 'Menu → **Admin Panel → Roles** → `/dashboard/admin-panel/roles`',
				permission: 'roles.manage',
				steps: [
					'**Add role** names a new one and ticks the permissions it carries.',
					'Open a role to change what it holds. Everyone with that role is affected as soon as you save.',
					'Give the least that lets somebody do their job — permissions are cheap to add later and awkward to take back.'
				],
				notes: [
					'Keep the approving permissions away from the entering ones. Handing one person both `payment_requests.create` and `payment_requests.approve` quietly cancels the check the whole system is built around.',
					'`approvals.override` lets its holder release their own requests. It should be rare, and it is recorded every time it is used.',
					'Someone holding every permission becomes a **super admin** by consequence, with the destructive actions unlocked. Grant a complete set only when you mean exactly that.'
				],
				keywords: [
					'role',
					'permission',
					'grant',
					'restrict',
					'least privilege',
					'separation of duties',
					'override'
				]
			},
			{
				id: 'reference-lists',
				title: 'The reference lists',
				summary:
					'Every dropdown in the system is one of these, and each is a small table you can add to.',
				where: 'Menu → **Admin Panel**',
				permission: 'settings.manage',
				steps: [
					'**Places** — Regions, Cities, Subcities. They cascade: a city belongs to a region, a subcity to a city.',
					'**People** — Departments, Positions, Employment Statuses, Educational Levels.',
					'**Work** — Services and their categories, Supply Types.',
					'**Leave** — Leave Types, Annual Leave Entitlements, Leave Expiry Policy, Run Leave Accrual.',
					'**Money** — Payment Methods, Tax Types, Overtime Types, Pension, Vat and Withhold.'
				],
				notes: [
					'The places cascade, so add the region before the city and the city before the subcity, or the new value will have nothing to hang from.',
					'**Services** are the treatments the clinic offers — a consultation, a filling, an extraction — with a standard price and what the dental chart asks for when one is recorded. They live in **Clinic Setup → Services**.'
				],
				keywords: [
					'region',
					'city',
					'subcity',
					'department',
					'position',
					'service',
					'employment status',
					'education',
					'reference',
					'lookup'
				]
			},
			{
				id: 'backup',
				title: 'Backups',
				summary: 'The whole database and every uploaded file, downloaded as one archive.',
				where: '`/dashboard/backup`',
				permission: 'settings.manage',
				steps: [
					'Open the backup route while signed in with `settings.manage`.',
					'The download begins: the latest database snapshot together with the uploaded-files folder, as one compressed archive.',
					'Store it somewhere that is not the same machine as the system.'
				],
				notes: [
					'A backup is the entire business in one file. It sits behind the settings permission for that reason, not because it is a technical screen.',
					'The system records when a backup was last downloaded, so a gap in that habit is visible.',
					'A backup you have never restored is a hope, not a plan. Ask amno to prove a restore periodically.'
				],
				keywords: ['backup', 'download', 'archive', 'restore', 'disaster', 'export', 'database']
			}
		]
	},

	/* ------------------------------------------------------------------ */
	{
		id: 'questions',
		title: 'Common questions',
		blurb: 'The things people ask in the first month, answered.',
		topics: [
			{
				id: 'q-missing-menu',
				title: 'A menu item I need is not there',
				summary:
					'The menu shows only what your permissions allow, so a missing entry is a permission, not a fault.',
				steps: [
					'Check with a colleague who has the same job — if they see it and you do not, it is your role.',
					'Ask an administrator to add the permission to your role, or to grant it to you as a special permission.'
				],
				notes: [
					'Typing the address by hand will not get you in: the same rule runs on the server.',
					'A whole group disappears when you hold none of its screens, which is why sometimes an entire heading seems to be missing.'
				],
				keywords: ['missing', 'menu', 'cannot see', 'permission', 'hidden', '403', 'access']
			},
			{
				id: 'q-missing-record',
				title: 'A record I entered is not in the list',
				summary: 'It is nearly always waiting for approval, or it was deleted.',
				steps: [
					'Check the approval queue for that kind of record — a pending record does not show in the ordinary lists.',
					'Check the rejections desk in case it was turned back with a reason.',
					'If it was deleted, ask an administrator; the record still exists and can be discussed.'
				],
				notes: [
					'Do not re-enter it. A duplicate that then gets approved is far more work to unpick than a missing one is to find.'
				],
				keywords: [
					'missing',
					'record',
					'not showing',
					'pending',
					'deleted',
					'disappeared',
					'duplicate'
				]
			},
			{
				id: 'q-cannot-approve',
				title: 'It will not let me approve this',
				summary:
					'Either you requested it yourself, or you do not hold the approval permission for that queue.',
				notes: [
					'Releasing your own request needs `approvals.override`, which is deliberately rare. Ask a colleague to settle it.',
					'`approvals.view` lets you watch the queues; `approvals.approve` is what settles them. They are separate on purpose.',
					'A rejection without a reason is refused. Type the reason and it goes through.'
				],
				keywords: ['approve', 'cannot', 'own request', 'override', 'blocked', 'reason', 'refused']
			},
			{
				id: 'q-payroll-short',
				title: 'Payroll is missing people, or the total looks wrong',
				summary:
					'Unapproved employees are excluded, and anything entered after the run is not in it.',
				steps: [
					'Read the message from the run — it names the count of unapproved employees it refused to pay.',
					'Approve them in the **Employees** queue and run again for the remainder.',
					"Check that the month's attendance, overtime and deductions were all entered before the run.",
					'For something already paid, use **Adjust** on the payslip rather than editing the run.'
				],
				keywords: [
					'payroll',
					'missing',
					'wrong total',
					'unapproved',
					'short',
					'adjust',
					'recalculate'
				]
			},
			{
				id: 'q-vat-total',
				title: 'My VAT total looks absurd',
				summary: 'The VAT column holds a **rate**, not an amount. Adding it up sums percentages.',
				notes: [
					'Take VAT from the reports, which derive it from the amount and the rate rather than adding the column.',
					'The same applies to any spreadsheet you export: the VAT column in the export is the rate too.'
				],
				keywords: ['vat', 'total', 'sum', 'rate', 'percentage', 'wrong', 'tax']
			},
			{
				id: 'q-export',
				title: 'How do I get this into Excel, or onto paper?',
				summary: 'The download button above every table does both.',
				steps: [
					'Filter and sort the table until it shows exactly what you want, and switch off the columns you do not need.',
					'Press the download button.',
					'**Export to CSV** saves a file that opens in Excel. **Print** opens the print dialog, where "Save as PDF" writes a PDF.'
				],
				notes: [
					'The export takes the table as it stands, so the filtering is the work and the export is the easy part.',
					'Very wide tables print on landscape A3 automatically; you do not need to set anything.'
				],
				keywords: ['excel', 'csv', 'export', 'print', 'pdf', 'download', 'paper', 'share']
			},
			{
				id: 'q-support',
				title: 'Something is broken, or something is missing from this manual',
				summary: 'The system is built and maintained by amno ERP Solutions.',
				notes: [
					'Note the screen you were on, what you pressed and the exact message you saw. Those three things usually settle it immediately.',
					'If you find yourself repeatedly wanting a screen the system does not have, say so — the shape of it is already here, and adding to it is ordinary work.'
				],
				keywords: ['support', 'bug', 'broken', 'help', 'contact', 'amno', 'developer', 'missing']
			}
		]
	}
];

/* -------------------------------------------------------------------------- */
/*  Route map                                                                 */
/* -------------------------------------------------------------------------- */

export type RouteEntry = {
	path: string;
	title: string;
	purpose: string;
	/** The permission the server gate demands, or undefined when the route is open to any signed-in user. */
	permission?: string;
	group: string;
	/**
	 * Set on the addresses that *do* something rather than show a screen — the backup
	 * download, the accrual job. The route map never offers them as links, because a
	 * stray click on a help page should not start a database download.
	 */
	nonNavigable?: boolean;
};

/**
 * Every address in the system, what it is for, and what it sits behind.
 *
 * The permissions here mirror `$lib/routeAccess` — that file is what the server
 * actually enforces; this list is how it is explained.
 */
export const ROUTE_MAP: RouteEntry[] = [
	// Outside the dashboard
	{
		path: '/login',
		title: 'Sign in',
		purpose: 'Username and password. Everything else redirects here without a session.',
		group: 'Access'
	},
	{
		path: '/forgot-password',
		title: 'Forgot password',
		purpose: 'Starts a password reset for an account you cannot get into.',
		group: 'Access'
	},

	// Dashboard core
	{
		path: '/dashboard',
		title: 'Dashboard home',
		purpose:
			'Today at a glance: appointments booked, work done, money in and out, and supplies running low. Open to every signed-in user.',
		group: 'Dashboard'
	},
	{
		path: '/dashboard/help',
		title: 'Help',
		purpose: 'This page — every topic, the route map and the printable manual.',
		group: 'Dashboard'
	},
	{
		path: '/dashboard/change-password',
		title: 'Change password',
		purpose: 'Change your own password; requires the current one.',
		group: 'Dashboard'
	},
	{
		path: '/dashboard/files/[name]',
		title: 'Uploaded file',
		purpose: 'Serves an attached receipt, radiograph or photograph. Requires a session.',
		group: 'Dashboard'
	},
	{
		path: '/dashboard/backup',
		title: 'Backup download',
		purpose:
			'Database snapshot plus the uploaded files, as one archive. Opening it starts the download.',
		permission: 'settings.manage',
		group: 'Dashboard',
		nonNavigable: true
	},

	// Payers (the `customers` table: employers and insurers)
	{
		path: '/dashboard/customers',
		title: 'All payers',
		purpose: 'Every employer and insurer that pays for some patients, searchable and exportable.',
		permission: 'customers.record',
		group: 'Payers'
	},
	{
		path: '/dashboard/customers/add-customer',
		title: 'Add a payer',
		purpose: 'Register an employer or insurer; starts pending.',
		permission: 'customers.record',
		group: 'Payers'
	},
	{
		path: '/dashboard/customers/[id]',
		title: 'Payer',
		purpose:
			'One payer: contacts and address, the bills sent to them across patients, what they owe, and taking their payment.',
		permission: 'customers.record',
		group: 'Payers'
	},

	// Approvals & rejections
	{
		path: '/dashboard/approvals',
		title: 'Approval queues',
		purpose: 'What is waiting in each queue.',
		permission: 'approvals.view',
		group: 'Approvals'
	},
	{
		path: '/dashboard/approvals/[entity]',
		title: 'One approval queue',
		purpose:
			'Settle pending records: employees, salary changes, expenses, payroll runs, payroll adjustments, payers, invoice discounts and voids, refunds.',
		permission: 'approvals.approve',
		group: 'Approvals'
	},
	{
		path: '/dashboard/rejections',
		title: 'Rejection queues',
		purpose: 'What has been turned back, per kind of record.',
		permission: 'rejections.view',
		group: 'Approvals'
	},
	{
		path: '/dashboard/rejections/[entity]',
		title: 'One rejection queue',
		purpose: 'Rejected records of one kind, with their reasons.',
		permission: 'rejections.view',
		group: 'Approvals'
	},

	// Appointments
	{
		path: '/dashboard/providers',
		title: 'Dentists',
		purpose:
			'The clinicians who can be booked and prescribe, with their licences and expiry dates.',
		permission: 'providers.manage',
		group: 'Appointments'
	},
	{
		path: '/dashboard/appointments',
		title: 'Appointments — day view',
		purpose: 'One day at one branch, a column per chair: book, check in, seat, finish, cancel.',
		permission: 'appointments.view',
		group: 'Appointments'
	},
	{
		path: '/dashboard/appointments/list',
		title: 'Appointment list',
		purpose:
			'Every appointment, searchable by patient and filterable by status, dentist, chair and date.',
		permission: 'appointments.view',
		group: 'Appointments'
	},
	{
		path: '/dashboard/recalls',
		title: 'Recalls',
		purpose: 'Patients due back who have not booked: ring them, log the call, book the visit.',
		permission: 'appointments.book',
		group: 'Appointments'
	},
	{
		path: '/dashboard/lab-cases',
		title: 'Lab work',
		purpose:
			'Work out at laboratories, overdue, or back to fit — and how each laboratory has kept its promises.',
		permission: 'lab_cases.manage',
		group: 'Appointments'
	},
	{
		path: '/dashboard/admin-panel/chairs',
		title: 'Chairs',
		purpose: 'The dental chairs at each branch — the columns of the appointment day view.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},

	{
		path: '/dashboard/admin-panel/closures',
		title: 'Closures',
		purpose: 'Days the clinic is shut, everywhere or at one branch. Nothing can be booked on them.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/appointment-types',
		title: 'Appointment types',
		purpose: 'What a visit can be for, with its usual length and its colour on the day view.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/services/categories',
		title: 'Service categories',
		purpose: 'The groups services are filed under.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/specialties',
		title: 'Specialties',
		purpose: "What a clinician is licensed as, chosen on each dentist's record.",
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/dental-labs',
		title: 'Dental labs',
		purpose: 'The laboratories the clinic sends work to, and the turnaround each promises.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/allergens',
		title: 'Allergens',
		purpose: 'The substances a patient can be recorded as reacting to.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/conditions',
		title: 'Conditions',
		purpose: "The medical and dental conditions a patient's history can record.",
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/medicines',
		title: 'Medicines',
		purpose:
			'What the clinic prescribes and what patients arrive taking, with the risk flags a dentist acts on.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/referral-sources',
		title: 'Referral sources',
		purpose: 'How patients find the clinic, chosen at registration.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/contact-types',
		title: 'Contact types',
		purpose: 'The channels a patient can be reached on besides their phone.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},

	{
		path: '/dashboard/admin-panel/users/add-users',
		title: 'Add a user',
		purpose: 'Give an office employee an account and a role.',
		permission: 'users.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/users/[id]',
		title: 'One user',
		purpose: 'A user account: its details and role, and any special permissions it holds.',
		permission: 'users.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/roles/add-roles',
		title: 'Add a role',
		purpose: 'A new named bundle of permissions.',
		permission: 'roles.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/roles/[id]',
		title: 'One role',
		purpose: 'A role and the permissions it grants.',
		permission: 'roles.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/employees/leaves/pending',
		title: 'Pending leave',
		purpose: 'Leave requests waiting for a decision.',
		permission: 'leaves.view_approved',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/leaves/approved',
		title: 'Approved leave',
		purpose: 'Leave that has been granted.',
		permission: 'leaves.view_approved',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/leaves/cancelled',
		title: 'Rejected leave',
		purpose: 'Leave requests that were turned down.',
		permission: 'leaves.view_approved',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/salary/add-bonus',
		title: 'Add a bonus',
		purpose: 'A bonus for one employee, picked up by that month’s payroll.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/salary/add-deduction',
		title: 'Add a deduction',
		purpose: 'A deduction for one employee, taken by that month’s payroll.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/salary/add-overtime',
		title: 'Add overtime',
		purpose: 'Overtime for one employee, paid by that month’s payroll.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/salary',
		title: 'Paid salary history',
		purpose: 'Every payroll run paid so far, month by month.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/transactions/ranges/[range]',
		title: 'Transactions for a period',
		purpose: 'Money in and out between two dates.',
		permission: 'transactions.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/transactions/expenses/ranges/[range]',
		title: 'Expenses for a period',
		purpose: 'Expenses between two dates.',
		permission: 'transactions.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/supplies/[id]/ranges/[range]',
		title: 'A supply’s movements for a period',
		purpose: 'One item’s stock movements between two dates.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},
	{
		path: '/dashboard/supplies/suppliers/[id]',
		title: 'One supplier',
		purpose: 'A supplier: their details, address and contacts.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},

	// Patients
	{
		path: '/dashboard/patients',
		title: 'Patients',
		purpose: 'Find patients across branches, with alerts, filters and charts.',
		permission: 'patients.view',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/add',
		title: 'Register a patient',
		purpose: 'Register a new patient, after checking they are not already on file.',
		permission: 'patients.register',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]',
		title: 'Patient chart',
		purpose: 'One patient: alerts, details, medical history, allergies, conditions and medicines.',
		permission: 'patients.view',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/chart',
		title: 'Dental chart',
		purpose:
			'The odontogram and every procedure on record: findings, planned work, work done and work the patient arrived with.',
		permission: 'patients.view',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/plans',
		title: 'Treatment plans',
		purpose:
			'Every plan this patient has been offered, and a new one from the work planned on the chart.',
		permission: 'patients.view',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/plans/[planId]',
		title: 'Treatment plan',
		purpose:
			'One plan: its lines, what the patient said to each, and the next step — present, answer, complete.',
		permission: 'patients.view',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/notes',
		title: 'Clinical notes',
		purpose:
			'What clinicians wrote about the patient: write, sign, and correct a signed note by amendment.',
		permission: 'patients.view (patients.clinical to write)',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/prescriptions',
		title: 'Prescriptions',
		purpose:
			'What the patient was prescribed; write one against their allergies and current medicines, and print it.',
		permission: 'patients.view (patients.clinical to write)',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/files',
		title: 'Patient files',
		purpose: 'Radiographs, photographs, referral letters and photographed paper charts.',
		permission: 'patients.view (patients.clinical to attach)',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/consents',
		title: 'Consents',
		purpose: 'What the patient agreed to, how and before whom, and whether it still stands.',
		permission: 'patients.view (patients.clinical to record)',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/lab',
		title: 'Patient lab work',
		purpose: 'What has been sent to a laboratory for the patient, where it is, and sending more.',
		permission: 'patients.view (lab_cases.manage to send and move)',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/access',
		title: 'Access log',
		purpose: 'Who opened or printed each part of the patient’s chart, and when.',
		permission: 'audit_logs.view',
		group: 'Patients'
	},
	{
		path: '/dashboard/patients/[id]/billing',
		title: 'Patient billing',
		purpose: 'What the patient owes, their work not yet billed, their bills, and taking a payment.',
		permission: 'billing.invoice',
		group: 'Billing'
	},
	{
		path: '/dashboard/patients/[id]/billing/[invoiceId]',
		title: 'Bill',
		purpose: 'One bill: build a draft, issue it, take payments, print it, or ask to void it.',
		permission: 'billing.invoice',
		group: 'Billing'
	},
	{
		path: '/dashboard/billing',
		title: 'Who owes',
		purpose: 'Everyone at this branch with unpaid bills, the most owed first.',
		permission: 'billing.invoice',
		group: 'Billing'
	},
	{
		path: '/dashboard/billing/cash',
		title: 'Cash drawer',
		purpose: 'Open the drawer with a float, see what it should hold, and count and close it.',
		permission: 'billing.cash_session',
		group: 'Billing'
	},
	{
		path: '/dashboard/admin-panel/billing-settings',
		title: 'Billing settings',
		purpose: 'How big a discount the front desk may give before a manager has to approve it.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/treatment-plans',
		title: 'Plan follow-up',
		purpose:
			'Quotes awaiting an answer, the longest-waiting first, and case acceptance over the last 90 days.',
		permission: 'treatment_plans.manage',
		group: 'Patients'
	},

	// Employees
	{
		path: '/dashboard/employees',
		title: 'All active employees',
		purpose: 'The full workforce, searchable and exportable.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/add-employee',
		title: 'Add employee',
		purpose: 'Register a new hire; starts pending and cannot be paid until approved.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/inactive',
		title: 'Inactive employees',
		purpose: 'People who have left, kept for history and reporting.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/attendance',
		title: 'Attendance register',
		purpose: 'The day’s register: who came in and left, kept by tapping; absences excused.',
		permission: 'attendance.manage',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/attendance/month',
		title: 'Attendance month',
		purpose: 'Everyone’s days across an Ethiopian month, with the absences payroll will deduct.',
		permission: 'attendance.manage',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]',
		title: 'Employee profile',
		purpose: 'One person: details, salary, leave, attendance and documents.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/salary',
		title: 'Employee salary',
		purpose: 'Current package, plus bonuses, deductions, overtime and salary changes.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/salary/change-salary',
		title: 'Change salary',
		purpose: 'Raise a salary change; goes to the Salary Changes queue.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/salary/salary-history',
		title: 'Salary history',
		purpose: 'Every package this person has been on, and when.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/add-leave',
		title: 'Add leave',
		purpose: 'Record a leave for this person, with half-day boundaries.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/leave-history',
		title: 'Leave history',
		purpose: 'Leaves taken, balance and entitlement.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/single/[id]/id-maker',
		title: 'ID card maker',
		purpose: 'Printable identity card from the photograph and details on file.',
		permission: 'employees.create_followup',
		group: 'Employees'
	},
	{
		path: '/dashboard/employees/leaves',
		title: 'Leaves',
		purpose: 'Leave across the workforce: pending, approved and cancelled.',
		permission: 'leaves.view_approved',
		group: 'Employees'
	},

	// Finance
	{
		path: '/dashboard/salary/add-payroll/[range]',
		title: 'Unpaid salaries',
		purpose: 'The payroll sheet for a month: check the totals, choose the payment method, run it.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/ledger/[kind]',
		title: 'Overtime, bonuses and deductions',
		purpose:
			'Every pay adjustment over any period: filter, total, record for several employees at once.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/paid-salaries',
		title: 'Paid salaries',
		purpose:
			'Every payslip ever paid, over any period: filtered, totalled, and linked to its month’s run.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/paid-salaries/[month_year]',
		title: 'A payroll run',
		purpose: 'One month’s payslips, its bank receipts and adjustments, and finalising it.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/paid-salaries/adjust/[id]',
		title: 'Adjust a payslip',
		purpose: 'Correct a paid payslip with a separate, approvable adjustment.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/single/[id]',
		title: 'One payslip',
		purpose: 'A single payslip in full.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/transactions',
		title: 'Transactions',
		purpose: 'Money in and money out, browsable by date range.',
		permission: 'transactions.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/transactions/expenses',
		title: 'Expenses',
		purpose: 'Company spending by category; approvable.',
		permission: 'transactions.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/transactions/expenses/add-expense',
		title: 'Add expense',
		purpose: 'Record one expense with its category, method and receipt.',
		permission: 'transactions.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/transactions/expenses/categories',
		title: 'Expense categories',
		purpose: 'The list the expense form chooses from.',
		permission: 'transactions.manage',
		group: 'Finance'
	},

	// Supplies
	{
		path: '/dashboard/supplies',
		title: 'Stock levels',
		purpose: 'Every supply with how much is in store, its kind and its type.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},
	{
		path: '/dashboard/supplies/add-supplies',
		title: 'Add supply',
		purpose: 'Register an item or a purchase, with its reorder level.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},
	{
		path: '/dashboard/supplies/[id]',
		title: 'Supply detail',
		purpose: 'One item: movements, damages and history.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},
	{
		path: '/dashboard/supplies/[id]/damaged/[range]',
		title: 'Damaged items',
		purpose: 'Damage and loss recorded against an item over a period.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},
	{
		path: '/dashboard/supplies/suppliers',
		title: 'Suppliers',
		purpose: 'Who you buy from, and what from each.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},
	{
		path: '/dashboard/supplies/suppliers/add-suppliers',
		title: 'Add supplier',
		purpose: 'Register a new supplier.',
		permission: 'supplies_suppliers.manage',
		group: 'Supplies'
	},

	// Reports
	{
		path: '/dashboard/reports',
		title: 'Reports overview',
		purpose: 'Payroll and revenue together, for a chosen range.',
		permission: 'reports.finance',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/people',
		title: 'People report',
		purpose: 'Headcount, hires and terminations.',
		permission: 'reports.hr',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/payroll',
		title: 'Payroll report',
		purpose: 'Runs, payslips, adjustments, receipts and salary changes.',
		permission: 'reports.finance',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/compensation',
		title: 'Compensation report',
		purpose: 'Bonuses, overtime, commissions and deductions.',
		permission: 'reports.finance',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/leave',
		title: 'Time & leave report',
		purpose: 'Attendance, leaves taken and leave granted.',
		permission: 'reports.hr',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/stock',
		title: 'Stock report',
		purpose: 'Stock levels, adjustments and damaged supplies.',
		permission: 'reports.finance',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/clinic',
		title: 'Clinic report',
		purpose:
			'Production per dentist, procedures by service, case acceptance, recalls, receivables aging, cash counts and lab turnaround.',
		permission: 'reports.clinic',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/money',
		title: 'Money report',
		purpose: 'Transactions, expenses and services rendered.',
		permission: 'reports.finance',
		group: 'Reports'
	},
	{
		path: '/dashboard/reports/system',
		title: 'System report',
		purpose: 'The audit log — who did what, and when.',
		permission: 'audit_logs.view',
		group: 'Reports'
	},

	// Admin panel
	{
		path: '/dashboard/admin-panel',
		title: 'Admin panel',
		purpose: 'The hub for every reference list and system setting.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/users',
		title: 'Users',
		purpose: 'Accounts, roles, special permissions and password resets.',
		permission: 'users.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/roles',
		title: 'Roles',
		purpose: 'Named bundles of permissions.',
		permission: 'roles.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/branches',
		title: 'Branches',
		purpose: 'Clinic locations. Most clinics have one and never open this.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/regions',
		title: 'Regions',
		purpose: 'Top level of the address list.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/cities',
		title: 'Cities',
		purpose: 'Cities within a region.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/subcities',
		title: 'Subcities',
		purpose: 'Subcities within a city.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/department',
		title: 'Departments',
		purpose: 'The departments employees belong to, and which count as office staff.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/positions',
		title: 'Positions',
		purpose: 'Job titles employees hold.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/services',
		title: 'Services',
		purpose: 'The treatments the clinic offers, with their price and what the chart asks for.',
		permission: 'settings.manage',
		group: 'Clinic setup'
	},
	{
		path: '/dashboard/admin-panel/educational-level',
		title: 'Educational levels',
		purpose: 'The education options on the employee form.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/employment-status',
		title: 'Employment statuses',
		purpose: 'Permanent, contract, probation, and the rest.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/supply-types',
		title: 'Supply types',
		purpose: 'The categories supplies are filed under.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/leave-types',
		title: 'Leave types',
		purpose: 'Annual, sick, maternity, unpaid, and so on.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/annual-leave-entitlements',
		title: 'Annual leave entitlements',
		purpose: 'Days due, usually stepped by length of service.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/leave-expiry-policy',
		title: 'Leave expiry policy',
		purpose: 'Whether unused days carry over, and for how long.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/leave-accrual',
		title: 'Run leave accrual',
		purpose: 'Grant accrued leave across the workforce for a period.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/payment-methods',
		title: 'Payment methods',
		purpose: 'The accounts money moves through — each bank account, Telebirr and cash.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/tax-types',
		title: 'Tax bands',
		purpose: 'The monthly income-tax bands payroll taxes salaries by; rates are percentages.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/overtime-types',
		title: 'Overtime types',
		purpose: 'Overtime categories and their multipliers.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/pensions',
		title: 'Pension rates',
		purpose: 'The employee and employer contribution rates, as percentages of basic salary.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/vat-withhold',
		title: 'VAT and withholding',
		purpose: 'The clinic’s VAT and withholding percentages, for invoices once billing is built.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},

	// Automation
	{
		path: '/api/cron/leave-accrual',
		title: 'Leave accrual job',
		purpose: 'Scheduled task that grants accrued leave. Not a screen — it runs by itself.',
		group: 'Automation',
		nonNavigable: true
	}
];

export const ROUTE_GROUPS = [...new Set(ROUTE_MAP.map((route) => route.group))];

export const ROUTE_COUNT = ROUTE_MAP.length;

/**
 * Whether this address can simply be opened.
 *
 * A path carrying a `[param]` stands for one particular record, so there is no
 * single page behind it to link to; `openFrom` says where you would pick that
 * record instead.
 */
export function isNavigable(route: RouteEntry): boolean {
	return !route.nonNavigable && !route.path.includes('[');
}

/**
 * For a parameterised route, the nearest ancestor in the map you can actually
 * open — in practice, the list you would pick the record from.
 *
 * Stops before `/dashboard` itself: "open the dashboard and look around" is not
 * an answer worth printing next to a route.
 */
export function openFrom(route: RouteEntry): RouteEntry | undefined {
	if (isNavigable(route)) return undefined;

	const segments = route.path.split('/');
	for (let i = segments.length - 1; i >= 3; i--) {
		const candidate = ROUTE_MAP.find((entry) => entry.path === segments.slice(0, i).join('/'));
		if (candidate && isNavigable(candidate)) return candidate;
	}
	return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Search                                                                    */
/* -------------------------------------------------------------------------- */

/** Flat list of every topic with its section, for searching. */
export const ALL_TOPICS = HELP_SECTIONS.flatMap((section) =>
	section.topics.map((topic) => ({ ...topic, sectionId: section.id, sectionTitle: section.title }))
);

export const TOPIC_COUNT = ALL_TOPICS.length;

/**
 * Everything a topic could reasonably be searched by, lowercased once so the
 * filter is a plain substring test rather than a scan of nested arrays on every
 * keystroke.
 */
export function searchIndex(topic: (typeof ALL_TOPICS)[number]): string {
	return [
		topic.title,
		topic.summary,
		topic.where ?? '',
		topic.permission ?? '',
		topic.sectionTitle,
		...(topic.steps ?? []),
		...(topic.notes ?? []),
		...(topic.keywords ?? [])
	]
		.join(' ')
		.toLowerCase();
}

/** The same idea for a route row. */
export function routeSearchIndex(route: RouteEntry): string {
	return [route.path, route.title, route.purpose, route.permission ?? '', route.group]
		.join(' ')
		.toLowerCase();
}
