# Working in this codebase

A SvelteKit 5 + Drizzle/MySQL clinic management system, repurposed from a facilities-management
ERP. It holds patient data, so several rules below are correctness and safety rules wearing the
clothes of style rules. Each one says _why_, because a rule whose reason is missing is the first
one dropped under pressure.

---

## 1. Reuse before you build

**Before adding any component or server helper, check the catalog below.** If something close
exists, extend it with an optional prop that defaults to current behaviour. A new file is the
last resort, and when you make one, say which existing thing you considered and why it did not
fit.

### Never create `Thing2`

`DatePicker2.svelte` was created instead of editing `DatePicker.svelte`. The original now has
zero callers and sits there as a decoy. `MonthYearMul.svelte` is 64% copied from
`MonthYear.svelte` and serves exactly one caller. If the existing component cannot do the new
thing, give it a new optional prop — do not fork it and leave the old one behind.

### Catalog — client

| Need                                | Use                                                          | Current users |
| ----------------------------------- | ------------------------------------------------------------ | ------------- |
| A table                             | `components/Table/data-table.svelte`                         | 85            |
| Server-driven filter bar            | `$lib/QueryBuilder.svelte` + `$lib/queryFilters.ts`          | 17            |
| Client-side facets over loaded rows | `components/Table/FilterMenu.svelte`                         | 41            |
| Sortable header                     | `Table/data-table-sort.svelte`                               | 89            |
| Link cell                           | `Table/data-table-links.svelte`                              | 71            |
| Status badge                        | `Table/statuses.svelte`                                      | 56            |
| Long text cell                      | `Table/bigText.svelte` · address cell `Table/address.svelte` | 8 · 4         |
| Any form field                      | `formComponents/InputComp.svelte`                            | 153           |
| Modal                               | `formComponents/DialogComp.svelte`                           | 135           |
| Form error summary                  | `formComponents/Errors.svelte`                               | 133           |
| Submit spinner                      | `formComponents/LoadingBtn.svelte`                           | 169           |
| Form shell · flash line             | `FormCard.svelte` · `Messages.svelte`                        | 22 · 12       |
| Ethiopian month/year picker         | `formComponents/MonthYear.svelte`                            | 26            |
| Delete confirmation                 | `components/DeleteEntity.svelte`                             | 48            |
| Detail page shell · key/value table | `SingleView.svelte` · `SingleTable.svelte`                   | 8 · 8         |
| A whole admin-panel lookup screen   | `components/lookup/LookupPage.svelte`                        | 13            |
| One child table on a detail page    | `components/lookup/LookupSection.svelte`                     | new           |

`InputComp` dispatches on `type` to file, select, date, combo, checkbox and password variants.
**Most fields need nothing but `InputComp`** — reach for `SelectComp`/`ComboboxComp`/
`FileUpload` directly only when you need something `InputComp` does not pass through.

UI primitives are shadcn-svelte under `components/ui/` (34 of them). Check there before writing
any button, dialog, popover, or menu.

### Catalog — server

| Need                               | Use                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Lookup-table CRUD                  | `contentCrud` — `server/crud.ts`                                                            |
| CRUD for rows owned by a parent    | `childCrud` — `server/childCrud.ts`                                                         |
| List filtering + pagination        | `parseTableQuery` / `buildWhere` / `pagination` / `currentQuery` — `server/queryFilters.ts` |
| Exclude deleted rows               | `notDeleted()` — `server/softDelete.ts` (118 files)                                         |
| Cascading delete                   | the `softDelete*` family — `server/softDelete.ts`                                           |
| Delete action on a lookup page     | `lookupDeleteAction` — `server/lookupDelete.ts`                                             |
| Authorization                      | `requireSuperAdmin` · `syncAdminRole` — `server/permissions.ts`                             |
| Permission check in an action      | `requirePermission` · `hasPermission` — `server/permissions.ts`                             |
| Reading a MySQL error code         | `isDuplicateKey` · `mysqlErrorCode` — `server/dbErrors.ts`                                  |
| The permission list and admin role | `seedPermissions` — `server/seedPermissions.ts`, run by `/setup`                            |
| Dropdown option lists              | `server/fastData.ts` (50 files)                                                             |
| Anything about stored files        | `server/files.ts` — `saveUploadedFile`, `resolveStoredFile`, `mimeFor`, `MAX_UPLOAD_BYTES`  |
| Formatting money / Ethiopian dates | `formatETB`, `formatEthiopianDate` — `lib/global.svelte.ts`                                 |
| The URL of a stored file           | `fileUrl` — `lib/global.svelte.ts` (client-safe; `server/files.ts` owns the bytes)          |

