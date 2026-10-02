# Portability: one app, three databases, two file stores

## Why this file exists

The app has to install on four kinds of host, and they do not agree on what a database is:

| Host                        | Database                   | Status                      |
| --------------------------- | -------------------------- | --------------------------- |
| cPanel shared hosting       | MariaDB / MySQL            | today, and most deployments |
| an old computer in a clinic | SQLite (WAL)               | planned                     |
| a VPS                       | SQLite (WAL) or MySQL      | planned                     |
| Vercel                      | Postgres (Supabase / Neon) | planned                     |

Drizzle was chosen for exactly this. It is not a promise that the code is portable — it is a
promise that it _can be_, if the parts that differ are kept in one place.

**Scope: new deployments, not data migration.** This is about standing the app up on an empty
database with its seeds, on a host that runs something other than MariaDB. Moving a clinic's
live data between engines is a separate problem and this file does not address it.

## The rule

> **Anything Drizzle does not spell the same way on MySQL, Postgres and SQLite lives behind a
> function, and that function lives in `src/lib/server/db/`. Routes call the function.**

A dialect change should then be: the schema (which is expected to change), `drizzle.config.ts`,
`db/index.ts`, and the seam modules. Nothing else.

The worked example is age. `TIMESTAMPDIFF(YEAR, birth_date, CURDATE())` is MySQL; Postgres wants
`EXTRACT(YEAR FROM AGE(birth_date))`; SQLite wants string arithmetic on `strftime`. Written
inline it is a find-and-replace across every screen that shows a patient's age, and the one that
gets missed returns wrong ages rather than an error. Written as `ageYears(patient.birthDate)` it
is four lines in one file.

**What is exempt.** The schema under `db/schema/` is exempt — a dialect change rewrites it by
definition, and pretending otherwise would mean a column-type abstraction that buys nothing. So
`mysqlEnum`, `datetime`, `decimal`, the `live_key` generated columns and the `REGEXP` check
constraint are not violations. They are listed under _Known dialect-specific schema_ below so
whoever ports knows what to look for, not as debt.

**When the seam cannot be built.** Some things genuinely cannot be hidden — a query whose shape
differs, not just its function names. Those are not forced into an abstraction that lies about
them. They are written inline **and added to the ledger at the bottom of this file**, so a port
starts from a list instead of a grep.

## The seams

### Database

| Seam                                 | Owns                                                                                                                                                                                                                                                  | Status                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `db/dialect.ts`                      | every SQL expression the three engines spell differently — `today`, `nowExpr`, `yearsSince`, `daysBetween`, `isoDate`, `monthKey`, `addDays`, `addMinutes`, `concatWith`, `groupConcat`, `storedInstant`, and `jsonValue` for reading a `json` column | **built**; first consumer is the employees list                                           |
| `db/insert.ts`                       | getting an id back from an insert — MySQL has `$returningId()`, the others use `RETURNING`                                                                                                                                                            | **built** — `insertReturningId`; first consumers are `childCrud` and patient registration |
| `db/index.ts`                        | the driver and the connection                                                                                                                                                                                                                         | exists                                                                                    |
| `dbErrors.ts`                        | driver error codes. A duplicate key is `ER_DUP_ENTRY` on MySQL, `23505` on Postgres, `SQLITE_CONSTRAINT_UNIQUE` on SQLite. Never compare an errno inline                                                                                              | exists, 2 callers                                                                         |
| `stock.ts`                           | the on-hand subquery. Portable as written; it stays the one place that knows how stock is derived                                                                                                                                                     | exists                                                                                    |
| `lib/global.svelte.ts` → `fileUrl()` | the URL that serves a stored file                                                                                                                                                                                                                     | **built**, 28 call sites migrated                                                         |

`db/dialect.ts` exists now. Every body in it is still MariaDB — that is the point: the port is a
file rather than a search. Adding to it is how a new dialect-specific expression enters the app.

### Files

`server/files.ts` owns the bytes: the directory, the accepted types, the size limit and the safe
path resolution (CLAUDE.md §9). The portability rule is the same rule stated for a different
reason — **nothing outside `files.ts` may touch `fs` or construct a path into the store.**

