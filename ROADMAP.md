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

| Table                                                       | Status | Where / gap                                                                             |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `patient`                                                   | ✅     | list, registration, chart (`/dashboard/patients/**`)                                    |
| `patient_allergies`, `_conditions`, `_medications`          | ✅     | chart sections via `childCrud`, audited, `patients.clinical`                            |
| `patient_contacts`, `_emergency_contacts`                   | ✅     | chart sections, `patients.edit`                                                         |
| `referral_source`, `allergen`, `condition`, `contact_types` | ✅     | admin-panel lookups                                                                     |
| `patient.mergedInto`                                        | ✅     | a super admin merges a duplicate from the overview (`server/patientMerge.ts`, Stage 4)  |
| `patient_access_log`                                        | ✅     | the chart's **Access log** tab, and Reports → System → Patient Record Access (per user) |
| `medicine`                                                  | ✅     | `admin-panel/medicines`; also the medication picker on the chart                        |

### Scheduling

| Table                            | Status | Where / gap                                                                                 |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `appointment`                    | ✅     | day view, list, booking, status flow (`$lib/appointmentStatus.ts`); reminders (Stage 8)     |
| `operatory`                      | ✅     | admin-panel `chairs`                                                                        |
| `appointment_type`               | ✅     | admin-panel lookup                                                                          |
| `clinic_closure`                 | ✅     | admin-panel `closures`                                                                      |
| `provider`, `provider_specialty` | ✅     | `/dashboard/providers`, admin-panel `specialties`                                           |
| `appointment_type_services`      | ✅     | Appointment Types → **Usual work**; pre-ticked when a visit is completed (Stage 8)          |
| `staff_schedule`, `leave`        | ✅     | read by booking: a dentist off, out of hours or on leave is a warning to override (Stage 8) |

### The clinical record (the largest gap)

| Table                 | Status | Gap                                                                                             |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `tooth`               | ✅     | the odontogram and the procedure form; names shared with `$lib/teeth.ts`                        |
| `procedures`          | ✅     | the Dental chart tab: odontogram, procedure list, add/edit/delete, audited                      |
| `treatment_plan`      | ✅     | the patient's Treatment plans tab, a plan page, a printable quote, and Plan Follow-up           |
| `treatment_plan_item` | ✅     | snapshotted lines, answered one by one                                                          |
| `clinical_note`       | ✅     | the chart's **Notes** tab: signed or draft, amended by a new note (Stage 4)                     |
| `prescription`        | ✅     | the chart's **Prescriptions** tab, checked against allergies, printable (Stage 4)               |
| `prescription_item`   | ✅     | the lines of a prescription, against the formulary (Stage 4)                                    |
| `patient_file`        | ✅     | the chart's **Files** tab; the file route checks `patients.view` and logs the opening (Stage 4) |
| `patient_consent`     | ✅     | the chart's **Consents** tab, withdrawn with a reason (Stage 4)                                 |
| `recall`              | ✅     | **Recalls** list, kept by the diary's own writes; next recall on the chart overview             |
| `lab_case`            | ✅     | **Lab Work** board, the chart's Lab work tab, badges on the day view                            |

### Money

