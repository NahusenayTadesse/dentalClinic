# Suggestions: making this a strong dental clinic system for Ethiopia

What to add, in the order I would add it. The core is already strong: the clinical record (chart,
plans, notes, prescriptions, consents, files), billing with payers and refunds, the cash drawer,
Ethiopian dates, payroll with Ethiopian tax and pension, licence expiry, an audit trail, and help in
English and Amharic. What follows is mostly about fitting how clinics here actually run.

Tax and legal points below are from general knowledge, not advice. Check them with an accountant
and a lawyer before building on them.

Each item says what already exists to build on, so it starts from the code rather than from zero.

---

## Fix first

### ✅ The Ethiopian calendar library is a day early after every leap year — fixed

`ethiopian-calendar-new` puts Meskerem 1, 2016 on 11 September 2023; the new year fell on the 12th.
It is a day early for **the whole Ethiopian year after a leap year** — all of 2016 E.C., and next all
of 2020 E.C. (12 September 2027 to 10 September 2028).

- **Affected:** `ethiopianRange` in `lib/global.svelte.ts`, and through it every payroll period
  (`payrollPeriod`), plus `seedPermissions.ts`. Payroll runs for 2020 E.C. would start and end a day
  early.
- **Fix:** move them onto `ethiopianToIso` in `$lib/ethiopianCalendar.ts`, which is built on `Intl`'s
  Ethiopic calendar and tested across the leap years. Then drop the dependency.
- **Deadline:** before September 2027.
- **Done:** payroll periods and the public-holiday seed now go through `ethiopianToIso`, and the
  dependency is removed from the app. Tests pin Meskerem 2016, Meskerem 2020 and Megabit 2016.
  The kit (`../admin-kit/src/lib/global.ts`) still has its own `ethiopianRange` on the library;
  nothing in this app calls it, but it should be fixed there too. The kit's date pickers use
  `@internationalized/date`, which has the leap years right.

### ✅ Every dashboard page scrolls sideways on a phone — fixed

At 390px wide the top bar's branch-and-user row is 82px too wide, so the whole page scrolls
sideways. Seen on Recalls, Reminders and the HMIS report alike; it is the layout, not the pages.

**Done:** the branch selector shrinks and truncates on a phone and the bar's gaps tighten; no page
scrolls sideways at 360, 390, 768 or 1400px.

---

## Needed before a clinic can rely on it

### 1. ✅ The Ministry of Health monthly report — done

`/dashboard/hmis`. Visits and coded diagnoses for one Ethiopian month at one branch, by sex and
HMIS age group, printed or downloaded for DHIS2. See ROADMAP Stage 9.

**Still for the clinic to do:** enter the Ministry's HMIS code on each dental condition (Clinic Setup
→ Conditions), and link the remaining finding services ("Periapical lesion", "Retained root") to the
condition each diagnoses (Clinic Setup → Services). Check the age groups against the form the health
office currently issues — they are one constant in `$lib/hmisReport.ts`.

### 2. ✅ Amharic screens, not just Amharic help — front desk done

Every label, button and message is in English. Reception staff in most clinics will work faster in
Amharic; Afaan Oromo matters for clinics in Oromia.

- **Build on:** the kit already reads its own labels through `useLabels()`, and the help system
  already switches language. The app's own strings are the gap.
- **Size:** large but mechanical. Start with the front desk: patients, the diary, billing.
- **Done (front desk):** an EN/አማ switch in the top bar (a cookie, read by a hook into
  `locals.lang`, and `<html lang>` follows it). Translated: the menus and search palette, the kit's
  tables, pickers and dialogs, the help panel, the appointments day view, list and dialogs,
  Reminders, Recalls, the patient list, registration, chart header, tabs and overview, Who Owes,
  the cash drawer, a patient's billing, bills, receipts and the payment form — and the server's
  replies to all of them, including booking refusals and the dentist-hours warning. The dictionary
  is `$lib/i18n/messages`, one module per area; an Amharic area missing a key does not compile, and
  `i18n.test.ts` fails on a menu entry with no Amharic name.
