# Roadmap: from schema to working app

The schema describes a whole dental clinic. The app so far covers the **front door** (patients,
appointments, dentists, chairs), **the back office inherited from the ERP** (staff, payroll,
expenses, supplies) and **the clinic's reference lists**. The **clinical record and patient
billing** exist only as tables, seed rows and counts on the patient chart. Nothing can yet chart a
tooth, present a plan, issue an invoice or count a drawer.

This file records what is built, what is missing, and a suggested order for the rest. It was
written by reading `src/lib/server/db/schema/` against `src/routes/`, `src/lib/server/` and
`scripts/seed/` as of `f43f67c` (2026-09-25).

Legend: **✅ done** means a screen reads and writes it. **🟡 partial** means it is read, seeded or
half-wired, with a named gap. **⬜ not started** means only the schema and the seed touch it.
**🗑 legacy** means it came from the ERP and needs a keep-or-drop decision.

---

## 1. Where every table stands

### Patients

| Table                                                       | Status | Where / gap                                                                                                                  |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `patient`                                                   | ✅     | list, registration, chart (`/dashboard/patients/**`)                                                                         |
| `patient_allergies`, `_conditions`, `_medications`          | ✅     | chart sections via `childCrud`, audited, `patients.clinical`                                                                 |
| `patient_contacts`, `_emergency_contacts`                   | ✅     | chart sections, `patients.edit`                                                                                              |
| `referral_source`, `allergen`, `condition`, `contact_types` | ✅     | admin-panel lookups                                                                                                          |
| `patient.mergedInto`                                        | 🟡     | the chart follows a merged record, but **nothing can merge two**. `possibleDuplicates` warns at registration and stops there |
| `patient_access_log`                                        | 🟡     | written on every chart open. **No screen reads it**, so a "who looked at this patient" question still needs SQL              |
| `medicine`                                                  | ✅     | `admin-panel/medicines`; also the medication picker on the chart                                                             |

### Scheduling

| Table                            | Status | Where / gap                                                                                  |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `appointment`                    | ✅     | day view, list, booking, status flow (`$lib/appointmentStatus.ts`)                           |
| `operatory`                      | ✅     | admin-panel `chairs`                                                                         |
| `appointment_type`               | ✅     | admin-panel lookup                                                                           |
| `clinic_closure`                 | ✅     | admin-panel `closures`                                                                       |
| `provider`, `provider_specialty` | ✅     | `/dashboard/providers`, admin-panel `specialties`                                            |
| `appointment_type_services`      | ⬜     | seeded only. Meant to say what a visit type normally involves, so it can pre-fill procedures |

### The clinical record (the largest gap)

| Table                 | Status | Gap                                                                                                                 |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `tooth`               | ✅     | the odontogram and the procedure form; names shared with `$lib/teeth.ts`                                            |
| `procedures`          | ✅     | the Dental chart tab: odontogram, procedure list, add/edit/delete, audited                                          |
| `treatment_plan`      | ✅     | the patient's Treatment plans tab, a plan page, a printable quote, and Plan Follow-up                               |
| `treatment_plan_item` | ✅     | snapshotted lines, answered one by one                                                                              |
| `clinical_note`       | 🟡     | counted on the chart; no screen                                                                                     |
| `prescription`        | 🟡     | counted on the chart; no screen                                                                                     |
| `prescription_item`   | ⬜     | seed only                                                                                                           |
| `patient_file`        | 🟡     | counted on the chart. `server/files.ts` and `/dashboard/files/[name]` are ready, with no upload screen for patients |
| `patient_consent`     | 🟡     | counted on the chart; no screen                                                                                     |
| `recall`              | ⬜     | seeded and branch-scoped; no screen and no job                                                                      |
| `lab_case`            | ⬜     | no screen. Its lab list (`dental_lab`) is a working lookup                                                          |

### Money

