# Audit: every change to data, at a cost the box can pay

## The rule

> **A change to audited data is written through the audit chokepoint, which records it in the
> same transaction. Nothing writes audited data any other way.**

Two halves, and the second is what makes the first survive.

## Why it is a chokepoint and not a discipline

The obvious version of this rule is "everything that writes should also log". That version
decays, and this repo has already run the experiment twice:

- **`notDeleted()` holds completely** — 118 files, and zero inline `deletedAt` writes anywhere in
  `src/routes`.
- **`contentCrud` failed** — built, documented, adopted once, while 26 routes kept hand-rolled
  copies of what it does.

The difference is not diligence. Forgetting `notDeleted()` is _visible_: deleted rows appear on
screen and somebody reports it. Forgetting `contentCrud` is _invisible_: the page works.

Audit logging is the second kind, and worse. Omit it and nothing breaks, no test fails, no screen
looks wrong. The gap surfaces the day somebody asks who changed a price — which is the day it is
far too late to go back and add it. A rule that fails silently is a rule that is already broken
somewhere you have not looked.

So the rule is not "remember to log". It is **"write through the helper"**, which fails loudly
(the helper is how you write at all) and is checkable with one grep for `db.insert` /
`db.update` outside the sanctioned modules.

The helper is `recordAudit` in `audit.ts`. `childCrud` calls it for any section given an `audit`
table name, so a child section is audited by one line of configuration; a write that `childCrud`
does not cover calls it directly, in the write's own transaction — the patient pages are the first
consumers of both. 61 direct write call sites across 15 older route files still bypass it, and
those are pre-existing (see _Not done yet_).

## Why the row looks like this

Measured on this database at 200,000 rows, against the 128MB InnoDB buffer pool a 2GB box has:

| shape                                 | bytes/row | per year¹ | write 200k | read one record's history |
| ------------------------------------- | --------: | --------: | ---------: | ------------------------: |
| full `old_values` + `new_values` JSON |     5,474 |    783 MB |  26,620 ms |                  3,057 ms |
| changed fields only, one index        |       179 |     26 MB |   1,750 ms |                    1.2 ms |

¹ at 150,000 audited writes/year, a busy clinic.

Thirty times smaller, fifteen times faster to write, two thousand times faster to read.

**The buffer pool is the number that decides it, not the disk.** 783 MB/year written _through_
a 128 MB pool means every audited write evicts pages of live patient data to cache a copy of a
row that is still sitting in the table it came from. The clinic would pay for the audit log on
every unrelated query for the rest of the day. At 26 MB/year the whole log stays resident for
years.

So `changes` holds `{ field: [before, after] }` for the fields that actually moved — typically
two, not forty — and is null for a create or a delete, where the row itself is the whole story.

### One index, not five

`(table_name, record_id, id)` answers "what happened to this record" in 1.2 ms. The primary key
already answers "what happened lately" in 0.6 ms descending. Both questions covered.

Adding the four more the analytics page looks like it wants — user, timestamp, action, branch —
measured at **+75% storage and +40% write time**, to serve questions asked a few times a year
that can afford a scan. An append-only table is almost all writes; every index taxes all of them.

### `varchar`, not `mysqlEnum`

The closed list is real, but it is enforced in TypeScript rather than in DDL. Measured:
**identical read times, 36 bytes a row, 5 MB/year.** For that, an enum would cost a schema
migration every time a table joins the list, and enums are the single most divergent piece of
DDL across MySQL, Postgres and SQLite (CLAUDE.md §10). The cheap enforcement is the better one.

## What is audited

A closed list, because "audit everything" is how the log becomes too expensive to keep and too
noisy to read. It is encoded as a TypeScript union on the helper, so an unlisted table is a
compile error rather than a silent omission.

**Audited** — anything carrying patient data, money, or access:

- patient and its clinical children: `patient`, `patient_allergies`, `patient_conditions`,
  `patient_medications`, `patient_contacts`, `patient_emergency_contacts`, `patient_consent`,
  `patient_file`
- the clinical record: `clinical_note`, `procedures`, `prescription`, `prescription_item`,
  `treatment_plan`, `treatment_plan_item`, `lab_case`, `perio_exam`, `appointment`,
  `sterilisation_cycle` and `pack_use` (which instruments touched which patient), `ortho_case`,
  `ortho_visit` and `ortho_instalment` (an orthodontic plan and its billing)
- money: `invoice`, `invoice_line`, `invoice_payment`, `transactions`, `expenses`, `cash_session`,
  `payer_authorisation` (a payer's promise to pay for treatment), `purchase_order` and
  `supplier_invoice` (what was bought, what arrived, what the supplier was paid), `patient_deposit`,
  the pay adjustments `over_time`, `bonuses`, `deductions` and `attendance` — each changes what
  someone is paid
- controlled stock: `supplies_adjustments`, `supply_batch`, `damaged_supplies`
- who may do what: `user`, `roles`, `role_permissions`, `special_permissions`, `employee`
- credentials the clinic stores for other services: `sms_provider`, whose API key is encrypted in
  the table and redacted in the audit row by name (`api_key`), so the log says only that it changed

**Not audited** — high churn, no evidentiary value, and each row would cost the buffer pool the
same as a patient record:

- `job_run`, `backup`, `patient_access_log`, `audit_log` itself
- every lookup table (`allergen`, `condition`, `contact_types`, `appointment_type`, …). These are
  configuration, they change rarely, and they already carry `secureFields` — `updatedBy` and
  `updatedAt` on the row answer the same question without a second table.

## The rules that keep it cheap

1. **Same transaction as the change.** An audit row committed separately can disagree with the
   data, and a log that disagrees is worse than no log. Cost measured at **1.05 ms** per audited
   write, which is the price of the rule and is affordable.
2. **Bulk operations log the operation, not the row.** A payroll run over 400 employees writes
   _one_ audit row describing the run, not 400. This is the single rule most likely to be broken
   by accident, and breaking it is what turns 26 MB/year into 783 MB/year by another route.
3. **Never log a secret.** `changes` is a second copy of whatever it holds, in a table nobody
   watches and everybody can read. Redact, always: password hashes and anything from better-auth's
   `account` table, session tokens, `transactions.gateway_txn_token`, and any API key or
   credential. A redacted field records that it changed, never to what.
4. **Append-only.** No `secureFields`, no update path, no soft delete. Rows are inserted and then
   only ever read.
5. **Pruning is a delete by `id` range**, which is a sequential scan of the primary key and
   touches no other table. Not needed for years at 26 MB/year — the point is that it stays cheap
   whenever it is wanted.
6. **Reads are not audited here.** Who _looked_ at a patient is `patient_access_log`: a different
   question, a much higher volume, and its own table.

## Not done yet

- **Only the patient and appointment pages write through it so far.** `patient`, its five editable
  children and `appointment` are audited; the other tables on the list are audited when their
  screens are built or next touched. The closed `AuditedTable` union already names all of them.
- **Not audited yet on purpose: `patient_access_log` inserts**, which are reads, and the employee
  child sections, whose tables are not on the list.
- **61 direct write call sites** across 15 route files bypass every chokepoint. They predate this
  rule and are cleaned up when their feature is next touched, the same way the portability ledger
  works. The rule binds new code.
- The analytics page at `reports/analytics/system.server.ts` reads `audit_log`, and shows only
  patient changes until more writers arrive.