- **Still English:** form validation messages (shared zod schemas), the clinical chart tabs
  (dental chart, plans, notes, prescriptions, files, consents, lab work) and every back-office
  screen. Data — names, chairs, visit types, services — is shown as entered. The Amharic should be
  read by a native speaker before a clinic relies on it.

### 3. ✅ SMS reminders and recalls — done

Patients are phone-first. **Reminders** and **Recalls** record calls, but cannot send anything.

- **Add:** send an Amharic SMS through an Ethiopian bulk-SMS provider, from the same two lists.
  Each message costs money, so keep a per-patient opt-out and a cost log.
- **Build on:** `server/reminders.ts` (`recordReminder` already stamps `reminderSentAt`, so a sent
  SMS is one more way to reach that write), `server/recalls.ts`, and the no-show comparison tile,
  which will show whether SMS works better than calls.
- **Done:** AfroMessage and GeezSMS, behind one adapter each (`server/sms/gateways.ts`), set up on
  **Clinic Setup → SMS** by a super admin. API keys are stored encrypted (AES-256-GCM, key derived
  from `BETTER_AUTH_SECRET`), shown only as their last four characters, and redacted in the audit
  log. The two message templates are Amharic by default, with a live preview of segments and cost.
  **Text** on the Reminders and Recalls lists, and **Text everyone not yet reminded** for a day;
  a reminder text stamps the reminder. Patients can opt out (**Reaching them, and billing** on the chart). Every
  message, sent or failed, is logged with segments and cost.
- **Not verified against a live gateway:** the request shapes are taken from each gateway's own
  client library and pinned by tests against a fake, but no real message has been sent. Send a
  **Test** from the SMS screen with a real key before relying on it.

### 4. ✅ Mobile money: Telebirr and CBE Birr — reference and matching done

They exist only as payment methods of kind `mobile`. The money arrives without a trail the system
can check.

- **First step:** record the transaction reference on a mobile payment, and match the day's mobile
  payments at closing, the way the cash drawer is counted (`server/cashDrawer.ts`).
- **Done:** a mobile-money payment needs its transaction ID; a reference already recorded — however
  it is typed — is refused and names the receipt it is on (the unique `gateway_txn_token` is the
  guarantee). **Billing → Mobile Money** lists a day's Telebirr, CBE Birr and bank transfers to
  tick against the provider's statement, with what is still unticked totalled per method; each
  tick is audited with who and when (migration 0049).
- **Later:** a payment gateway (Chapa, ArifPay) to take the payment directly.

### 5. 🟡 Receipts that satisfy the tax rules — VAT and TIN done; e-invoicing not

- As I understand the rules, dental services are VAT-exempt but goods sold (toothbrushes,
  whitening kits) are taxable, and a clinic is on VAT or on turnover tax depending on its turnover.
  Bills do not calculate VAT yet: `transactions.vatAmount` exists, and billing never writes it
  (see the note at the top of `server/billing.ts`).
- The receipt needs the clinic's TIN, and the payer's for a company payer, and must meet the
  Ministry of Revenues' requirements (sales registration machine or e-invoicing).
- **Build on:** `server/invoiceWrites.ts`, the `vat_and_withhold` table, the existing printed bill.
- **Done:** Billing Settings holds the clinic's TIN, whether it is VAT-registered, the rate (15%) and
  whether treatment carries VAT (off: services exempt; the accountant's switch). A typed charge can
  be marked "VAT applies"; at issue VAT is charged on the taxable part after the discount is spread
  in proportion (`$lib/billTax.ts`), frozen on the bill with its rate, and a refused discount
  recomputes it. The draft shows the same figure before issue. The printed bill shows the clinic's
  TIN, the payer's TIN, and VAT as its own line. All of it is off by default (migration 0050).
- **Not done, and why:** clearance through the Ministry of Revenues' e-invoicing system. Its field
  specification and API are not published; `transactions.fiscalStatus`, `fiscalReference` and
  `fiscalQr` are waiting for them. Turnover tax is the clinic's own return, not a bill line, so it
  is left to the accounting export (under Running the business).

### 6. ✅ Insurance and employer credit, done properly — done

Payers exist (an invoice can be billed to an employer or insurer, and a payer pays many bills at
once), but there is no:

- pre-authorisation before treatment
- coverage limit per patient or per year
- co-payment split between patient and payer
- monthly claim batch to send to the insurer or employer

Credit income keeps many clinics running, so this matters more than it looks.

- **Done:** a payer's page sets **what they cover** — their share of each bill, a yearly limit per
  member, and whether they pre-authorise. A bill to them is divided at issue (or when a pending
  discount is decided): their part stays on their bill, the rest goes to the patient on a numbered,
  linked **co-payment** bill, so every bill still has one debtor. Pre-authorisations are recorded on
  the patient's Billing tab, audited; a payer that requires one cannot be billed without an approved
  one in date with enough left, and the bill records which it used. Patients carry a **member
  number**. **Claims** prints or downloads a payer's month of bills with member numbers and
  references (migration 0051, `server/payerCover.ts`, `$lib/payerCover.ts`).
- **Not done:** per-service cover rules, deductibles and waiting periods — the payer's claims office
  decides those on the claim — and undoing a co-payment bill when the payer's bill is voided (the
  manager voids both).