### Add a row, not a route

Four registries already exist. Extending one is almost always correct, and writing a parallel
route is almost always wrong:

- **`APPROVAL_ENTITIES`** (`server/approvals.ts`) — a new maker-checker queue is one object.
  `/dashboard/approvals/[entity]` serves all of them; there is no per-entity route.
- **`SECTIONS`** (`reports/sections.ts`) + `columnsFor` + a `loadSection` case — a new report
  section needs no new route or component.
- **`routeRules`** (`lib/routeAccess.ts`) — a route's permission gate.
- **`Search.svelte`** — the command palette.

---

## 2. Do not repeat

**The second copy triggers extraction. Not the third.**

Waiting for a third copy is how this repo ended up with three byte-identical 227-line
`edit.svelte` files under `employees/leaves/`, a contracts triplet that is 99% identical across
1,562 lines, and two payroll range pages sharing 581 of 586 lines. It is not a hypothetical
cost: the `cancelled` leave page still renders `status === 'pending' ? 'Pending' : 'Approved'`
on a page that queries `status = 'rejected'`, because the fix landed in one copy and not the
others.

- **Prefer one parameterised route over N near-identical ones.** `/dashboard/approvals/[entity]`
  is the model. The contracts triplet is the counter-model.
- **A shared helper is not finished until the duplicates it replaces are migrated onto it.**
  `contentCrud` was built, documented, and adopted exactly once while 26 admin-panel routes kept
  their hand-rolled copies. Building the abstraction is half the job.
- **Repeated SQL gets a named helper.** The employee full-name `TRIM(CONCAT(...))` fragment is
  hand-written in 28 files.

### The name-and-description CRUD page is the worst case

Eighteen admin-panel routes are the same screen: a table of rows with a name, a description and
a status, plus an add dialog and an edit dialog. They were written out eighteen times.

The measurements, after the servers were already collapsed onto `contentCrud`:

- `educational-level/edit.svelte` and `employment-status/edit.svelte` are **byte-identical**.
- Their `+page.svelte` files are **96% identical**; the entire difference is an entity label and
  two extra fields.
- Across the eight simplest routes, `+page.svelte` pairs run **71–96%** identical and
  `edit.svelte` pairs **85–100%**.
- Total: **5,103 lines** of client code for what is one screen.

A lookup screen differs from another lookup screen in exactly three things: **the table, the
label, and the field list.** All three are data, so all three live in a `LookupConfig`.

**This is built.** `contentCrud` on the server, `components/lookup/` on the client. Thirteen
routes are migrated, foreign keys included: **5,152 lines became 708**, plus 526 shared.

A new lookup table is a `LookupConfig` and a twenty-line server file. **Never write another by
hand.**

- A foreign key is a `reference` field plus a matching `references` entry on `contentCrud` —
  that one entry joins the table for the list _and_ loads the picker's options.
- Something the descriptor cannot express goes in `extraColumns`. Reach for it twice for the
  same shape and it should have been a field type instead.
- To extend: add an optional property to `LookupField`, honour it in `LookupFields.svelte`
  (form), `columns.ts` (table) and `contentCrud` (data). Default it to today's behaviour and
  every existing config keeps working.

Four screens stay hand-written on purpose, and the reason is the counterweight below rather
than neglect: `payment-methods` shows an attribution join that needs both id and name and must
_not_ filter deleted users (§9); `bank-amounts`, `supply-types`, `roles` and `users` are not
lookup tables at all.

**Counterweight:** duplication is cheaper than the wrong abstraction. If the second copy differs
in more than its inputs, keep them separate and write down why. The rule is about copies that
are genuinely the same thing, which is what all the examples above are.

---

## 3. Types

- **No new explicit `any`.** Use `unknown` and narrow. `catch (err: unknown)`, never
  `catch (err: any)`.
- **No laundering.** `as`, non-null `!`, and `@ts-ignore` are the same sin as `any` — they just
  hide it better. `@ts-expect-error` with a written reason is the only accepted escape, and it
  should be rare enough to notice.
- **Every TanStack column array is typed `ColumnDef<Row>[]`.** Without it, every
  `cell: ({ row })` and `header: ({ column })` destructure is implicitly `any`. This single
  omission accounts for the majority of the repo's type errors.
- **When `any` is genuinely forced, name it and explain it.** `crud.ts`'s
  `AnyTable = MySqlTable & Record<string, any>` is legitimate — Drizzle does not expose columns
  via an index signature, and `contentCrud` is generic over arbitrary tables. That is a named
  alias with a comment, not an inline `any`.