`fileUrl(name)` in `lib/global.svelte.ts` owns the _URL_, and is the half that was missing: the
path was hand-built as `/dashboard/files/${name}` in 28 places. It lives in the client-safe
module rather than in `files.ts` because almost every caller is a component — an `img src` or an
`href` evaluated in the browser — and `files.ts` imports `node:fs`, so the client cannot see it.

Between them, a move to Cloudinary or Supabase Storage is a rewrite of `files.ts` and of
`routes/dashboard/files/[name]/+server.ts`, which stops streaming bytes and starts redirecting.
**That holds even if the new store needs signed URLs**, because `fileUrl()` keeps returning an
app-relative path and the redirect does the signing. It changes only if the URLs turn out to be
public, in which case it returns them directly and saves a hop.

Two further rules, so the seam does not leak back open:

- **The stored name is opaque.** `saveUploadedFile` returns it; nothing may parse it, split it or
  join it onto a directory. The one exception is `mimeFor`, which reads the extension and is
  inside the seam.
- **Deletion, when it is built, goes through `files.ts`.** There is no `deleteStoredFile` today
  and deliberately so: nothing in the app has ever deleted a stored file — see `fileAudit.ts`,
  where replacing an attachment abandons the old one and the store only grows. A helper with zero
  callers is the `Thing2` that CLAUDE.md §1 forbids. This is a note for whoever writes the
  cleanup, not a gap.

## Things that will bite, that no function can hide

These are not leaks to be fixed; they are behaviour differences to know about before a port.

1. **Collation, and therefore search.** MySQL's `utf8mb4_unicode_ci` is case-insensitive, so
   every `LIKE '%…%'` filter and every unique-name index in this app is case-insensitive today.
   Postgres is case-**sensitive** by default (`ILIKE` and `citext` are the answers) and SQLite's
   `NOCASE` is ASCII-only. Two patients called "Abebe" and "abebe" are one name on MariaDB and
   two on Postgres. This affects behaviour, not compilation, so nothing will report it.
2. **Money.** `decimal … mode: 'number'` is the invariant (CLAUDE.md §9). Postgres `numeric`
   also hands back strings without the mode; SQLite has no decimal type at all and will need a
   deliberate decision — integer minor units is the usual one, and it is a schema change with an
   arithmetic change behind it. `money.test.ts` guards the current rule and should be kept
   pointed at whatever the new one is.
3. **SQLite has one writer.** WAL gives concurrent readers, not concurrent writers. Long
   transactions — a bulk import, a payroll run — become `SQLITE_BUSY` for everyone else. This is
   fine for one clinic on one machine, which is exactly the case SQLite is for.
4. **Migrations are per dialect.** Three engines means three generated migration folders and
   three `drizzle.config` targets, not one set of SQL that runs everywhere. The hand-applied
   cPanel workflow (generate, upload to phpMyAdmin) only ever concerns the MySQL folder.
5. **better-auth** takes the dialect as a `provider` on its `drizzleAdapter`, and generates its
   own tables per dialect. One config line, but its schema is not ours to hand-write.
6. **Seeds must go through the seams too.** `seedPermissions.ts` and the twelve seed functions
   beside it are what makes an empty database usable, so they are part of every new deployment
   by definition. A seed that reaches for `$returningId()` directly is as much a blocker as a
   route that does.
7. **JSON is not one type.** MySQL returns a `json` column parsed; MariaDB stores it as text and
   returns the string; SQLite has no JSON type. Read one through `jsonValue` (`db/dialect.ts`).
   This already differs between the two engines the app runs on today: the treatment plan history
   read as empty on MariaDB until it went through the helper.
8. **Identifiers stop at 64 characters on MySQL/MariaDB.** Drizzle names a foreign key after both
   tables and both columns, which can pass that. The migration then fails partway, with the table
   already created, and `drizzle-kit migrate` said nothing. Name long keys by hand with
   `foreignKey({ name })`, as `treatment_plan_adjustment` does.

## Known dialect-specific schema

Not debt. Listed so a port knows where to look.

- `mysqlEnum` — 25 schema files. Postgres has native enums with different DDL; SQLite has none
  and wants a `CHECK … IN (…)`.