### 7. ✅ Coping with power and internet cuts — backups done

- Run on a local server on the clinic's network, so a cut to the internet is not a cut to the
  clinic. SQLite in WAL mode is already a planned install target (CLAUDE.md §10).
- Automatic off-site backups. `/dashboard/backup` exists; a restore that is rehearsed matters more
  than the button.
- **Done:** the app now makes its own backups (`server/backups.ts`): a consistent `mariadb-dump`,
  gzipped, every night from cron (`/api/cron/backup`, its own secret), the last 14 kept, and
  copied to `BACKUP_COPY_DIR` when set — a USB drive, another machine, a synced folder. **Admin
  Panel → Backups** shows them, warns when the newest is over two days old, and **checks the newest
  restores** by loading it into a scratch database and counting the core tables (`?verify=1` does it
  from cron). Before this, nothing in the repo wrote a backup at all.
- **Not done:** offline use in the browser itself. Running on the clinic's own network covers an
  internet cut; a browser that keeps working when the server is off is a different application.

---

## Clinical depth dentists will expect

- ✅ **Periodontal chart — done.** A Gums tab on the chart: six sites on every adult tooth (pocket,
  recession, bleeding, plaque), mobility and furcation, typed fast (Enter or one digit moves on;
  `b`/`p` mark the site just typed). Each exam is compared with the last finished one — the old
  depth under each reading, and sites with 2 mm or more of attachment lost outlined. A finished exam
  is fixed; it prints on the branch letterhead for a referral. Teeth the chart shows as extracted
  start missing. Not done: staging and grading (needs radiographs and judgement), implants.