- **Files you touch must be clean.** `npm run check` at repo level is still noisy; per-file
  clean is the gate, repo-wide zero is the direction.

---

## 4. Svelte 5 only

Runes only: `$props`, `$state`, `$derived`, `$effect`, `$bindable`.

Never: `export let`, `$:`, `on:click`-style directives, `createEventDispatcher`, `<slot>`,
`<svelte:component>`, `beforeUpdate`/`afterUpdate`, `<script context="module">` (use
`<script module>`).

The codebase is already fully compliant — 543 components, zero legacy API usage — so there is no
excuse for reintroducing any of it.

**`$derived`, not a plain `let`, for anything computed from `data` or another rune.**
`let total = data.rows.length` silently captures the initial value and never updates. This is a
correctness bug, not a style preference, and it is the one Svelte 5 mistake that is actually
live in this repo.

---

## 5. Comments

The existing standard in `src/lib/server/` is the target: prose, 18–27% density, explaining the
reasoning rather than the mechanics.

- **Explain why, not what.** `server/queryFilters.ts` is the model — it states the invariant it
  owns, the history that forced it, a usage example, and its deliberate non-goals.
- **Every exported symbol gets a doc comment.** Every module gets a header saying what it owns.
- **Cite the bug.** When a line exists because something broke, say so. The note in
  `secureFields.ts` explaining why `deletedAt` cannot double as `isActive` is why nobody has
  re-merged them.
- **Write the non-goals.** Saying what a module deliberately does _not_ do is what stops the
  next person bolting it on.
- Comments that restate the code are worse than none — they rot silently and then lie.

---

## 6. Componentization and file size

A rule, not a preference. Extract when markup is **used twice**, exceeds **~150 lines**, or
**mixes two concerns**.

**Hard ceiling: 500 lines.** Past that, a file gets split — nobody holds 500 lines in their head,
and every merge in one is a conflict.

Two qualifications, so this rule does not fight the others:

- **Count code, not lines.** `server/softDelete.ts` is 711 lines and 27% comments — roughly 514
  lines of code. Penalising the best-documented file in the repo would just teach people to
  delete comments, which rule 5 exists to prevent.
- **Declarative data and schema are exempt.** `lib/help/content.ts` (2,241) is the manual's
  content and `db/schema/staff.ts` (639) is table definitions. Split them when a _section_ earns
  its own file, not because a line count says so.

Everything else over 500 is a real target. Current offenders:
`reports/details.server.ts` (1,518), `employees/single/[id]/+page.server.ts` (1,281),
`app-sidebar.svelte` (639), `salary/add-payroll/**/+page.server.ts` (588/586),
`employees/single/[id]/+page.svelte` (555), `Table/FilterMenu.svelte` (548),
`QueryBuilder.svelte` (534).

---

## 7. Icons and styling

- **Every icon comes from `@lucide/svelte`. Never a hand-written `<svg>`.** The codebase is
  already at zero inline SVG across 344 files that import Lucide — there is no reason to be the
  first. Prefer the deep import (`@lucide/svelte/icons/pencil`) over the barrel; it tree-shakes.
- **UI is shadcn-svelte + Tailwind.** 34 primitives live in `components/ui/`. Check there before
  writing a button, dialog, popover, menu, or table.
- **CSS only when Tailwind genuinely cannot express it.** In practice that means two things, and
  the seven `<style>` blocks left in the repo are all one of them:
  - **print styles** — `@page`, `@media print`, page-break rules (`IdCard`, `Receipt`, `pdf`)
  - **`@keyframes`** — though `tw-animate-css` is already a dependency and usually covers it

  An inline `style=""` attribute is for a computed value only (a width from data), never for
  styling that could be a class.

---

## 8. Dependencies

Eleven runtime dependencies, all used. That is a good position — defend it.

- **Check what is installed first.** `chart.js`, `jspdf` + `jspdf-autotable`, `papaparse`,
  `pluralize`, `browser-image-compression`, `ethiopian-calendar-new`, `nodemailer`, `mysql2`
  are already here.
- **Adopt a package** when the problem has a long tail of correctness edge cases you would get
  wrong in-house: dates and timezones, PDF generation, cryptography, i18n, image formats.
- **Build in-house** when it is a thin wrapper over something you already have.
- Adding a dependency states, in the commit message, what it replaces and why in-house lost.

---

## 9. Domain invariants

Not style. These carry patient data.

- **Server-side authorization is the only authorization.** Hiding a button is UX; the check on
  the form action is the control, because the action is reachable by anyone who can POST to it.
  Every delete action calls `requireSuperAdmin`.
