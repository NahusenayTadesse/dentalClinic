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

### 2. Amharic screens, not just Amharic help

Every label, button and message is in English. Reception staff in most clinics will work faster in
Amharic; Afaan Oromo matters for clinics in Oromia.

- **Build on:** the kit already reads its own labels through `useLabels()`, and the help system
  already switches language. The app's own strings are the gap.
- **Size:** large but mechanical. Start with the front desk: patients, the diary, billing.

### 3. SMS reminders and recalls

Patients are phone-first. **Reminders** and **Recalls** record calls, but cannot send anything.

- **Add:** send an Amharic SMS through an Ethiopian bulk-SMS provider, from the same two lists.
  Each message costs money, so keep a per-patient opt-out and a cost log.
- **Build on:** `server/reminders.ts` (`recordReminder` already stamps `reminderSentAt`, so a sent
  SMS is one more way to reach that write), `server/recalls.ts`, and the no-show comparison tile,
  which will show whether SMS works better than calls.

### 4. Mobile money: Telebirr and CBE Birr

They exist only as payment methods of kind `mobile`. The money arrives without a trail the system
can check.

- **First step:** record the transaction reference on a mobile payment, and match the day's mobile
  payments at closing, the way the cash drawer is counted (`server/cashDrawer.ts`).
- **Later:** a payment gateway (Chapa, ArifPay) to take the payment directly.

### 5. Receipts that satisfy the tax rules

- As I understand the rules, dental services are VAT-exempt but goods sold (toothbrushes,
  whitening kits) are taxable, and a clinic is on VAT or on turnover tax depending on its turnover.
  Bills do not calculate VAT yet: `transactions.vatAmount` exists, and billing never writes it
  (see the note at the top of `server/billing.ts`).
- The receipt needs the clinic's TIN, and the payer's for a company payer, and must meet the
  Ministry of Revenues' requirements (sales registration machine or e-invoicing).
- **Build on:** `server/invoiceWrites.ts`, the `vat_and_withhold` table, the existing printed bill.

### 6. Insurance and employer credit, done properly

Payers exist (an invoice can be billed to an employer or insurer, and a payer pays many bills at
once), but there is no:

- pre-authorisation before treatment
- coverage limit per patient or per year
- co-payment split between patient and payer
- monthly claim batch to send to the insurer or employer

Credit income keeps many clinics running, so this matters more than it looks.

### 7. Coping with power and internet cuts

- Run on a local server on the clinic's network, so a cut to the internet is not a cut to the
  clinic. SQLite in WAL mode is already a planned install target (CLAUDE.md §10).
- Automatic off-site backups. `/dashboard/backup` exists; a restore that is rehearsed matters more
  than the button.

---

## Clinical depth dentists will expect

- **Periodontal chart:** pocket depths, bleeding and mobility per tooth, compared across visits.
  `$lib/teeth.ts` already knows every tooth and surface.
- **Radiographs:** import from intraoral sensors and panoramic machines, and a viewer that compares
  images over time. Files already upload uncompressed for radiographs (`server/patientFiles.ts`).
- **Medical-history questionnaire and consent templates** in Amharic, printed for signature.
  Consents are recorded (`patient_consent`) but there are no templates to print.
- **Sterilisation and infection-control log:** autoclave cycles, and which instrument packs were used
  on which patient. Inspectors ask for this.
- **Controlled-medicine register** for the Ethiopian Food and Drug Authority, built on the stock lots
  already tracked (`supply_batch`, `moveStock`, and the trace from a lot to its patients).
- **Orthodontic cases:** progress over months, with instalment payment plans — orthodontics is
  usually paid monthly.

---

## Running the business

- **Export to accounting software.** Peachtree is very common here; at minimum, a chart-of-accounts
  journal export. Every money movement is already a `transactions` row.
- **Purchase orders and supplier invoices.** Stock has deliveries and issues, and the dashboard flags
  items below their reorder level — but nothing turns that into an order to a supplier, or matches
  what arrives against what was ordered.
- **Patient account statements, treatment packages and deposits.** `patientBalance` is the single
  definition of what a patient owes, so a statement is a printout of what already exists.
- **Personal data protection (2024 proclamation).** Retention rules, giving patients a copy of their
  record, and a breach log. The access log (`patient_access_log`) is a good start.

---

## Smaller things noticed along the way

- **Amharic help text** written in this round (reminders, the HMIS report, usual work, the hours
  warning) should be read by a native speaker.
- **The dev database has no upcoming appointments.** The seed builds ±14 days around the day it runs,
  so a database seeded a while ago has an empty diary ahead. A "move the diary to today" seed step
  would keep demos honest.
- **Seed oddity:** a caries finding on a patient under one year old. The seed charts by dentition,
  not age.
- **The kit nests a button inside a button** in the sidebar menu, which causes a hydration warning on
  every page.