| Table                                          | Status | Where / gap                                                                                                                                         |
| ---------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice`                                      | ✅     | raised from completed work on a patient's Billing tab, issued with a number, printed; discounts and voids through the approvals queue               |
| `invoice_line`                                 | ✅     | snapshotted from procedures, or typed as a charge on a draft                                                                                        |
| `invoice_payment`                              | ✅     | one payment across several bills, several payments on one bill                                                                                      |
| `cash_session`                                 | ✅     | Billing → Cash Drawer: open with a float, count and close; cash payments are recorded against it                                                    |
| `transactions`                                 | 🟡     | `/salary/transactions` lists them. There is no patient payment path; the only writers are expenses and payroll                                      |
| `payment_methods`, `vat_and_withhold`          | ✅     | admin panel                                                                                                                                         |
| `expenses`, `expenses_type`                    | ✅     | `/salary/transactions/expenses/**`, approvals                                                                                                       |
| `payroll_*`                                    | ✅     | `/salary/**`, approvals                                                                                                                             |
| `transaction_services`, `transaction_supplies` | 🗑     | from the ERP. `invoice_line` replaces them (see its schema comment). Four report consumers remain                                                   |
| `customers`, `customer_contacts`               | 🗑/✅  | screens work. In a clinic they are the **payer** (employer or insurer) that `invoice.customerId` points at, and they should be re-labelled that way |

### Stock

| Table                                          | Status | Gap                                                                                                                                                                                  |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supplies`, `supply_types`, `supply_suppliers` | ✅     |                                                                                                                                                                                      |
| `supplies_adjustments`, `damaged_supplies`     | ✅     | through `moveStock`                                                                                                                                                                  |
| `supply_batch`                                 | 🟡     | expiry, lot number and supplier are recorded on delivery and listed on the item's page; expired lots are never issued. No dashboard warning yet, and no trace from a lot to patients |

### Staff, access and the system

| Table                                                                    | Status | Note                                   |
| ------------------------------------------------------------------------ | ------ | -------------------------------------- |
| `employee` and the ~25 HR/payroll tables                                 | ✅     | the ERP half, working                  |
| `user`, `session`, `account`, `roles`, `permissions`, `role_permissions` | ✅     |                                        |
| `branch`                                                                 | ✅     | admin panel, plus the top-bar selector |
| `region`, `city`, `subcity`, `address`                                   | ✅     |                                        |
| `audit_log`                                                              | ✅     | `reports/system`                       |
| `job_run`, `backup`                                                      | ✅     | leave job, `/dashboard/backup`         |

---

## 2. Things that are not tables but are also unfinished

- ~~**Navigation lags behind the screens.**~~ Done in Stage 0. Ten clinic lookups had no
  sidebar entry, four menu links went nowhere, and four of the eight approval queues had no
  entry. The sidebar and the palette now share `$lib/navigation.ts`, and `navigation.test.ts`
  fails on a dead link or a queue with no entry.
- ~~**Help backlogs**~~ Done: every screen has help of its own and a route-map row, and the
  orphaned files are gone. All three backlogs in `coverage.test.ts` are empty.
- ~~**The manual's introduction still describes the facilities ERP.**~~ Rewritten for the clinic
  with Stage 1: what the system is, a visit's path through it, and the menu as it now stands.
- ~~**The rest of the help still describes pruned features.**~~ Rewritten, in English and Amharic,
  against what each screen does now. Checking the help against the screens also turned up two
  dead links in the area menus (now guarded by a test), an empty filter heading on Stock Levels,
  a false promise that an administrator can set a password, and the payroll bugs below.
- ~~**Payroll arithmetic was wrong.**~~ Fixed (migrations 0030–0031, `server/payrollMath.ts`). Tax
  rates were stored as percentages and multiplied as fractions; the open-ended top band was never
  matched, so the highest earners paid no tax; pension rates were read by row position from a
  table holding two fines; a run's employer-pension total was built from its tax total; and a
  payslip adjustment took the employer's pension out of the employee's net. Tax is now one rule,
  tested in JavaScript and against the database in SQL, and pension rates are keyed by who pays.
  The seeded bands are those of Proclamation 1395/2025, and `/setup` seeds them on a new install.
- ~~**Commission was never calculated.**~~ Done (`server/commission.ts`). A clinician whose salary
  has commission switched on earns its percentage of the fees of the procedures they completed in
  the month, each at the rate in force on the day of the work; it is part of gross and taxable pay.
  It pays on production, not collections — there are no invoices to pay on until Stage 3.
- ~~**Stock expiry was never entered.**~~ Done. A delivery records its expiry date, lot number and
  supplier; an item marked Expires cannot be received without a date, or with one that has
  passed. The item's page lists its lots, next to be used first, with expired and expiring-soon
  dates marked. Issuing skips expired lots; they leave as damage write-offs.
- ~~**Damage reports corrupted each other.**~~ Fixed. Recording damage ran an `UPDATE` with no
  `WHERE`, overwriting every earlier report; undoing one returned nothing to the shelf, or the full
  quantity to every lot it spanned; and a deductible report always failed after the stock had
  moved. It is now one transaction, and tested.
- ~~**A payroll run never confirmed.**~~ Fixed. The success message was returned from inside the
  transaction, so the action returned nothing. Its dates are now zero-padded ISO days.
- **The payroll run trusts the figures the browser posts back.** The page computes every payslip,
  sends it to the browser, and the action writes what comes back — gross, tax and net included.
  CLAUDE.md §9 says the server decides those; the action should recompute from the same query. The
  file also carries type errors from its `date` columns being in `Date` mode while it passes
  strings, which is a mode change across the payroll tables rather than a local fix.
- ~~**Services have no price.**~~ Done (migration 0028). `services` has `price`, `area` (what the
  chart asks for) and `removesTooth`, and the seed catalogue is priced in birr.
- ~~**The chart is near its size limit.**~~ Done. The chart is a layout with tabs; the overview's
  server file went from 584 lines to 402, and no chart file is over 402.
- **Reports have no clinical sections.** `reports/sections.ts` has 23 sections, all HR, payroll,
  stock or money. None covers production per dentist, case acceptance, recalls due, receivables or
  cash variance.
- ~~**Every `defaultNow()` timestamp read three hours late.**~~ Fixed. Database sessions run in
  UTC (`db/connection.ts`, tested). "Today" comes from the clinic's clock, and migration 0035
  moved the `deleted_at` stamps already written in local time.
  Along the way it fixed "upcoming appointments", which compared against a local `NOW()` and were
  three hours off. The period filter (`currentMonthFilter`) now compares clinic-day instants, since
  a UTC session would otherwise have dropped the first three hours of a period's first day; a
  boundary test pins both edges. better-auth's own timestamps from before the fix still read three
  hours early. They are sign-in bookkeeping, and nothing can tell them apart from rows the database
  stamped correctly.

- ~~**A customer page could edit any address.**~~ Fixed. The address form posted an address id and
  the action updated whatever row it named, so a crafted POST from a customer page could rewrite a
  patient's or an employee's address. It now edits the customer's own address, found on the
  server. The page also crashed for a customer with no address; it no longer offers the dialog.
- **Type health.** `npm run check` reports 772 errors repo-wide. Per CLAUDE.md §3 this is a
  direction rather than a stage: files you touch must be clean.

---

## 3. Suggested stages

The order follows the data. Procedures come first because plans, invoices, the odontogram,
recalls and most clinical reports are views over them. Billing comes after procedures because an
invoice is generated from a visit's procedures. Each stage is shippable on its own and leaves the
app more honest than it found it.

Every new screen has the same definition of done (CLAUDE.md §1, §9, §14, §16): a `routeRules`
entry, a `DESCRIPTIONS` row for any new permission, `recordAudit` inside the write's transaction,
`locals.branch.active` stamped on creates of branch-scoped tables, an `entityLinks` kind if the
record has its own page, `$lib/content` help, a `ROUTE_MAP` row, a sidebar entry and seed rows.

### Stage 0: Make the app show what it already has (small, do first)

It unblocks nothing technically, but it is a day's work and removes the "where is that screen"
problem before new screens make it worse.

**Status: done.**

1. ✅ Sidebar and palette read one list (`$lib/navigation.ts`). The clinic lookups have a
   **Clinic Setup** group of their own, the dead links are gone, and all eight approval queues
   are listed. The sidebar dropped from 639 lines to under 100. A group is now highlighted by its
   most specific link, so Supply Types no longer lights up Admin Panel.
2. ✅ **Medicines** (`admin-panel/medicines`): generic name, brand, strength, form, prescribable,
   antibiotic, and the three risk flags.
3. ✅ Help (English and Amharic) for the twelve clinic setup screens, `ROUTE_MAP` rows for them,
   the 16 orphaned help files deleted, and the customer help rewritten, since it described the
   pruned sites and contracts. The route walker the tests share is now `$lib/testing/routes.ts`.
4. ✅ `sent_reports` and `staff_services` dropped (migration 0028). The database is local-only,
   and neither table had a reader or a writer.

### Stage 1: Procedures and the odontogram (the clinical core)

**Status: done.**

**Tables:** `procedures`, `tooth`, `appointment_type_services`

1. ✅ **Split the chart first.** Turn `/patients/[id]` into a layout with tabs: overview (today's
   page), chart, plans, billing, and files & notes. A shared `+layout.server.ts` loads the patient
   header and writes the access-log row, so it is logged once rather than per tab. Each later
   stage then adds a tab rather than growing one file past 500 lines. _As built:_ the access log is
   written per tab (`logPatientView`, record types `summary` and `procedure`), so the log can say
   which part of the chart was opened.
2. ✅ **Odontogram:** an FDI grid of 52 teeth (permanent plus primary, toggled by age) drawn from
   `tooth`. Each tooth is coloured by its procedures' statuses (`condition`, `planned`,
   `completed`, `existing`). Clicking a tooth opens a `FormDialog` that charts a procedure: service,
   surfaces (`MODBLI`), status and fee defaulted from the service price. _As built:_ the form
   changes shape with `services.area`, the surface picker offers only the surfaces the tooth has,
   and extractions draw a missing tooth.
3. ✅ **Procedure list** under the grid, grouped by status, using `data-table.svelte`.
4. ✅ **Completing a visit:** when an appointment moves to `completed`, offer its planned procedures
   and pre-fill from `appointment_type_services`. Complete them in the same transaction.
5. ✅ Server module `server/procedures.ts` holds the shared queries (chart, outstanding work, per
   visit). Writes go through `recordAudit('procedures')`. Permission is the existing
   `patients.clinical`. _As built:_ writes go through `childCrud` with `procedureTransform`, which
   refuses with a named field (`WriteRefused`) rather than a 500.

**Verified in the browser** (2026-09-26, as a dev admin): charting, the surface and dentist
refusals, a bridge by span, editing to done, and deleting, each checked against the database and
the audit log. Two things fixed on the way: the odontogram clipped the back teeth on narrow
screens, and the charting form's validator looped, which hid every server refusal.

_As built:_ "Complete visit" opens a panel listing the patient's planned work and the visit type's
whole-mouth services (pre-ticked). One transaction completes the visit and records the ticked work,
dated to the visit and credited to its dentist. Ticking needs `patients.clinical`; a plain status
change can no longer complete a visit, so there is one path. Verified in the browser, including a
posted foreign procedure id, which is refused and rolls the whole completion back.

**Also fixed on the way:** every lookup edit dialog shared one form id, so a save's reply was sent to
every row's dialog (each now has its own); the seed charted adult work on children (it now follows
the patient's dentition); a leave-ledger test broke once the accrual job had run (its fixture now
clears the borrowed employee's grants inside its rollback); and three copies of a test rollback
helper became `$lib/testing/rollback.ts`.

**Done when:** a dentist can chart an exam's findings, plan work, and mark it done at the visit,
and the dashboard's "completed today" number means something.

### Stage 2: Treatment plans and case acceptance

**Tables:** `treatment_plan`, `treatment_plan_item`

1. Build a plan from the patient's `planned` procedures. Items **snapshot** description and price
   at presentation, and are never re-read through the procedure.
2. Status flow `draft → presented → accepted/partial/declined → completed`, plus `expired` past
   `validUntil`. Per-line accept or decline, and a decline reason.
3. A printable quote, using the same print-style approach as `Receipt`.
4. A **follow-up list**: every plan still `presented`, oldest first. The schema's index is built
   for this query.

**Done when:** the chart can answer "what did we propose, and what did they say", and nobody has
to remember it.

**Done.** A plan is drawn up from planned work on the patient's **Treatment plans** tab, as a draft
whose lines snapshot each procedure's description and price. It is edited only as a draft, then
presented with a validity date (90 days by default). The answer is recorded line by line; the
plan's status follows from the lines, and any no needs a reason. A quote past its date reads as
expired everywhere without a job to mark it, and its work is free to go on a new plan. A plan is
completed once all its agreed work is done on the chart. The quote prints on the branch's
letterhead and is logged as a print. **Patients → Plan Follow-up** lists quotes awaiting an answer,
longest-waiting first, with case acceptance over the last 90 days. Rules in
`$lib/treatmentPlanStatus.ts`; queries and writes in `server/treatmentPlans.ts`, audited and tested;
permission `treatment_plans.manage` (migration 0032 adds the plan to the access log's record
types).

A presented quote can still be corrected while it is live — re-priced, reworded, a line added
before the answer or removed — with a reason each time. Every change is a row in
`treatment_plan_adjustment` (migrations 0033–0034), which nothing updates or deletes; the plan page
lists them with the quote's first total, lines changed after the patient agreed are flagged, and a
reprinted quote says it was revised and what it first came to.

Not done: booking the agreed work straight from the plan, and a case-acceptance section in
Reports.

### Stage 3: Billing, payments and the cash drawer

**Tables:** `invoice`, `invoice_line`, `invoice_payment`, `cash_session`, `transactions`

1. **Raise an invoice from a visit.** Gather the appointment's completed procedures into
   snapshotted lines. A standalone invoice (a missed-appointment fee, a sold item) is also
   allowed. Assign numbers from a sequence that cannot collide.
2. **Discount and void go to approval.** The `APPROVAL_ENTITIES` row already exists, so this stage
   only sets `approvalStatus = 'pending'` on those two paths. The discount threshold is a setting.
3. **Take a payment:** write one `transactions` row plus `invoice_payment` rows. Support one
   payment across several invoices and several payments on one invoice. A cash payment requires an
   open `cash_session` at the branch.
4. **Cash sessions:** open with a float. Close by counting, freezing `expectedAmount` at the count,
   and recording what was banked. Variance is derived, never stored.
5. **Balances:** outstanding amount on the chart header and the patient list, plus a receivables
   list.
6. **Stop writing `transaction_services` and `transaction_supplies`.** Move their four report
   consumers onto `invoice_line`, then mark the tables for removal.
7. Re-label **customers as payers** (employer or insurer). An invoice may bill one.

**New permissions to decide** (a permission rename is a data migration, per CLAUDE.md §9, so get
the names right first). Suggested: `billing.invoice` (raise and take payment) and
`billing.cash_session` (open and close a drawer). Voids and discounts are approved through the
existing `approvals.approve`.

**Done when:** a visit ends with a bill, the bill with a payment, and the day with a counted
drawer.

**Done (items 1–5).** A bill is raised on the patient's **Billing** tab from completed work, as a
draft that snapshots each line. It can take extra charges and a discount, and is issued with a
number from a counter that cannot collide (`INV-2019-00001`). A discount over the clinic's limit
(Admin Panel → Billing Settings, 10% by default) and any void wait in Approvals → Discounts and
Voids, and the bill takes no payment until a manager decides. A refused request leaves the bill
payable at full price (the new `onReject` hook). A payment is one transaction and one allocation
per bill, with a receipt number; cash needs the branch's drawer open. The drawer opens with a
float and closes with a count; the expected figure is frozen at the count, and a variance needs a
note. What a patient owes has one definition (`patientBalance`), shown in the chart header, the
overview, the Billing tab, the patient list and the **Who Owes** list. Payment methods now say
what kind of money they are (migration 0036). Opening and printing a bill is in the access log
(0037). Modules: `server/billing.ts` (reads), `invoiceWrites.ts`, `payments.ts`, `cashDrawer.ts`,
`documentNumbers.ts`; rules in `$lib/invoiceStatus.ts`; all tested.

**Done (items 6–7, refunds, old receipts).**

- **Item 6.** The services-rendered report and the money analytics read billed lines
  (`reports/billedLines.server.ts`): a bill's line counts once the bill is issued, dated by its
  issue, with the procedure's clinician. `transaction_services` and `transaction_supplies` are
  dropped (migration 0038).
- **Item 7.** Customers are **payers** on every screen (the table and the route keep their names;
  the permission `customers.record` is data). A bill starts billed to the patient's payer, and
  **Bill to** on a draft changes it; the payer is printed on the bill. A payer's page lists their
  bills across patients, what they owe, and takes one payment across many of them
  (`takePayerPayment`). **Who Owes** lists payers separately, and a payer's bill is not counted
  again under the patient.
- **Refunds.** Asked from a payment on the bill's page, approved in Approvals → Refunds. The
  refund is a negative allocation on a money-out transaction that counts only once approved; it
  cannot exceed what that payment put on the bill less refunds already asked. Approval numbers it
  (`RFD-`), puts the bill back to owing, and needs the drawer open for cash (`settleRefunds`).
- **Old payments** have receipt numbers (migration 0039), numbered per Ethiopian year in the order
  the money came in, and the counters moved past them.

### Stage 4: The rest of the chart

**Tables:** `clinical_note`, `patient_file`, `patient_consent`, `prescription`,
`prescription_item`, `patient.mergedInto`

Mostly `childCrud` sections on the new tabs, each using the audit and permission options.

1. **Clinical notes:** a timeline, tied to an appointment where there is one. Consider making them
   append-only (correct by adding a note) rather than editable.
2. **Files:** upload through `saveUploadedFile`, preview radiographs and photos, and read
   `fileAudit.ts` before building (it says a `files` table is the next step).
3. **Consents:** type, method, the date signed, and an optional scanned form (a `patient_file`).
4. **Prescriptions:** header plus items against the formulary from Stage 0, and a printable
   prescription. Show the patient's allergies and current medications on the form.
5. **Merge duplicates:** a super-admin action that re-parents every child row, sets `mergedInto`,
   and writes one `merge` audit row. The read side already handles the result.

**Done.** The chart has four new tabs, each written under `patients.clinical` and audited, each
opening logged in the access log.

- **Notes** (`server/clinicalNotes.ts`): a timeline, newest first. A note is signed at once or kept
  as a draft only its author may change, sign or discard. A signed note is never changed; **Amend**
  adds a signed correction beneath it, and a chain of corrections reads under the first note.
- **Prescriptions** (`server/prescriptions.ts`): written against the patient's allergies and
  current medicines, shown on the form. The prescriber must be able to prescribe, the medicines
  must be on the prescribing list, and the indication is required. A medicine that clashes with an
  allergy is flagged as it is chosen and refused on the server unless acknowledged; the
  acknowledgement is in the audit row. The clash rule is `$lib/allergyClash.ts`, shared by the form
  and the server, and reads a new `medicine.allergen_id` (migration 0041, set for the seeded
  medicines and editable on the medicines screen). Printed as the Ethiopian form lays it out. Not
  edited once written; a super admin cancels one written in error.
- **Files** (`server/patientFiles.ts`): radiographs, photographs, letters and photographed paper
  charts, with the date the paper was written. Radiographs upload uncompressed. **The file route now
  checks `patients.view` for a patient's file and logs the opening** — a patient file is no longer
  protected only by its random name. `fileAudit.ts` reconciles `patient_file` too.
- **Consents** (`childCrud` + `LookupSection`): type, method, date, who gave it and their
  relationship, the witness, the treatment and the signed form, each checked to be this patient's.
  A verbal consent needs its witness. Withdrawn by giving a reason, which dates itself; deleted only
  by a super admin (`superAdminDelete`, new on `childCrud`).
- **Merge** (`server/patientMerge.ts`): a super admin merges a duplicate from the overview, where the
  registration check's suggestions are listed. Every owned row moves in one transaction — a test
  compares the list with the database's foreign keys — a shared allergy, condition or medicine is
  kept once, blank fields are filled, and one `merge` audit row says what moved. The access log is
  not rewritten; the chart reads views across merged records instead.

Shared along the way: `refuseUnless` (was in three modules), `checkedProvider`, `checkedVisit` and
`recentVisits` (`server/appointments.ts`), `clinicalAction` for the clinical tabs.

### Stage 5: Bringing patients back, and work sent out

**Tables:** `recall`, `lab_case`, `appointment_type_services` (if not finished in Stage 1)

1. **Recalls:** create one automatically when a visit type calls for it (a check-up every six or
   twelve months). The "due this month" list links to booking. Status becomes `booked` when the
   appointment is made and `completed` when it is attended. Reuse the `job_run` pattern from
   `leaveJob.ts` for the scheduled part.
2. **Lab cases:** sent, due back, received, fitted or remake, linked to the procedure they serve
   and shown on the chart and the day view. Include an "overdue from the lab" list.

### Stage 6: Oversight and reports

**Tables:** `patient_access_log`, `supply_batch`, plus report sections over Stages 1–5

1. **Access log viewer:** per patient on the chart, and per user in `reports/system`.
2. **Stock lots:** expiry is now recorded on delivery and lots are listed on the supply page.
   Left: a near-expiry warning on the dashboard, and a trace from a lot to the patients who
   received it.
3. **Clinical report sections**, as rows in `SECTIONS` rather than new routes: production per
   dentist, procedures by service, case acceptance, recalls due or missed, receivables aging, cash
   variance, lab turnaround.

### Stage 7: Pay down the ERP residue (runs alongside the others)

- Split the files over 500 lines listed in CLAUDE.md §6 when their feature is next touched.
- Migrate the remaining 59 forms onto `createForm` as each page is touched.
- Shrink the help and route-map backlogs as screens get their help.
- Drop the tables that Stage 0 and Stage 3 decided to retire.
- Make the payroll run recompute what it writes instead of trusting the posted figures (§2 above).

---

## 4. At a glance

| Stage | Theme                             | New tables served | Depends on       | Size    |
| ----- | --------------------------------- | ----------------- | ---------------- | ------- |
| 0     | Show what exists                  | `medicine`        | none             | small   |
| 1     | Procedures and odontogram         | 3                 | 0                | large   |
| 2     | Treatment plans                   | 2                 | 1                | medium  |
| 3     | Billing and cash                  | 5                 | 1                | large   |
| 4     | Notes, files, consents, Rx, merge | 5 + merge         | 0 (Rx), 1 (tabs) | medium  |
| 5     | Recalls and lab cases             | 2                 | 1, 3             | medium  |
| 6     | Oversight and reports             | 2 + reports       | 1–5              | medium  |
| 7     | Residue                           | none              | ongoing          | ongoing |

Stages 2 and 3 can run in parallel once Stage 1 has landed. Stage 4 only needs the tab split from
Stage 1, step 1.