- **`/dashboard` is closed by default.** A path no `routeRules` entry claims is refused, with a
  message that says _no rule is defined_ rather than _you lack the permission_ — the two failures
  have different audiences, and only the first tells you the rule was never written. This used to
  be default-allow, and with 96 pages against 22 rules that meant a new clinical route was
  readable by every account until somebody remembered to gate it, with nothing reporting the
  omission. A page that genuinely needs no permission declares `permission: null` and says why;
  four do. `routeAccess.test.ts` walks `src/routes/dashboard` and fails on the first page without
  a rule, so the omission is caught by whoever adds the page rather than by whoever clicks it.
  Form actions are POSTs to the same path, so the page's rule gates its writes too — but one
  prefix means one permission, so it cannot yet separate reading a record from changing it.
- **A new gated route brings its permission with it.** If no existing permission fits, the route
  is not finished until the permission exists: a `routeRules` entry (which is what
  `permissionNames()` derives from, so the row seeds itself) _and_ a `DESCRIPTIONS` entry in
  `seedPermissions.ts`, because without one the admin panel offers `patients.record` to the person
  deciding whether to grant it. Both are guarded by tests that name what is missing. Never invent
  a permission string anywhere else — §9 already says they live only in `lib/routeAccess.ts`, and
  a string that is not in that file is a gate nobody can open.
- **Enforce on the action, not only on the load.** The route gate matches on path and nothing
  else, which makes it the floor: it stops someone reaching the page at all. Any action that does
  more than the page it sits on — settling an approval on a page anyone may read, voiding an
  invoice, changing a price — calls `requirePermission(locals, '…')` or `requireSuperAdmin` in the
  action body. A hidden button is not a check; the action is reachable by anyone who can POST to
  the path. `hasPermission` is the same test when you need a boolean to decide something rather
  than to refuse.
- **Never trust a client-submitted privileged field.** Anything the server must decide —
  `createdBy`, `approvedBy`, a status, a price — is set server-side. That is what `contentCrud`'s
  `transform` hook exists for.
- **Every read filters `notDeleted()`**, placed in the `on` clause of a join rather than the
  `where`, so a deleted row on one side does not silently drop the whole record. Do not filter
  attribution joins (`createdBy`/`updatedBy`/`approvedBy`) — a deleted user still authored the
  thing.
- **Money is `decimal` with `mode: 'number'`.** Never float. Without the mode Drizzle hands back
  strings, and your arithmetic silently becomes string concatenation.
- **`datetime`, not `timestamp`,** for anything that must not timezone-shift or hit the 2038
  ceiling.
- **Permission strings live only in `lib/routeAccess.ts`.** They are also rows in the
  `permissions` table — renaming one is a data migration, so get it right the first time.
- **Errors: loud in the server log, quiet to the client.** Sign-in and password reset must give
  the same answer for an unknown account and a wrong password, or they become
  account-enumeration oracles.
- **Soft delete, always.** `deletedAt` is the delete marker; `isActive`/`status` are business
  state that pages deliberately list. They are not interchangeable.
- **Stored files go through `server/files.ts`.** It owns the directory, the accepted types, the
  size limit and the safe path resolution. Never join a user-supplied name onto `FILES_DIR`
  yourself — `path.normalize` resolves `..` rather than rejecting it, so `resolveStoredFile` does
  the containment check that stops a name climbing out of the store.
- **A file URL is not a permission.** `/dashboard/files/[name]` can only check that the caller is
  signed in; the store is flat and a filename records nothing about what it is attached to. The
  122-bit random name is what stands in for a check. That is adequate against guessing and
  inadequate against a leaked URL, so do not treat these URLs as shareable secrets — and see
  `fileAudit.ts` for why a `files` table is the next piece of work here.

> Soft delete is the proof the approach works: `notDeleted()` in 118 files, `lookupDeleteAction`
> in 19, and zero inline `deletedAt` writes anywhere in `src/routes`. When the helper exists and
> gets adopted, the discipline holds completely.

---

## 10. Portability

The app must install on cPanel/MariaDB (today, and most deployments), on an old computer or VPS
running **SQLite in WAL mode**, and on Vercel against **Postgres** (Supabase/Neon). Drizzle was
chosen for this. It makes portability possible; it does not deliver it on its own.

