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

| Seam            | Owns                                                                                                                                                                          | Status            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `db/dialect.ts` | every SQL function that is not spelled identically on all three: current date, date arithmetic, date formatting, age, string concatenation, group concatenation, conditionals | **not built**     |
| `db/insert.ts`  | getting an id back from an insert — MySQL has `$returningId()`, the others use `RETURNING`                                                                                    | **not built**     |
| `db/index.ts`   | the driver and the connection                                                                                                                                                 | exists            |
| `dbErrors.ts`   | driver error codes. A duplicate key is `ER_DUP_ENTRY` on MySQL, `23505` on Postgres, `SQLITE_CONSTRAINT_UNIQUE` on SQLite. Never compare an errno inline                      | exists, 2 callers |
| `stock.ts`      | the on-hand subquery. Portable as written; it stays the one place that knows how stock is derived                                                                             | exists            |

Anticipated contents of `db/dialect.ts`, so the names are settled before anything is written:

```
today()                      CURDATE() / CURRENT_DATE / date('now')
nowExpr()                    NOW() / now() / datetime('now')
ageYears(col)                the worked example above
daysBetween(a, b)            DATEDIFF / (a - b) / julianday arithmetic
monthKey(col)                DATE_FORMAT(col,'%Y-%m') / to_char / strftime
addDays(col, n)              DATE_ADD / col + interval / date(col, '+n days')
concatWith(sep, ...parts)    CONCAT_WS / concat_ws / || with separators
fullName(...parts)           the employee/patient name fragment, once
groupConcat(col, sep)        GROUP_CONCAT / string_agg / group_concat
```

### Files

`server/files.ts` already owns the store: the directory, the accepted types, the size limit and
the safe path resolution (CLAUDE.md §9). The portability rule is the same rule stated for a
different reason — **nothing outside `files.ts` may touch `fs` or construct a path into the
store.** Moving to Cloudinary or Supabase Storage should then be a rewrite of `files.ts` and of
`routes/dashboard/files/[name]/+server.ts`, which stops streaming bytes and starts redirecting
to a signed URL.

What the seam must grow to absorb a remote store, since the current shape assumes local disk:

- `saveUploadedFile` already returns an opaque name — keep it opaque. A caller that parses the
  name, or joins it onto a directory, has made the store's layout part of the app.
- **`fileUrl(name)` does not exist and needs to**, because today the URL is built by hand as
  `/dashboard/files/${name}` at each call site. A remote store returns a different URL.
- **Deletion has no helper.** Whatever deletes a stored file should be `deleteStoredFile(name)`.
- `saveUploadedFile` is already `async`, which is the thing that matters — a remote store is a
  network call, and a synchronous signature would have to change everywhere.

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

### `src/routes` — 17 files

| File                                                            | Uses                                      |
| --------------------------------------------------------------- | ----------------------------------------- |
| `dashboard/+page.server.ts`                                     | `CURDATE`                                 |
| `dashboard/customers/+page.server.ts`                           | `DATEDIFF`, `DATE_FORMAT`                 |
| `dashboard/customers/[id]/+page.server.ts`                      | `DATEDIFF`, `DATE_FORMAT`                 |
| `dashboard/employees/+page.server.ts`                           | `CURDATE`, `DATE_FORMAT`, `TIMESTAMPDIFF` |
| `dashboard/employees/inactive/+page.server.ts`                  | `CURDATE`, `DATE_FORMAT`, `TIMESTAMPDIFF` |
| `dashboard/employees/attendance/[range]/+page.server.ts`        | `GROUP_CONCAT`                            |
| `dashboard/employees/single/[id]/+layout.server.ts`             | `CURDATE`, `DATE_FORMAT`, `TIMESTAMPDIFF` |
| `dashboard/employees/single/[id]/leave-history/+page.server.ts` | `DATEDIFF`                                |
| `dashboard/reports/scope.server.ts`                             | `DATE_ADD`, `DATE_FORMAT`                 |
| `dashboard/reports/details.server.ts`                           | `DATEDIFF`, `DATE_FORMAT`                 |
| `dashboard/reports/analytics/people.server.ts`                  | `CURDATE`, `DATEDIFF`                     |
| `dashboard/salary/add-deductions/[range]/+page.server.ts`       | `DATE_FORMAT`                             |
| `dashboard/salary/add-overtime/[range]/+page.server.ts`         | `DATE_FORMAT`                             |
| `dashboard/salary/add-payroll/[range]/+page.server.ts`          | `DATEDIFF`                                |
| `dashboard/supplies/[id]/+page.server.ts`                       | `DATE_FORMAT`                             |
| `dashboard/supplies/[id]/damaged/[range]/+page.server.ts`       | `DATE_FORMAT`                             |
| `dashboard/supplies/[id]/ranges/[range]/+page.server.ts`        | `DATE_FORMAT`                             |

Plus `CONCAT` in 8 route files — SQLite spells it `||` — of which 7 are the same hand-written
`TRIM(CONCAT(...))` full-name fragment that CLAUDE.md §2 already wants extracted. One extraction
settles both rules.

### `$returningId()` — MySQL-only, 14 files

`lib/server/leaveJob.ts`, `lib/server/stock.ts`, `lib/server/money.test.ts`, and 11 route files
under `dashboard/` (roles, leave-expiry-policy, customers, employees ×2, salary ×3, supplies ×3).
All of them want the same two lines of `db/insert.ts`.

### File storage — 3 files outside `files.ts`

| File                                       | What it does                       | Note                                                                                                                      |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `lib/server/fileAudit.ts`                  | reads the store directory directly | its whole purpose is auditing the store, so it is arguably the second legitimate owner — decide when a remote store lands |
| `routes/dashboard/backup/+server.ts`       | writes with `fs`                   | backup is genuinely about the filesystem; a remote store changes what a backup even means                                 |
| `routes/dashboard/files/[name]/+server.ts` | streams bytes off disk             | expected to change — becomes a redirect to a signed URL                                                                   |

Every hand-built `/dashboard/files/${name}` URL is also a caller of the `fileUrl()` that does not
exist yet.