| Table                                          | Status | Where / gap                                                                                                                                         |
| ---------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice`                                      | ✅     | raised from completed work on a patient's Billing tab, issued with a number, printed; discounts and voids through the approvals queue               |
| `invoice_line`                                 | ✅     | snapshotted from procedures, or typed as a charge on a draft                                                                                        |
| `invoice_payment`                              | ✅     | one payment across several bills, several payments on one bill                                                                                      |
| `cash_session`                                 | ✅     | Billing → Cash Drawer: open with a float, count and close; cash payments are recorded against it                                                    |
| `transactions`                                 | ✅     | `/salary/transactions` lists them; written by patient and payer payments, refunds, expenses and payroll                                             |
| `payment_methods`, `vat_and_withhold`          | ✅     | admin panel                                                                                                                                         |
| `expenses`, `expenses_type`                    | ✅     | `/salary/transactions/expenses/**`, approvals                                                                                                       |
| `payroll_*`                                    | ✅     | `/salary/**`, approvals                                                                                                                             |
| `transaction_services`, `transaction_supplies` | 🗑      | from the ERP. `invoice_line` replaces them (see its schema comment). Four report consumers remain                                                   |
| `customers`, `customer_contacts`               | 🗑/✅   | screens work. In a clinic they are the **payer** (employer or insurer) that `invoice.customerId` points at, and they should be re-labelled that way |

### Stock

| Table                                          | Status | Gap                                                                                                                                                                                              |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supplies`, `supply_types`, `supply_suppliers` | ✅     |                                                                                                                                                                                                  |
| `supplies_adjustments`, `damaged_supplies`     | ✅     | through `moveStock`                                                                                                                                                                              |
| `supply_batch`                                 | ✅     | expiry, lot and supplier on delivery; expired lots never issued; an expiring-stock card on the dashboard; a removal can name the patient, and the item's page traces each lot to who received it |

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
- ~~**The payroll run trusts the figures the browser posts back.**~~ Fixed. The payslip query is
  `server/payrollRun.ts`, read by the page and by the action; the action takes only who, which
  account, the date and the receipt, and recomputes every amount inside the paying transaction. A
  selection the server would not pay (already paid, deactivated, unapproved) is refused whole, and
  the month comes from the route, not the form. Verified by posting a run with every figure set to
  1 birr: the real payslips were written. The payroll date columns moved to `mode: 'string'`, which
  cleared the file's type errors; closing a salary on approval now uses `addClinicDays`. On the way:
  the run never accumulated `totalPenalities`, the paid-salaries **Over Time** column read a field
  the load never had, and its adjustments' **Created By** link pointed at an id it never selected.
- ~~**Services have no price.**~~ Done (migration 0028). `services` has `price`, `area` (what the
  chart asks for) and `removesTooth`, and the seed catalogue is priced in birr.
- ~~**The chart is near its size limit.**~~ Done. The chart is a layout with tabs; the overview's
  server file went from 584 lines to 402, and no chart file is over 402.
- ~~**Reports have no clinical sections.**~~ Done in Stage 6: a **Clinic** report page.
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

**Done: booking the agreed work.** An answered plan with agreed work not yet booked offers **Book
the agreed work**, which opens the diary with the patient and the plan. The booking reserves that
work to the visit (`reservePlanWork`, one audit row on the plan), where the completion panel already
ticks it; cancelling or a no-show frees it again (`releaseBookedWork`). The case-acceptance section
is in the Clinic report, Stage 6.

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

**Done.**

- **Recalls** (`server/recalls.ts`): kept by the diary, not a job — the roadmap's `job_run`
  suggestion turned out unnecessary, because everything that changes a recall is already a write in
  `appointmentActions.ts`. Completing a visit closes the recall it answered and, if its type has a
  `recallIntervalMonths` (now editable on Appointment Types), creates the next one, month-end safe
  (`addClinicMonths`). Booking marks a due recall booked; cancelling or a no-show releases it.
  **Appointments → Recalls** lists who is due, longest overdue first, with call logging (no answer,
  call back, declined, stop) and **Book**, which opens the diary with the patient and visit type
  chosen. The chart overview says when the patient is next due.
- **Lab cases** (`server/labCases.ts`, `$lib/labCaseStatus.ts`): the moves are one table shared
  by the buttons and the server. Each move dates itself; the due date is the lab's promise or its
  usual turnaround. A remake sends the same case back and counts it (migration 0043). The chart has
  a **Lab work** tab (send, move); **Appointments → Lab Work** is the branch's board with how each
  lab has kept its promises; the day view marks a patient whose work is back or overdue. Audited,
  under the new `lab_cases.manage`; opening the tab is in the access log (migration 0044).

### Stage 6: Oversight and reports

**Tables:** `patient_access_log`, `supply_batch`, plus report sections over Stages 1–5

1. **Access log viewer:** per patient on the chart, and per user in `reports/system`.
2. **Stock lots:** expiry is now recorded on delivery and lots are listed on the supply page.
   Left: a near-expiry warning on the dashboard, and a trace from a lot to the patients who
   received it.
3. **Clinical report sections**, as rows in `SECTIONS` rather than new routes: production per
   dentist, procedures by service, case acceptance, recalls due or missed, receivables aging, cash
   variance, lab turnaround.

**Done.**

- **Access log** (`server/accessLog.ts`): the chart's **Access log** tab lists every opening and
  printing, by part of the chart, across merged records, for `audit_logs.view` only; the overview's
  short list now says which part was opened. Reports → System has a **Patient Record Access**
  ledger, searchable by staff or patient name.
- **Stock lots:** the dashboard lists lots at the branch that have expired on the shelf or expire
  within 90 days (`expiringLots`; the window, `LOT_WARNING_DAYS`, moved to `$lib/expiry.ts` so the
  item page and the dashboard agree). Taking stock out can name the patient it was used for, which
  records a `dispensed` movement; the item's page lists **Who received it, by lot** for
  `patients.view` holders (`lotRecipients`). Stock used without naming a patient still cannot be
  traced — that is a habit for the clinic, not something the schema can supply.
- **Clinic report** (`reports/clinic.server.ts`, `/dashboard/reports/clinic`, new `reports.clinic`):
  production by dentist and by service, case acceptance, recalls (missed ones named), receivables
  aging (a snapshot as of today), cash drawer counts and lab turnaround — eight tiles, three
  charts, seven ledgers. Every figure comes from the reader a working screen already uses
  (`completedWork`, `presentedPlans`, `openBills`, `closedSessions`, `labPerformance`), aggregated
  in TypeScript to stay off the portability ledger, and scoped by `locals.branch` (§15) rather
  than the report's old branch filter. Patients in its ledgers link through `entityLinks`.

### Stage 7: Pay down the ERP residue (runs alongside the others)

- Split the files over 500 lines listed in CLAUDE.md §6 when their feature is next touched.
- Migrate the remaining 59 forms onto `createForm` as each page is touched.
- Shrink the help and route-map backlogs as screens get their help.
- Drop the tables that Stage 0 and Stage 3 decided to retire.
- ~~Make the payroll run recompute what it writes instead of trusting the posted figures.~~ Done.

**Done: the payroll screens are one design.** Overtime, bonuses and deductions are one ledger route
(`/dashboard/salary/ledger/[kind]`, `server/payrollLedger.ts` + `payrollLedgerWrites.ts`) over any
period instead of two copied month pages, and bonuses have a list for the first time. Paid Salaries
is every payslip over any period (`server/payslips.ts`), each linking to its month's run page. All of
them are server-driven tables: date range, search, sort, paging, facets and totals over the whole
result. The payroll run keeps its month, with the table's own facets in place of `FilterMenu`, and
posts only who is paid. Fixed on the way: overtime priced from any salary row and duplicated per
salary row in bulk, refusals that did not roll back, `amount_per_hour` never written, adjustments
accepted into paid months. The three adjustment tables are now audited. Still on the old month
pages: attendance (`employees/attendance/[range]`) and the transactions and expenses `ranges/[range]`
copies of their server-driven lists.

### Stage 8: The diary's loose ends

Found by reading the schema against the code after Stages 0–7, not from the original plan: three
columns and tables the diary was built to use and never did.

**Done.**

- **Usual work for a visit type** (`appointment_type_services`). It was seeded and read — the
  completion panel pre-ticks it — but nothing could change it. Appointment Types has a **Usual work**
  column opening one shared dialog, which offers the same whole-mouth services the completion panel
  does. A save replaces only those links, so the seed's tooth-service links (which the panel never
  offers) are not quietly deleted by someone who could not see them. The service checklist is now
  `$lib/components/ServiceChecklist.svelte`, shared with the completion panel.
- **The dentist's hours at booking** (`staff_schedule`, approved `leave`). `bookingProblems` listed
  them as a non-goal "until those screens exist"; the employee Schedule section exists. The rule is
  `$lib/providerHours.ts`, shared by the booking and move dialogs and the server
  (`server/providerHours.ts`), the same way `allergyClash.ts` is. A day off, a slot outside the
  hours, or approved leave is a **warning** with a **Book anyway** tick, not a refusal; the overridden
  warning goes into the audit row. A dentist with no hours entered is never warned about, so a clinic
  that has not typed in timetables can still book.
- **Reminders** (`appointment.reminderSentAt`, never written before). **Appointments → Reminders**
  (`/dashboard/appointments/reminders`) is one day's appointments still to come, tomorrow by default;
  **Reminded** stamps the column and, if the patient said yes, confirms the visit in the same audited
  update (`server/reminders.ts`). A tile compares the no-show rate of reminded and unreminded visits
  over 90 days — the question the column's schema comment says it was kept to answer. Nothing is
  sent from the system; there is no SMS gateway, and the clinic rings from its own phone. The seed
  now reminds most visits the day before.

Verified in the browser (2026-10-02, as the dev admin): a usual-work edit saved and shown; a booking
past a dentist's 17:00 warned, kept Book disabled until ticked, and wrote the warning to the audit
row; the same booking posted without the tick was refused; recording a reminder confirmed the visit.

### Stage 9: Ethiopia — the monthly health report (HMIS)

The first of the Ethiopia-specific gaps: a clinic files a monthly return with its health office, and
the data for it was here with no way to produce it.

**Done.** **Reports → Health Report (HMIS)** (`/dashboard/hmis`, `reports.clinic`) is one Ethiopian
month at the branch in the top bar — each branch is a facility — with Pagume reported in Nehase.
It opens on the last month that has ended.

- **Visits**: completed appointments, **new** for a patient's first completed visit at the branch,
  **repeat** after, by sex and the HMIS age groups (under 1, 1–4, 5–14, 15–29, 30–64, 65+), age on
  the day.
- **Diagnoses**: one case per patient per condition in the month, from odontogram findings and from
  dental conditions dated on a day the patient was seen at the branch. Suspected conditions and
  medical history the clinic does not diagnose are left out.
- **Nothing is guessed.** Findings were charted as services with no link to a coded condition, so
  `services.condition_id` (migration 0047) says what a finding diagnoses, set on the Services screen;
  the seed links the two unambiguous ones. A finding with no link, a condition with no HMIS code and a
  patient with no birth date are listed at the top of the page, with where to fix each, rather than
  dropped. No HMIS code is seeded: the Ministry's list has to be entered by the clinic.
- Printed on the branch letterhead (A4 landscape) with signature lines, or downloaded as a CSV for
  DHIS2. Modules: `$lib/hmisReport.ts` (period, age groups, tallies), `server/hmisReport.ts`.

Verified in the browser (2026-10-02) against Meskerem 2019 at Main Branch: 38 visits (14 M, 24 F),
8 new, and 59 caries cases once Caries was linked, each figure matched by an independent SQL count.

**Found on the way, not yet fixed: `ethiopian-calendar-new` is a day early for the whole year after
an Ethiopian leap year** — all of 2016 E.C., and next all of 2020 E.C. (12 September 2027 to
10 September 2028). It puts Meskerem 1, 2016 on 11 September 2023 instead of the 12th. The return
uses `$lib/ethiopianCalendar.ts`, built on `Intl`'s Ethiopic calendar, instead. **`ethiopianRange`,
and through it every payroll period (`payrollPeriod`), still uses the library**, so payroll runs for
2020 E.C. would start and end a day early. Move them onto `ethiopianToIso` before September 2027.

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
| 8     | The diary's loose ends            | 3 + 1 column      | 1, 5             | small   |
| 9     | Monthly health report (HMIS)      | 1 column          | 1, 4             | medium  |

Stages 2 and 3 can run in parallel once Stage 1 has landed. Stage 4 only needs the tab split from
Stage 1, step 1.