**The rule: anything Drizzle does not spell the same way on all three engines lives behind a
function in `src/lib/server/db/`, and routes call the function.** Age is the worked example —
`ageYears(patient.birthDate)` is four lines to change on a port; `TIMESTAMPDIFF(...)` written
inline at every call site is a sweep where the one you miss returns wrong ages instead of an
error. Same rule for dates, date formatting, string concatenation, `GROUP_CONCAT`, and getting
an id back from an insert (`$returningId()` is MySQL-only).

**Same rule for stored files.** `server/files.ts` is the only module that may touch `fs` or build
a path into the store — already required by §9 for safety — and **`fileUrl(name)` is the only
place the served URL is spelled**, which is why it lives in the client-safe
`lib/global.svelte.ts` rather than beside the bytes. Treat the stored name as opaque: never parse
it, never join it onto a directory, never write the `/dashboard/files/…` path by hand. Together
they make a move to Cloudinary or Supabase Storage a rewrite of `files.ts` and one route.

**Where the seam cannot be built** — a query whose _shape_ differs, not just its function names —
write it inline and **record it in `src/lib/server/PORTABILITY.md`**, which carries the rule in
full, the seam inventory, the behaviour differences that no function can hide (collation and
therefore search is the sharp one), and the ledger of what currently leaks.

The schema is exempt: a dialect change rewrites it by definition. `mysqlEnum`, `datetime`, the
`live_key` generated columns and the `REGEXP` check constraint are documented in PORTABILITY.md
rather than treated as debt.

**The existing violations stay.** Seventeen route files and fourteen `$returningId()` call sites
predate this rule and are listed in the ledger. They get cleaned up when their feature is next
touched. The rule binds new code.

---

## 11. Audit

**A change to audited data goes through the audit chokepoint, which records it in the same
transaction. Nothing writes audited data any other way.**

Stated as "everything that writes should also log," this rule would decay, and the repo has
already proved how: `notDeleted()` holds in 118 files because forgetting it is _visible_ —
deleted rows show up on screen. `contentCrud` was adopted once against 26 hand-rolled copies
because forgetting it is _invisible_. Audit is the second kind and worse: omit it and nothing
breaks until the day somebody asks who changed a price, which is the day it is too late. So the
rule is **write through the helper** — which fails loudly, and greps for in one line.

**Log the delta, never the row.** Measured here at 200,000 rows against a 128MB buffer pool:
full `old_values`/`new_values` snapshots cost 5,474 bytes/row and 783 MB/year; changed fields
only cost 179 bytes/row and 26 MB/year. The pool is what decides it — 783 MB/year written
through 128 MB evicts live patient data to cache a copy of a row that is still in the table it
came from. `changes` is `{ field: [before, after] }` for the fields that moved.

**Bulk operations log the operation, not the row.** A payroll run over 400 employees writes one
audit row, not 400. This is the rule most easily broken by accident and the one that undoes the
delta saving.

**Never log a secret** — password hashes, session tokens, `gateway_txn_token`, any credential. An
audit row is a second place to leak from and nothing watches it. Record that the field changed,
never to what.

**Audited is a closed list**, enforced as a TypeScript union so an unlisted table is a compile
error: patient data, clinical records, money, controlled stock, and who-may-do-what. Lookup
tables are not audited — they already carry `updatedBy`/`updatedAt` via `secureFields`, which
answers the same question without a second table. `patient_access_log` covers reads and is a
separate concern.

`src/lib/server/AUDIT.md` carries the measurements, the full audited/not-audited lists, the
redaction list, and why the table has one index rather than five.

---

## 12. Definition of done

- `npm run check` clean **for the files you touched**
- `npm run lint` clean for the files you touched
- `node scripts/check-budget.mjs` passes — the repo-wide type and lint counts must not rise.
  Lower a budget in the same commit that earns it; raising one needs a reason in the message.
- `npx prettier --write` on touched files
- `npm run test` passes
- new shared code has a doc comment
- no new dependency without justification

**Tests where the logic is subtle, not everywhere.** The existing suite has the right instinct —
leave accrual, the leave ledger, approvals, `routeAccess`. Known gap worth closing when you are
nearby: `crud.ts`, `softDelete.ts` and `permissions.ts` are the highest-leverage infrastructure
in the repo and have no tests at all.

---

## Commands

```bash
npm run dev          # dev server — a fresh install redirects /login to /setup
npm run db:migrate   # apply the schema; /setup then seeds permissions and the first admin
node scripts/check-budget.mjs   # what CI gates on — type and lint counts must not rise
npm run check        # svelte-check — the real signal
npm run lint         # prettier --check + eslint
npm run test         # vitest, both projects (browser + node)
npm run db:push      # push schema (safe while the DB has no production data)
npm run db:studio    # drizzle studio
```