- ✅ **Radiographs — done.** Every sensor's and panoramic machine's software can export each
  image to a folder; set `RADIOGRAPH_INBOX` to it and **Patients → Radiograph Inbox** lists what
  arrived, to be filed to a patient (the original moves to `filed/`, kept). Radiographs record their
  projection, and **View radiographs** shows a film beside the last one of the same projection and
  tooth, with zoom, pan, brightness, contrast, invert and turn, the two moving together. Not done:
  DICOM and TIFF (browsers cannot draw them; the inbox lists them and says to export JPEG/PNG), and
  measuring on the image (needs the sensor's calibration).
- ✅ **Medical-history questionnaire and consent templates — done.** The overview's Medical
  history card prints a questionnaire in Amharic or English (twenty questions, khat and bone
  medicines included, and what is on record to check) to fill in and sign. **Consents → Print a
  consent form** prints the clinic's wording with the patient, treatment and clinician filled in;
  six forms come ready in English and Amharic, editable under Clinic Setup → Consent Forms. The
  Amharic wording wants a native speaker's and the clinic's lawyer's reading. Not done: signing on
  a screen.
- ✅ **Sterilisation and infection-control log — done.** Appointments → Sterilisation: each
  autoclave cycle (machine tests too) with its strip and spore test, packs labelled from each load
  with a code and a use-by date, and the code recorded against the patient when a pack is opened. A
  pack is used once, never past its date or from a failed cycle. A spore test that grows fails the
  cycle after the fact and lists the patients to call. Sterilisers are set up per branch; the log is
  branch-scoped. Not done: reading the autoclave's own data port, single-instrument tracking.
- ✅ **Controlled-medicine register — done.** Medicines carry an EFDA control class (narcotic or
  psychotropic; tramadol, diazepam and midazolam come marked on a new install). Controlled stock
  is received only with its batch and supplier, and issued only to a named patient or with the
  reason written. **Supplies → Controlled Medicines** reads the stock ledger as the register —
  every line with its lot, supplier or patient, who recorded it, and the running balance — checks
  the balance against the shelf, and prints the monthly return for signature. Not done: the
  authority's electronic submission (none is published for clinics).
- ✅ **Orthodontic cases — done.** An Ortho tab on the chart: the appliance, the planned months
  and a progress bar, adjustment visits with when the patient is due back, and a payment plan of a
  deposit and monthly instalments fixed when the case opens. **Bill what is due** turns each
  instalment that has fallen due into an ordinary issued bill, paid on the Billing tab.
  Retention, finish and discontinue (which cancels unbilled instalments). **Appointments →
  Orthodontics** is the front desk's board: who is due back, whose payments are due to bill or
  overdue. Not done: billing on a timer (deliberately a person's step), changing a plan midway.

---

## Running the business

- ✅ **Export to accounting software — done.** Finance → Accounting Export: a month of money (bill
  payments split into fee and VAT, refunds, expenses, stock bought, salaries paid) as balanced
  journal entries, downloaded for Peachtree's General Journal import or as a plain journal. The
  clinic's account codes are set once on the same screen; the export is refused while any is
  missing, and unplaceable rows go to suspense and are counted. Cash basis by design; payroll's own
  tax and pension split stays in the payroll reports.
- ✅ **Purchase orders and supplier invoices — done.** Supplies → Purchase Orders: a draft with
  "add everything running low", sent with a PO number and printed for the supplier, received line by
  line straight into the lots (never more than outstanding; expiry and controlled-medicine rules as
  on the item page), and the supplier's invoice set against ordered and received before it is paid.
  Payments post as stock in the accounting export. Found and fixed on the way: `onHand()` read
  the wrong lots in any query without a join — the dashboard's low-stock count among them.
- ✅ **Patient account statements, treatment packages and deposits — done.** Billing → Take a
  deposit receipts money before a bill exists; it shows as _In credit_ and **Use credit** on a bill
  applies it, oldest first. **Statement** prints a period's bills, payments, refunds and deposits
  with a running balance. **Treatment packages** (Clinic Setup) come in two kinds: _prepaid_, sold
  as one bill, after which the work it covers is billed at nothing until its counts run out or it
  expires; and _bundles_, applied to a draft that holds all their services so the lines add up to
  the package price. A third kind is a new member of `PACKAGE_KINDS` and a branch in
  `server/packages.ts`.
- ✅ **Personal data protection (2024 proclamation) — done.** _The patient's copy of their record_ on
  every chart (new permission `patients.export`): the whole record printed, or as a JSON file for
  another clinic, logged as handed over. **Admin Panel → Data Protection** sets the retention period
  and lists records not seen within it for review — nothing is deleted automatically.
  **Breach Log** records each breach, what was done, and when the authority and the people affected
  were told. Corrections are ordinary audited edits. Not done: erasure or anonymising (a person's
  decision, record by record).

---

## Smaller things noticed along the way

- **Amharic help text** written in this round — reminders, the HMIS report, usual work, the hours
  warning, and since then the gum chart, radiographs, consent forms and the medical-history
  questionnaire, sterilisation, controlled medicines, orthodontics, deposits and data protection —
  should be read by a native speaker. The consent wording also wants the clinic's lawyer.
- ✅ **The dev database has no upcoming appointments — done.** `npm run db:seed -- --yes --to-today`
  moves the seeded block of appointments so it is centred on today; running it again does nothing.
- ✅ **Seed oddity — done.** Patients under three get whole-mouth work only and no findings. The
  13 unbilled findings the old seed left on babies in the dev database were soft-deleted; 20 billed
  ones stay until a `--fresh` reseed.
- ✅ **The kit nests a button inside a button — no longer happens.** Both the app's and the kit's
  sidebar build the trigger with a `child` snippet; checked on four pages at desktop and phone
  width with no nested controls and no hydration warning.
