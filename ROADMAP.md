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
| `treatment_plan`      | 🟡     | counted on the chart; no screen                                                                                     |
| `treatment_plan_item` | ⬜     | seed only                                                                                                           |
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
| `invoice`                                      | 🟡     | the chart totals it and `APPROVAL_ENTITIES` has an entry for it. **Nothing can raise one**, so the approval queue can never fill                    |
| `invoice_line`                                 | ⬜     | seed only                                                                                                                                           |
| `invoice_payment`                              | 🟡     | the chart sums it; no screen                                                                                                                        |
| `cash_session`                                 | ⬜     | no screen. `transactions.cashSessionId` is never set                                                                                                |
| `transactions`                                 | 🟡     | `/salary/transactions` lists them. There is no patient payment path; the only writers are expenses and payroll                                      |
| `payment_methods`, `vat_and_withhold`          | ✅     | admin panel                                                                                                                                         |
| `expenses`, `expenses_type`                    | ✅     | `/salary/transactions/expenses/**`, approvals                                                                                                       |
| `payroll_*`                                    | ✅     | `/salary/**`, approvals                                                                                                                             |
| `transaction_services`, `transaction_supplies` | 🗑     | from the ERP. `invoice_line` replaces them (see its schema comment). Four report consumers remain                                                   |
| `customers`, `customer_contacts`               | 🗑/✅  | screens work. In a clinic they are the **payer** (employer or insurer) that `invoice.customerId` points at, and they should be re-labelled that way |

### Stock

| Table                                          | Status | Gap                                                                                                                                                  |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supplies`, `supply_types`, `supply_suppliers` | ✅     |                                                                                                                                                      |
| `supplies_adjustments`, `damaged_supplies`     | ✅     | through `moveStock`                                                                                                                                  |
| `supply_batch`                                 | 🟡     | stock is derived from lots and consumed expiring-soonest-first, but **no screen lists lots or expiry dates**, and nothing warns before a lot expires |

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
- ~~**Services have no price.**~~ Done (migration 0028). `services` has `price`, `area` (what the
  chart asks for) and `removesTooth`, and the seed catalogue is priced in birr.
- ~~**The chart is near its size limit.**~~ Done. The chart is a layout with tabs; the overview's
  server file went from 584 lines to 402, and no chart file is over 402.
- **Reports have no clinical sections.** `reports/sections.ts` has 23 sections, all HR, payroll,
  stock or money. None covers production per dentist, case acceptance, recalls due, receivables or
  cash variance.
- **Type health.** `npm run check` reports 781 errors repo-wide. Per CLAUDE.md §3 this is a
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
2. **Stock lots:** record the expiry date when stock is received (the Change Quantity form has no
   field for it yet, so `tracksExpiry` is never enforced and lots are used oldest first), list lots
   with lot number and expiry on the supply page, add a near-expiry
   warning on the dashboard, and add a trace from a lot to the patients who received it.
3. **Clinical report sections**, as rows in `SECTIONS` rather than new routes: production per
   dentist, procedures by service, case acceptance, recalls due or missed, receivables aging, cash
   variance, lab turnaround.

### Stage 7: Pay down the ERP residue (runs alongside the others)

- Split the files over 500 lines listed in CLAUDE.md §6 when their feature is next touched.
- Migrate the remaining 59 forms onto `createForm` as each page is touched.
- Shrink the help and route-map backlogs as screens get their help.
- Drop the tables that Stage 0 and Stage 3 decided to retire.
- **Commission is never calculated.** An employee carries an office commission and a percentage,
  and the payslip has a commission column, but the run writes 0. The department flag that was
  labelled "Calculate Commission" only ever decided who counts as office staff, and is now labelled
  that way. Either calculate it or drop the fields.

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