- **`live_key` generated columns** — `allergies.ts`, `conditions.ts`, `medications.ts`,
  `providers.ts`. This is a MySQL workaround for a missing feature: a `GENERATED … VIRTUAL`
  column plus a unique index, standing in for the partial unique index MySQL lacks. Postgres and
  SQLite both have `CREATE UNIQUE INDEX … WHERE deleted_at IS NULL` natively, so on those two
  the column disappears and the rule gets simpler.
- **`REGEXP` in a CHECK constraint** — `procedures.surfaces`. Postgres has `~`; SQLite has no
  regex without a loadable extension and needs a different check or none.
- `datetime` over `timestamp` — a MySQL-specific choice (§9), and the reasoning does not carry
  to Postgres, where `timestamptz` is the right answer.

---

## Ledger: dialect-specific SQL currently outside the seams

Every file below writes MySQL SQL in a `sql``` template. **This is the migration checklist.**

A line is removed from this list when the file is moved onto `db/dialect.ts`, not when it is
merely tidied. A new line is added only when the seam genuinely cannot express the query — and
the entry says why, because "I was in a hurry" is how a ledger becomes fiction.

> **These files are not to be changed as part of adopting this rule.** They predate it, they
> work, and they will be cleaned up when their feature is next touched. The rule binds new code.

### `src/routes` — 10 files

Six left this list when the database's clock moved to UTC (`db/connection.ts`): an inline
`CURDATE()` became wrong for three hours after midnight, so every one was moved onto `today()`,
`yearsSince`, `daysBetween` and `isoDate`. There is no `CURDATE` anywhere in `src/routes` now, and
there must not be one again.

| File                                                            | Uses                      |
| --------------------------------------------------------------- | ------------------------- |
| `dashboard/employees/attendance/[range]/+page.server.ts`        | `GROUP_CONCAT`            |
| `dashboard/employees/single/[id]/leave-history/+page.server.ts` | `DATEDIFF`                |
| `dashboard/reports/scope.server.ts`                             | `DATE_ADD`, `DATE_FORMAT` |
| `dashboard/reports/details.server.ts`                           | `DATEDIFF`, `DATE_FORMAT` |
| `dashboard/salary/add-deductions/[range]/+page.server.ts`       | `DATE_FORMAT`             |
| `dashboard/salary/add-overtime/[range]/+page.server.ts`         | `DATE_FORMAT`             |
| `lib/server/payrollRun.ts` (moved from `add-payroll/[range]`)   | `DATEDIFF`                |
| `dashboard/supplies/[id]/+page.server.ts`                       | `DATE_FORMAT`             |
| `dashboard/supplies/[id]/damaged/[range]/+page.server.ts`       | `DATE_FORMAT`             |
| `dashboard/supplies/[id]/ranges/[range]/+page.server.ts`        | `DATE_FORMAT`             |

Plus `CONCAT` in 8 route files — SQLite spells it `||` — of which 7 are the same hand-written
`TRIM(CONCAT(...))` full-name fragment that CLAUDE.md §2 already wants extracted. One extraction
settles both rules.

### `$returningId()` — MySQL-only, 14 files

`lib/server/leaveJob.ts`, `lib/server/stock.ts`, `lib/server/money.test.ts`, and 11 route files
under `dashboard/` (roles, leave-expiry-policy, customers, employees ×2, salary ×3, supplies ×3).
All of them want `insertReturningId` from `db/insert.ts`, which now exists; new code uses it.

### File storage — 3 files outside the seam

| File                                       | What it does                       | Note                                                                                                                      |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `lib/server/fileAudit.ts`                  | reads the store directory directly | its whole purpose is auditing the store, so it is arguably the second legitimate owner — decide when a remote store lands |
| `routes/dashboard/backup/+server.ts`       | writes with `fs`                   | backup is genuinely about the filesystem; a remote store changes what a backup even means                                 |
| `routes/dashboard/files/[name]/+server.ts` | streams bytes off disk             | expected to change — becomes a redirect to a signed URL                                                                   |

Hand-built file URLs are **no longer on this list**: all 28 were migrated onto `fileUrl()` when
the rule landed. The two mentions left in the tree are prose — `lib/help/content.ts` documents
the route to users, and `db/schema/patientFiles.ts` cites it in a comment.
