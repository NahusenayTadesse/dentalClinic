/**
 * The Spotless system manual.
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
				title: 'What the Spotless system is',
				summary:
					'One place to run the whole business: the customers you serve, the sites you serve them at, the people who do the work, the money in and the money out, and the stock that goes with it.',
				notes: [
					'It replaces the separate spreadsheets that used to hold customers, contracts, attendance, payroll, collections and stock. Because everything sits in one database, a figure you see on a report is the same figure the person who entered it saw — there is no second copy to reconcile.',
					'Every screen lives under `/dashboard`. Nothing is public: if you are not signed in you are sent to the login page, whatever address you typed.',
					'The system is built and maintained by **PulseData Solutions**. The footer of the menu links to them, and support requests go through them.',
					'Six things flow through the system, and almost every screen is one of them: **customers**, **sites**, **contracts**, **employees**, **money** and **supplies**. If you can place a screen into one of those six, you already know roughly what it does.'
				],
				keywords: ['erp', 'overview', 'purpose', 'about', 'system', 'pulsedata', 'spotless']
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
					'Forgot your password? The **Forgot password** link on the login screen starts the reset. If it does not reach you, an administrator can set a new password for you from **Admin Panel → Users**.',
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
					"**Dashboard** — the daily overview: expiring contracts, today's report, supplies to reorder.",
					'**Customers, Sites, Contracts** — who you serve, where, and under what agreement.',
					'**Requests, Approvals, Rejections, Payments** — the money owed to you, and the checks it passes through.',
					'**Employees** — people, attendance and leave.',
					'**Finance** — salaries, overtime, deductions, transactions and expenses.',
					'**Supplies** — stock, suppliers and site leases.',
					'**Reports** — every ledger in the system, filtered and exportable.',
					'**Admin Panel** — users, roles and all the reference lists the forms choose from.'
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
					'Type in the **search box** above a table to narrow it down. It looks across every visible column at once, so a site name, a phone number or an amount all work.',
					'Click a **column heading** to sort by it. Click again to reverse the order.',
					'Use the **columns** dropdown to hide columns you do not need. Wide tables — payroll especially — read far better with half the columns switched off.',
					'Use the **filter menus** above the table to pick exact values from a column: one service, two sites, three statuses.',
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
					'When picking values from a list is not enough, the query builder asks questions about numbers and dates: "under 5 left", "due back before today", "spend over 10,000".',
				where:
					'The **Advanced filter** button above the tables that have one — stock, leases, suppliers',
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
					'Red messages are not failures on your part — they are the system refusing something that would have caused a problem later: a duplicate invoice for a month that already has one, an end date before its start date, a lease for more items than exist.',
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
					'Receipts, contract scans, withholding certificates and photographs are stored by the system and served only to signed-in users.',
				steps: [
					'Use the file field on the form — payment receipt, contract file, withholding receipt — and pick the file.',
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
					'You create a record — an employee, a salary change, an expense, a payroll run, a customer, a site, a contract.',
					'It is saved immediately with the status **pending**, stamped with your name as the requester.',
					'It appears in the approval queue for that kind of record.',
					'Somebody with the approval permission opens the queue, ticks the record and presses **Approve** or **Reject**.',
					'Once approved, the record starts counting: it appears in listings, joins the reports, and can be paid or acted on.'
				],
				notes: [
					'A pending record is **not** invisible — you can see it and correct it. It just does not count yet. A pending contract is not chased for renewal; a pending employee cannot be paid.',
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
					'Open the queue you are responsible for — Employees, Salary Changes, Expenses, Payroll Runs, Site Contracts, and the rest.',
					'Read the rows. Columns that point at another record are links, so you can open the site or the employee behind a row before deciding.',
					'Tick the rows you have decided on. Tick the header box to take the whole page at once.',
					'Press **Approve**, or press **Reject** and give a reason — a rejection without a reason is refused.'
				],
				notes: [
					'The queues cover **employees, salary changes, expenses, payroll runs, payroll adjustments, customers, customer contracts, sites** and **site contracts**.',
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
					'Every change to a chart is written to the audit trail, and every opening of a chart is recorded in the access log. Holders of **Read the audit trail** see who opened it at the bottom of the page.'
				],
				keywords: ['allergy', 'condition', 'medication', 'warfarin', 'history', 'emergency contact']
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
					'**Employment** — the site they work at, department, position, employment status, education level, and the date they started.',
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
				summary: 'All active employees, employees by site, and the inactive list.',
				where: 'Menu → **Employees**',
				steps: [
					'**All Active Employees** — everyone currently employed. Search by name, phone or ID.',
					'**Employees by Site** — the same people grouped by where they work; open a site to see its roster, and its own inactive list.',
					'**Inactive** — people who have left, kept for history and for reports.',
					"Click a name to open the employee's profile."
				],
				notes: [
					'"Employees by site" is the roster view supervisors want; "all active" is the HR view. Same people, different question.',
					'Filter and print the roster of a site straight from the table when a customer asks who is assigned to them.'
				],
				keywords: ['list', 'roster', 'by site', 'inactive', 'search', 'find', 'employee']
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
					'Attendance is taken per site, per period, and is what overtime and absence deductions rest on.',
				where:
					'Menu → **Employees → Employees by Site → Attendance**, or `/dashboard/employees/attendance`',
				permission: 'attendance.manage',
				steps: [
					'Open the attendance screen and pick the site and the period.',
					'Mark the days for each person on the roster.',
					'Save. The figures feed the compensation and time reports, and the overtime you enter for the same period.'
				],
				notes: [
					'Attendance is entered against a **date range**, and the URL carries the range — so an attendance screen you have open can be bookmarked or sent to a colleague and it opens on the same period.',
					'Enter attendance before you run payroll for the month, not after. Payroll takes the figures as they stand at the moment it runs.'
				],
				keywords: ['attendance', 'present', 'absent', 'timesheet', 'roster', 'days', 'range']
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
		id: 'finance',
		title: 'Payroll and finance',
		blurb:
			'Paying people, and the money movements around it: overtime, deductions, payroll runs, transactions and expenses.',
		topics: [
			{
				id: 'payroll-cycle',
				title: 'The monthly payroll cycle',
				summary:
					'Attendance first, then overtime and deductions, then the run, then the receipt — in that order, every month.',
				where: 'Menu → **Finance**',
				permission: 'salary.manage',
				steps: [
					'Make sure **attendance** for the month is entered and every new hire has been **approved**.',
					'Enter **overtime** for the month (`Finance → All OverTime`).',
					'Enter **deductions** for the month (`Finance → All Deductions`).',
					'Open **All UnPaid Salaries** for the month — or **UnPaid Salaries by Site** if you pay site by site.',
					'Check the totals panel: gross, tax, pension, allowances, deductions, net.',
					'Choose the payment method, set the payment date and attach the transfer receipt.',
					'Press **Run payroll**. The run is created, every payslip written, and the transaction recorded — all in one go.',
					'The run then waits in the **Payroll Runs** approval queue.'
				],
				notes: [
					'The whole run is one transaction: if anything fails, nothing is written. You will never find half a month paid.',
					'Unapproved employees are refused with a count, so if the total looks light, check the approvals queue before you check your arithmetic.',
					"Running by site produces the same result as running the whole company; it just lets you close one site's payroll while another is still being checked.",
					'Attach the bank transfer receipt at the moment you run it. That receipt is what reconciles the payroll to the bank statement.'
				],
				keywords: ['payroll', 'run', 'salary', 'month', 'pay', 'process', 'cycle', 'net', 'gross']
			},
			{
				id: 'payroll-months',
				title: 'Choosing a payroll month',
				summary: 'Payroll screens are addressed by month, and open on the current one by default.',
				notes: [
					'Landing on **All UnPaid Salaries** without naming a month sends you to the current month; **Paid Salaries** opens on the last month that was paid.',
					'The month is in the address (`Meskerem_2017`), so a link to a particular month can be bookmarked or sent to somebody.',
					'Change months from the selector at the top of the page rather than by editing the address.'
				],
				keywords: ['month', 'period', 'ethiopian', 'unpaid', 'paid', 'select month']
			},
			{
				id: 'overtime-deductions',
				title: 'Overtime, deductions and bonuses',
				summary: 'The variable parts of a payslip, entered per month before the run.',
				where: "Menu → **Finance → All OverTime / All Deductions**, or an employee's salary page",
				steps: [
					'Enter overtime against the month, choosing the overtime type — the rate belongs to the type, set in **Admin Panel → Overtime Types**.',
					'Enter deductions against the month: advances, penalties, loans, anything to be taken off.',
					"Bonuses are entered on the individual employee's salary page.",
					'All of it is picked up by the payroll run for that month.'
				],
				notes: [
					'Enter these **before** the run. Anything added afterwards belongs to the next month, or has to go through a payroll adjustment.',
					'Entering per site (`Finance → UnPaid Salaries by Site → the site → Overtime / Deductions`) is the same data, reached the way a site supervisor thinks about it.'
				],
				keywords: ['overtime', 'deduction', 'bonus', 'advance', 'penalty', 'allowance', 'variable']
			},
			{
				id: 'paid-salaries',
				title: 'Paid salaries and adjustments',
				summary:
					'What has already been paid, month by month, and how to correct a payslip after the fact.',
				where: 'Menu → **Finance → Paid Salaries** → `/dashboard/salary/paid-salaries`',
				steps: [
					'Open **Paid Salaries** and pick the month.',
					'Every payslip for the month is listed, with its gross, tax, pension, deductions and net.',
					'Print or export the sheet for the file, or for the bank.',
					'To correct one payslip, open it and use **Adjust**.'
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
		title: 'Supplies, suppliers and site leases',
		blurb:
			'What the company owns, who it was bought from, and what is currently out at a customer site.',
		topics: [
			{
				id: 'stock-levels',
				title: 'Stock levels and reordering',
				summary:
					'Every supply carries a quantity and a reorder level. Fall below it and the item appears on the dashboard.',
				where: 'Menu → **Supplies → Stock Levels** → `/dashboard/supplies`',
				permission: 'supplies_suppliers.manage',
				steps: [
					'**Stock Levels** lists every item with what is on hand and what is spoken for.',
					'Click an item to open it: its movement history, its damaged records and its ranges.',
					'**Add Supply** registers a new item or a new purchase: name, type, quantity, unit cost, supplier and reorder level.',
					'Anything at or below its reorder level shows in **Supplies to reorder** on the dashboard home.'
				],
				notes: [
					'Set the reorder level to cover the time it actually takes to get more, not to zero. An alert that fires the day you run out is not an alert.',
					'Supply types are reference data and live in **Admin Panel → Supply Types**; the supplies menu links straight to it because that is where it is used.',
					'Damaged and lost items are recorded against the item so the shrinkage is visible in the stock report rather than hidden in a quantity that quietly changed.'
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
				id: 'stock-figures',
				title: 'On hand, reserved, leased out, available',
				summary: 'Four different numbers, and only two of them are stored.',
				notes: [
					'**On hand** — what is physically in the store.',
					'**Reserved** — promised to a lease that is approved but not yet issued. Still on the shelf, but already spoken for.',
					'**Leased out** — physically at a site right now.',
					'**Available** — what you can actually promise to somebody new: on hand, less what is reserved.',
					'Reserved and leased out are worked out from the leases every time they are shown, not stored on the item. That is why they can never drift out of step with the leases themselves.',
					'The lease form offers **available**, not on hand — so you cannot promise the same box of gloves to two sites.'
				],
				keywords: ['on hand', 'reserved', 'available', 'leased out', 'stock', 'derived', 'promised']
			},
			{
				id: 'leases',
				title: 'Leasing supplies to a site',
				summary:
					'Equipment sent to a site is leased, not sold: the company keeps ownership and expects it back.',
				where: 'Menu → **Supplies → Site Leases / Lease to a Site**',
				permission: 'supplies_suppliers.manage',
				steps: [
					'Open **Lease to a Site**.',
					'Pick the site, then add the items and quantities. Each item shows what is genuinely available.',
					'Save. The lease is created as **pending**.',
					'Once approved, the stock is **reserved** — still in the store, but no longer offerable.',
					'When the goods physically leave, mark the lease **issued**. The stock is now leased out.',
					'As items come back, record the return. A lease becomes **partially returned**, then **returned**, then **closed**.'
				],
				notes: [
					'The statuses are: **pending → approved → issued → partially returned → returned → closed**, with **rejected** and **cancelled** as the ways out before issue.',
					'Every step is logged against the lease, so the question "where did those twenty radios go" always has an answer.',
					"A lease is not a sale. The items stay the company's property on the books for the whole time they are out."
				],
				keywords: [
					'lease',
					'issue',
					'return',
					'site',
					'equipment',
					'loan',
					'status',
					'partially returned'
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
			'Nine report pages over the same data, each with charts and totals on top and the underlying ledger underneath.',
		topics: [
			{
				id: 'reports-how',
				title: 'How every report page works',
				summary:
					'Set the date range and the scope at the top; the charts and the totals answer for that slice; then pick a ledger to see the rows behind them.',
				where: 'Menu → **Reports** → `/dashboard/reports`',
				permission:
					'reports.finance, reports.hr, reports.customer_site or audit_logs.view, by page',
				steps: [
					'Choose the **start** and **end** dates. Both ends are included.',
					'Press **Filters** and narrow the scope: department, position, site, customer, employment status, education, gender, employee, payment method, expense type — plus a search over the open ledger and a page size. The badge on the button counts how many narrowings are active.',
					'Read the tiles and the charts: they are the totals for exactly that slice.',
					'Choose a **section** below them to load the detail rows: payslips, attendance, expenses, contracts, and so on.',
					'Filter the detail table further if you need to, then print or export it.'
				],
				notes: [
					'Only the ledger you ask for is fetched. The tiles and charts stay fast however much history the range covers, because the expensive part is the one table you chose.',
					'Every detail table exports and prints like any other table in the system, so a board pack is a matter of choosing the range and pressing the button.',
					'A total that looks wrong is nearly always a scope question — check the date range and the site filter before anything else.',
					'**Your query follows you.** Move to another report with the buttons under the heading and the range and the filters come with it, so a slice set once can be read across People, Payroll, Money and Commercial without setting it again.'
				],
				keywords: ['report', 'range', 'filter', 'export', 'chart', 'total', 'section', 'ledger']
			},
			{
				id: 'reports-pages',
				title: 'What each report covers',
				summary: 'Nine pages, grouped by the question you are asking.',
				steps: [
					'**Overview** (`/dashboard/reports`) — the company at a glance: payroll and revenue together.',
					'**People** — headcount, hires, terminations, the workforce as it stands.',
					'**Payroll** — runs, payslips, adjustments, receipts and salary changes.',
					'**Compensation** — bonuses, overtime, commissions and deductions.',
					'**Time & Leave** — attendance, leaves taken and leave granted.',
					'**Stock** — stock levels, supply adjustments and damaged items.',
					'**Money** — transactions, expenses and services rendered.',
					'**Commercial** — site payments, payment requests, contracts, renewals, penalties, customers and sites.',
					'**System** — the audit log: who did what, and when.'
				],
				notes: [
					'The permissions split the same way the questions do: `reports.hr` for people and leave, `reports.customer_site` for commercial, `reports.finance` for the money pages, `audit_logs.view` for the system report.',
					'The stock report is also linked from the supplies menu, because that is where you are standing when you want it.'
				],
				keywords: [
					'people',
					'payroll',
					'compensation',
					'leave',
					'stock',
					'money',
					'commercial',
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
					'Open a user to change their role, add a special permission, or set a new password.',
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
					'**Services** are what you sell — cleaning, security, and so on. They are what a contract points at, so the name shows on the invoice and in the commercial report.'
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
					'A backup you have never restored is a hope, not a plan. Ask PulseData to prove a restore periodically.'
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
				id: 'q-duplicate-request',
				title: 'It says a request already exists for this month',
				summary: 'One payment request per site per month, and the check counts deleted ones.',
				steps: [
					'Look for the existing request for that site and month — including in the cancelled list.',
					'Correct that request rather than raising a second one.',
					'If it was deleted, it still holds the month; ask an administrator to sort it out.'
				],
				keywords: ['duplicate', 'already exists', 'month', 'request', 'unique', 'error']
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
				summary: 'The system is built and maintained by PulseData Solutions.',
				notes: [
					'Note the screen you were on, what you pressed and the exact message you saw. Those three things usually settle it immediately.',
					'If you find yourself repeatedly wanting a screen the system does not have, say so — the shape of it is already here, and adding to it is ordinary work.'
				],
				keywords: [
					'support',
					'bug',
					'broken',
					'help',
					'contact',
					'pulsedata',
					'developer',
					'missing'
				]
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
			"Expiring contracts, today's report and the supplies that need reordering. Open to every signed-in user.",
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
		purpose: 'Serves an attached receipt, contract or photograph. Requires a session.',
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

	// Customers
	{
		path: '/dashboard/customers',
		title: 'All customers',
		purpose: 'Every approved customer, searchable and exportable.',
		permission: 'customers.record',
		group: 'Customers'
	},
	{
		path: '/dashboard/customers/add-customer',
		title: 'Add customer',
		purpose: 'Register a new customer; starts pending.',
		permission: 'customers.record',
		group: 'Customers'
	},
	{
		path: '/dashboard/customers/[id]',
		title: 'Customer detail',
		purpose: 'One customer: their contacts, address and history.',
		permission: 'customers.record',
		group: 'Customers'
	},

	// Contracts

	// Requests

	// Payments

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
			'Settle pending records: employees, salaries, expenses, payroll runs, payroll adjustments, customers, customer contracts, sites, site contracts.',
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
		path: '/dashboard/employees/attendance/[range]',
		title: 'Attendance',
		purpose: 'Attendance across the workforce for a period.',
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
		path: '/dashboard/salary/add-overtime/[range]',
		title: 'Overtime',
		purpose: 'Overtime for a month, by type, before the run.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/add-deductions/[range]',
		title: 'Deductions',
		purpose: 'Advances, penalties and other deductions for a month.',
		permission: 'salary.manage',
		group: 'Finance'
	},
	{
		path: '/dashboard/salary/paid-salaries/[month_year]',
		title: 'Paid salaries',
		purpose: 'Payslips already paid, month by month.',
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
		purpose: 'Every supply with on hand, reserved, leased out and available.',
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
		group: 'Admin Panel'
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
		purpose: 'The departments employees belong to.',
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
		purpose: 'What you sell — what a contract points at.',
		permission: 'settings.manage',
		group: 'Admin panel'
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
		purpose: 'Cash, transfer, cheque — and the account each maps to.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/tax-types',
		title: 'Tax types',
		purpose: 'The income tax bands payroll applies.',
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
		title: 'Pension',
		purpose: 'Employee and employer contribution rates.',
		permission: 'settings.manage',
		group: 'Admin panel'
	},
	{
		path: '/dashboard/admin-panel/vat-withhold',
		title: 'VAT and withholding',
		purpose: 'The rates used on collections.',
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
