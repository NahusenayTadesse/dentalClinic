# Bug Report

Found via a manual audit cross-referenced with `svelte-check` (2,390 flagged diagnostics total, most of which are type-strictness noise from an aging Zod/Valibot-adjacent schema setup). Every bug below was verified by reading the actual source and, where relevant, confirmed against `git diff` to rule out anything introduced by the recent dialog-to-`DialogComp` refactor — none of these were.

Severity legend:

- 🔴 **Critical** — data loss/corruption, or a core feature is completely broken for every user
- 🟠 **Urgent** — real functional bug, narrower blast radius or only hits on certain inputs
- 🟡 **Semi-urgent** — correctness issue that hasn't bitten anyone yet, or blind spot in type safety
- ⚪ **Annoying, not harmful** — dead code / clutter / cosmetic noise

Items marked **✅ FIXED** below have been patched and re-verified with `svelte-check` (zero errors remaining on the touched lines) and `prettier`.

---

## ✅ Fixed so far (pass 1 — import errors + icon mismatches)

- **#4** — `Save` icon import added to both supplier edit dialogs
- **#5 / #6** — `columns` and `bankList` wired up in `sites/[id]/payments/add.svelte` (note: this file turned out to be dead code, unreferenced anywhere — see updated #5 note below)
- **#8** — `fly` imported in `supplies/[id]/+page.svelte`
- **#9 / #20** — `downloadAllPDF` now uses the same dynamic `import()` pattern as the working single-invoice function; the misleading commented-out static imports are gone
- **#10** — `siteContacts` added to the schema import in all three contracts server files
- **#13** — every broken/missing type-only import fixed: `EditContract` typo'd as `EditContact` in 5 files, entirely missing in 2 more, plus the same typo found (during fixing) in `payments/{approved,cancelled,pending}/editContract.svelte` (3 additional files not in the original list), and `EmployeeFormType` replaced with a correct local literal type in the paid-salaries page since importing the type from its actual (unrelated) route would have been wrong
- **#18** — `SelectComp` import added to `EditAppointment.svelte` (still dead code — nothing renders it — so leaving it wired up but unused for now)
- **New, found while fixing #13** — `sites/[id]/payments/editContract.svelte` imported `EditContract` from the wrong schema file (`./schema`, which only has payment fields) instead of `../schema` (which actually defines the contract shape this form uses)
- **New, reported directly by user** — submit buttons showing a `Plus` icon next to "Save Changes" text instead of `Save`, in `admin-panel/pensions/edit.svelte`, `salary/transactions/expenses/categories/edit.svelte`, and `EditAppointment.svelte` (also swapped the now-redundant `Plus` import for `Save` in each)

## ✅ Fixed in pass 2 — the two critical delete-action bugs (#1, #2)

Before touching any of these, checked whether each `delete` action actually has a corresponding form/button anywhere in the app (searched for `<Delete>` usage, raw `action="?/delete"` forms, and any per-row delete buttons in each route's columns/components). Result:

- **`contracts/+page.server.ts`, `contracts/inactive/+page.server.ts`, `contracts/terminated/+page.server.ts`, `sites/[id]/+page.server.ts`, `customers/[id]/+page.server.ts`** — **no form anywhere calls any of these.** Not the shared `<Delete>` component, not a raw form, not a table row action — confirmed with a repo-wide search. These five `delete` actions were pure dead code (the wrong-table bug in #1 could never actually fire in production). **Removed all five actions entirely**, per instruction, rather than fixing logic nobody can reach. If contract/site/customer deletion is wanted later, it'll need to be built fresh (correct table, a real `<Delete>` button wired to the page, and no copy-pasted `form`/`err` references from elsewhere) rather than resurrecting this code.
- **`supplies/[id]/+page.server.ts`** — this one _is_ wired up (`<Delete redirect="/dashboard/supplies" />` renders on the page and posts to it), deletes from the correct `supplies` table, and doesn't have the `form`-not-defined crash. Its only real bug was #12 (`err?.message` referenced outside any `catch` block, in the `if (!id)` early-return). **Fixed**: replaced with a static error message since there's no error object in that branch. Also removed a dead, fully-commented-out duplicate of the same action sitting right below it in the file.
- **Full sweep of every other `delete` action in the app** (`admin-panel/roles/[id]`, `salary/add-deductions/[range]`, `salary/add-overtime/[range]`, both `add-payroll/sites/[id]` variants, `salary/transactions/expenses/categories`) — all confirmed correlated to real, reachable delete buttons (either the shared `<Delete>` component or a per-row `DeleteForm` rendered from each route's `columns.ts`). None of these had the wrong-table or `form`-reference bugs, so nothing to change there.
- **New bug found while checking correlation, not yet fixed:** `supplies/suppliers/[id]/+page.svelte` renders a `<Delete redirect="/dashboard/admin-panel/roles" />` button (plus a `userCount > 0` guard and "Cannot delete role with users" copy — this whole block was evidently copy-pasted from `admin-panel/roles/[id]/+page.svelte` and never adapted), but `supplies/suppliers/[id]/+page.server.ts` **has no `delete` action at all**. Clicking that button will fail with SvelteKit's "unknown action" error. This is the mirror-image problem (a form with no action, instead of an action with no form) and needs a real decision (should suppliers be deletable at all? what should `userCount` actually check?) rather than a mechanical fix, so it's left open — see new entry below.

---

## ✅ Fixed in pass 3 — wrong variable / column / function-name bugs (#3, #7, #11, #14, #15, #19)

One thing worth flagging up front: several of these turned out to look worse than they were because **`svelte-check`'s output was stale** — it hadn't picked up SvelteKit's generated `$types` after earlier edits. Running `npx svelte-kit sync` mid-pass made a batch of previously-reported errors disappear on their own (they were already fixed, just not reflected yet); the ones below are everything that was still genuinely broken after that.

- **#3** (`building` vs `buildingNumber`) — fixed in both `supplies/suppliers/edit.svelte` and `supplies/suppliers/[id]/edit.svelte`: renamed the prop/type annotation to `buildingNumber` and fixed `$form.building = building` → `$form.buildingNumber = buildingNumber`. Confirmed against the real caller (`suppliers/columns.ts` already passes `buildingNumber`) and the schema (`suppliers/schema.ts` only has `buildingNumber`, never `building`).

- **#7, #8, #11, and half of #14** (all in `supplies/[id]/`) — these were all downstream symptoms of one root cause: **`+layout.server.ts` was building the page's initial form from the wrong schema entirely.** It imported `editSupply` from the shared `$lib/ZodSchema` (fields: `supplyId`, `supplyName`, `quantity`, `unitOfMeasure`, `costPerUnit`, `supplier`...) while the actual template, client validators, and the `editSupply` server action all use the _local_ `./schema.ts`'s `edit` (fields: `name`, `description`, `supplyType`, `unitOfMeasurement`, `otherUnitOfMeasurement`, `reorderLevel`). Two different schemas for the same form. Fixed by:
  - Pointing `+layout.server.ts`'s initial `superValidate` at the local `edit` schema instead of `editSupply`.
  - Removing the dead `{@render fe(...)}` call (#7) — it duplicated the very next `InputComp` field for no reason.
  - Rewriting the `$form` pre-fill block to use the real field names: `name`, `description`, `supplyType` (now sourced from a newly-added `supplyTypeId` column in the load query, coerced to a string), `unitOfMeasurement` (was wrongly `unitOfMeasure` — this was #11), `reorderLevel`. Dropped the assignments to `supplyId`, `costPerUnit`, `quantity`, `supplier` — none of these are real schema fields or have a matching input in this form, so they were dead weight (also part of #14's flagged errors).
  - Added a `typeList` fetch (`supplyCategories()` from `$lib/server/fastData` — already used identically by `supplies/add-supplies/+page.server.ts`) and returned it from the layout load, so the "Item Type" dropdown (previously `items={data?.typeList}` with `typeList` not existing at all) now actually has options.
  - `svelte-check` is fully clean on this file and its layout load now.

- **The other half of #14** (`supplies/suppliers/[id]/+page.svelte`, `addressId` error) — found the actual bug: `superForm(data.form, ...)` was using the **`add`** schema's form (no `addressId` field) instead of `data.editForm` (the **`edit`** schema, which has it). Changed to `superForm(data.editForm, ...)`. The `userCount` part of #14/#23 is intentionally left alone — see #23.

- **#15** (`service: number | null` not assignable to `number`) — confirmed `siteContracts.serviceId` is a genuinely nullable foreign key (a contract can exist with no service assigned), so this wasn't a naming bug, it was an overly-strict prop type hiding a real possible state. Widened `service: number` → `service: number | null` in both `editContract.svelte` files that take it as a prop (`contracts/[contractId]/payment-history/` and `sites/[id]/payments/[contractId]/payment-history/`).

- **#19** (duplicate files) — confirmed `customers/[id]/editContract.svelte` was never imported anywhere in the app (only `editContacts.svelte` is, from `contracts.svelte`), and the two files were identical except the dead one had its own extra bug (`$form.contractType` instead of `$form.contactType`, another wrong-name typo — moot since nothing ran it). Deleted the dead duplicate.

All confirmed with `svelte-check` (zero errors remaining on every touched line) and `prettier`.

---

## 🔴 Critical

### 1. ✅ FIXED (by removal — dead code) — Delete actions mutate the wrong table (data corruption)

**Files:**

- `src/routes/dashboard/contracts/+page.server.ts:285`
- `src/routes/dashboard/contracts/inactive/+page.server.ts:285`
- `src/routes/dashboard/contracts/terminated/+page.server.ts:286`
- `src/routes/dashboard/sites/[id]/+page.server.ts:226`

```js
delete: async ({ cookies, params }) => {
	const { id } = params;
	try {
		if (!id) { ... }
		await db.delete(customers).where(eq(customers.id, id));   // <-- wrong table
		setFlash({ type: 'success', message: 'Customer Deleted Successfully!' }, cookies);
		return message(form, { type: 'success', text: 'Customer Deleted Successfully!' });
	}
	...
}
```

**Impact:** These are the delete handlers for **contracts** and **sites**, but they all delete from the `customers` table using the contract/site's `id`. Deleting contract `#7` actually deletes whatever row happens to have `id = 7` in `customers` — an entirely unrelated customer, silently. This is almost certainly a copy-paste from `customers/[id]/+page.server.ts` (the one file where this code is actually correct) that was never adapted to the new table.

**Resolution:** turned out to be unreachable from any UI in all four files (confirmed by repo-wide search — no form, button, or component anywhere calls `?/delete` on these routes). Removed the action entirely instead of fixing logic nothing can trigger. See the pass-2 summary above.

---

### 2. ✅ FIXED (by removal — dead code) — Delete actions crash after the (wrong) delete already succeeded

**Files:** same four as #1, plus `src/routes/dashboard/customers/[id]/+page.server.ts:242` (here the table is correct, but the crash is the same).

```js
await db.delete(customers).where(eq(customers.id, id));
setFlash({ type: 'success', message: 'Customer Deleted Successfully!' }, cookies);
return message(form, {
	// <-- `form` was never declared in this action
	type: 'success',
	text: 'Customer Deleted Successfully!'
});
```

**Impact:** Only `id` is destructured from `params` in this action — `form` doesn't exist. Every successful delete throws `ReferenceError: form is not defined` while building the response, so the request 500s even though the (correct or incorrect) row was already removed from the DB. Users see a failure for an action that already silently happened.

**Resolution:** same as #1 — all five of these were unreachable dead code, so removed rather than patched. The one delete action that _is_ real and reachable (`supplies/[id]/+page.server.ts`) never had this bug in the first place — it already omits the trailing `message(form, ...)` call.

---

### 3. ✅ FIXED — "Edit Supplier" dialog crashes immediately on open

**Files:** `src/routes/dashboard/supplies/suppliers/edit.svelte:60`, `src/routes/dashboard/supplies/suppliers/[id]/edit.svelte:60`

```js
let {
	data, action = '?/edit', id, name, subcity, street, kebele,
	buildingNumber, floor, houseNumber, phone, description, icon = false, status = true
}: {
	...
	building?: string | null;   // <-- type says `building`, prop is actually `buildingNumber`
	...
} = $props();
...
$form.building = building;      // <-- `building` was never declared anywhere
```

**Impact:** `building` is referenced but the destructured prop is named `buildingNumber`. This is a plain `ReferenceError` that fires the moment the component initializes — opening either supplier-edit dialog crashes on the spot.

**Fix applied:** `$form.buildingNumber = buildingNumber;` and corrected the type annotation to match, in both files.

---

### 4. ✅ FIXED — "Edit Supplier" submit button crashes (even once #3 is fixed)

**Files:** same two files, `edit.svelte:191` / `[id]/edit.svelte:191`

```svelte
import {(SquarePen, Plus)} from '@lucide/svelte'; // `Save` never imported ...
<Button type="submit" class="mt-4" form="edit">
	{#if $delayed}
		<LoadingBtn name="Saving Changes" />
	{:else}
		<Save class="h-4 w-4" />
		<!-- ReferenceError -->
		Save Changes
	{/if}
</Button>
```

**Fix:** add `Save` to the `@lucide/svelte` import.

---

### 5. ✅ FIXED — "Add Payment" page for a Site is unrenderable

**File:** `src/routes/dashboard/sites/[id]/payments/add.svelte:201`

```svelte
{#key data}
	<DataTable {columns} {data} search={true} fileName="Contract" />
{/key}
```

**Impact:** `columns` is never imported or declared anywhere in this file. This isn't gated behind an interaction — it crashes on page load for anyone visiting a site's payments/add-payment page.

**Fix applied:** `import { columns } from './columns';` — there was already a sibling `columns.ts` in this exact folder exporting the right `columns` definition.

**Note discovered while fixing:** this whole file (`sites/[id]/payments/add.svelte`) isn't referenced/rendered from anywhere in the app (confirmed via repo-wide search) — it's currently dead code. Fixed it anyway since it's cheap and it may be intended to be wired up, but flagging so it isn't mistaken for a live, user-facing crash right now.

---

### 6. ✅ FIXED — "Add Payment" dialog on that same page also crashes on open

**File:** `src/routes/dashboard/sites/[id]/payments/add.svelte:70`

```svelte
<InputComp
	label="Bank or Payment Method Used"
	name="service"
	type="combo"
	{form}
	{errors}
	required
	items={paymentMethods}
	<--
	never
	defined
/>
```

**Fix applied:** changed to `items={bankList}` — the component already receives a `bankList: Item[]` prop that was never used for this field.

---

### 7. ✅ FIXED — "Edit Supply" form crashes when opened

**File:** `src/routes/dashboard/supplies/[id]/+page.svelte:95`

```svelte
{#if edit}
	<div class="w-full p-4">
		<form action="?/editSupply" use:enhance ...>
			{@render fe('Supply Name', 'supplyName', 'text', 'Enter Supply Name', true)}
```

**Impact:** `fe` is not a declared snippet anywhere in the file — this throws the instant a user clicks "Edit" on a supply (the `{#if edit}` block that contains it becomes active).

**Fix applied:** removed the `{@render fe(...)}` call entirely — it was a dead duplicate of the very next `InputComp` (both rendered a "Supply Name" field with the same placeholder; the `InputComp` one is the real, schema-matching field). See the pass-3 summary above for the bigger schema-mismatch bug this was tangled up in.

---

### 8. ✅ FIXED — Selecting "Other" unit of measurement crashes the Edit Supply form

**File:** `src/routes/dashboard/supplies/[id]/+page.svelte:142-143`

```svelte
{#if $form.unitOfMeasurement === 'other'}
	<div transition:fly={{ x: -20, duration: 300 }}>
```

**Impact:** `fly` is used but never imported from `svelte/transition`. Combined with bug #7, this whole edit form is currently unusable, but this specific crash is worth flagging separately since it hits a different code path (conditional on form state, not just on opening).

**Fix applied:** `import { fly } from 'svelte/transition';`

---

### 9. ✅ FIXED — "Download All PDF" button is completely broken

**File:** `src/routes/dashboard/requests/approved/[range]/+page.svelte:49-68` (bound via `onclick={downloadAllPDF}` at line 247)

```svelte
// import { toPng } from 'html-to-image';   <-- commented out
// import jsPDF from 'jspdf';               <-- commented out
...
const downloadAllPDF = async () => {
	...
	const pdf = new jsPDF('p', 'mm', 'a4');       // ReferenceError
	...
	const dataUrl = await toPng(el, { ... });     // ReferenceError
```

**Impact:** Clicking "Download All PDF" throws immediately. Notably, a _different_, correctly-written function further down in the same file (single-invoice export) does this properly via dynamic `await import('jspdf')` / `await import('html-to-image')` — the batch-export version was evidently never finished/updated to match.

**Fix applied:** `downloadAllPDF` now opens with `const { toPng } = await import('html-to-image'); const { default: jsPDF } = await import('jspdf');`, mirroring the working single-invoice function exactly. The dead commented-out static imports at the top of the file were removed too (was bug #20).

---

### 10. ✅ FIXED — "Add Contact" is broken on all Contracts pages

**Files:** `contracts/+page.server.ts`, `contracts/inactive/+page.server.ts`, `contracts/terminated/+page.server.ts` — `addContact` action

```js
import {
	customers, address, siteMonthlyPayments, user, services, site,
	contractRenewals, employee, siteContracts   // <-- siteContracts imported, not siteContacts
} from '$lib/server/db/schema';
...
addContact: async ({ request, locals, params }) => {
	...
	await tx.insert(siteContacts).values({ ... });   // <-- ReferenceError, siteContacts never imported
```

**Impact:** `siteContacts` (note the typo vs. the actually-imported `siteContracts`) is referenced but never imported. Every attempt to add a contact from any Contracts page throws immediately.

**Fix applied:** confirmed `siteContacts` genuinely exists as its own table (`site_contacts`) in `$lib/server/db/schema/sites.ts`, distinct from `siteContracts` (`site_contracts` — a different table with a very similarly-spelled name) — it was just missing from the import list, not a typo of the wrong table. Added `siteContacts` to the import in all three files.

---

## 🟠 Urgent

### 11. ✅ FIXED — Silent field-name mismatch on "Unit of Measurement"

**File:** `src/routes/dashboard/supplies/[id]/+page.svelte`

The form binds `$form.unitOfMeasurement`, but the actual DB column / returned data field is `unitOfMeasure` (confirmed via `svelte-check`: _"Property 'unitOfMeasurement' does not exist ... Did you mean 'unitOfMeasure'?"_). No crash, but the field almost certainly never loads the existing value or saves under the right key.

**Fix applied:** turned out `unitOfMeasurement` is the _correct_ schema/form field name (it's what the actual `edit` schema and the visible `InputComp` both use) — the bug was on the other side: the pre-fill code was assigning `$form.unitOfMeasure = data.supply.unitOfMeasure` (wrong field, and also `unitOfMeasure` isn't even a form field). Fixed to `$form.unitOfMeasurement = data.supply?.unitOfMeasure` — mapping the real DB column (`unitOfMeasure`) onto the real form field (`unitOfMeasurement`). Part of the larger `supplies/[id]` schema-mismatch fix — see pass-3 summary above.

---

### 12. ✅ FIXED (partially by removal) — `err` referenced outside any catch block in delete actions

**Files:** all four delete actions from #1, plus `customers/[id]/+page.server.ts` and `supplies/[id]/+page.server.ts`

```js
if (!id) {
	setFlash({ type: 'error', message: `Unexpected Error: ${err?.message}` }, cookies);
	return fail(400);
}
```

**Impact:** `err` doesn't exist in this branch (it's only defined inside the `catch (err)` further down). This only trips when `id` is missing from `params` — a rare edge case for a dynamic route — but it turns what should be a clean 400 into an unhandled 500.

**Resolution:** the four `#1` files and `customers/[id]` had this whole action removed (dead code, see pass 2 summary). `supplies/[id]/+page.server.ts` is real and reachable — **fixed** by replacing the interpolation with a static `'Unexpected Error: missing supply id'` message, since there's no error object in that branch.

---

### 13. ✅ FIXED — Type-only imports silently broken (no runtime crash, but zero type safety)

**Files:**

- `src/routes/dashboard/contracts/[contractId]/payment-history/editContract.svelte:35` — `EditContract` not found
- `src/routes/dashboard/sites/[id]/editContract.svelte:32` — `EditContract` not found
- `src/routes/dashboard/sites/[id]/payments/editContract.svelte:32` — `EditContract` not found
- `src/routes/dashboard/sites/[id]/payments/[contractId]/payment-history/editContract.svelte:31` — `EditContract` not found
- `src/routes/dashboard/employees/single/[id]/editIdentity.svelte:28` — `EditIdentity` not found
- `src/routes/dashboard/employees/single/[id]/editQualification.svelte:22` — `EditQualification` not found
- `src/routes/dashboard/salary/paid-salaries/[month_year]/+page.svelte:75` — `EmployeeFormType` not found
- `src/routes/dashboard/sites/[id]/payments/editContract.svelte:53` and `.../[contractId]/payment-history/editContract.svelte:51` — `import type { EditContact } from './schema'` but the schema only exports `EditContract` (typo)
- Also found while fixing (not in the original list): the same `EditContact` → `EditContract` typo in `src/routes/dashboard/payments/{approved,cancelled,pending}/editContract.svelte`

**Impact:** Because these are `import type` statements, TypeScript strips them and there's no runtime crash — but it means these forms currently have **no compile-time type checking at all** on their `$form` shape. A future schema change (renamed/removed field) would silently break these forms with no warning from the type checker.

**Fix applied, per file:**

- The 8 `EditContact` → `EditContract` typos: corrected to the real exported name.
- `sites/[id]/editContract.svelte`, `editIdentity.svelte`, `editQualification.svelte`: the type genuinely exists in each file's own `./schema.ts` — it just had no import statement at all. Added `import type { EditContract/EditIdentity/EditQualification } from './schema';`.
- `sites/[id]/payments/editContract.svelte`: this one was trickier — its own `./schema.ts` (the payments schema) has no contract-shaped export at all, only `AddPayment`/`EditPayment`. The `$form` fields this component actually uses (`contractDate`, `contractYear`, `service`, `monthlyAmount`, `commissionConsidered`, `signingOfficer`...) match the `EditContract` type one directory up, in `sites/[id]/schema.ts`. Changed the import to `from '../schema'` instead of `'./schema'`.
- `salary/paid-salaries/[month_year]/+page.svelte`: `EmployeeFormType` is a real type, but it's defined in a completely unrelated route (`salary/add-payroll/[range]/schema.ts`) and models a different shape (pre-computed payroll-run employee, not this page's paid-salary row). Importing it would have been a type mismatch waiting to happen, so instead gave `calculateTotal`'s `key` parameter a precise local type: `'gross' | 'taxAmount' | 'penEm' | 'penOrg' | 'netPay'` (exactly the literals it's actually called with).

---

### 14. 🟡 PARTIALLY FIXED — Supplier detail page references fields that don't exist on the loaded data

**File:** `src/routes/dashboard/supplies/suppliers/[id]/+page.svelte`

`svelte-check` flags:

- `addressId` (line 66) — not on the address object shape returned by the load fn
- `userCount` (line 95) — not on the supplier object
- Several `string | null` / `number | null` values assigned into fields typed as non-nullable `string`/`number` (lines 69-77)

**Impact:** Likely renders as `undefined`/blank in the UI rather than crashing, but worth checking what these fields were actually supposed to display — probably a load-function change that wasn't propagated to this page.

**`addressId` — fixed:** the real bug was `superForm(data.form, ...)` using the `add` schema's empty form instead of `data.editForm` (the `edit` schema, which genuinely has `addressId`). Changed to `data.editForm`; the "several `string | null` not assignable" errors on the same lines went away as a side effect since they were the same root cause.

**`userCount` — intentionally left open,** see #23: it's not a typo of a real field, it's a whole guard/feature (from a copy-pasted Roles-page block) that doesn't have a real backing concept for suppliers yet, so there's no "correct name" to rename it to.

---

### 15. ✅ FIXED — `service` can be `null` where a `number` is required

**Files:** `contracts/[contractId]/payment-history/+page.svelte:303`, `sites/[id]/payments/[contractId]/payment-history/+page.svelte:264`

`svelte-check`: _"Type 'number | null' is not assignable to type 'number'"_ on the `service` field passed into the edit-contract component. Worth confirming what actually happens in the UI when a contract's `service` is null (blank combo box vs. a hard crash) — if `InputComp`'s `combo` type doesn't defensively handle `null`, this could be a hidden crash for any contract missing a service.

**Fix applied:** confirmed `siteContracts.serviceId` is a genuinely nullable foreign key in the schema — a contract can legitimately have no service assigned. This wasn't a wrong name, it was too-strict a type hiding a real state. Widened the `service` prop type from `number` to `number | null` in both `editContract.svelte` files that receive it.

---

### 23. Supplier detail page has a "Delete" button with no matching server action (new — found while auditing delete actions)

**File:** `src/routes/dashboard/supplies/suppliers/[id]/+page.svelte:95-104`

```svelte
{#if data.single?.userCount > 0}
	<Button
		variant="destructive"
		onclick={() => toast.error('Cannot delete role with users')}
		title="Cannot delete role with users"><Trash /> Delete</Button
	>
{:else}
	<Delete redirect="/dashboard/admin-panel/roles" />
{/if}
```

**Impact:** This entire block — the `userCount` guard, the "Cannot delete **role** with users" copy, and the redirect to `/dashboard/admin-panel/roles` — was clearly copy-pasted straight from `admin-panel/roles/[id]/+page.svelte` and never adapted for suppliers. Worse: `supplies/suppliers/[id]/+page.server.ts` **has no `delete` action at all** (its `actions` export only has `edit`). Clicking "Delete" here when `userCount` isn't `> 0` posts to `?/delete`, which doesn't exist, so SvelteKit returns an "unknown action" error. Note `userCount` also doesn't actually exist on the supplier type returned by this page's load function (this is bug #14) — so today `data.single?.userCount > 0` is always `undefined > 0` (`false`), meaning the broken `<Delete>` button is the one that always renders.

**Not fixed yet** — this needs a decision, not a mechanical patch: should suppliers be deletable at all, and if so, does "can't delete if in use" actually apply (and by what real field, since `userCount` isn't real)? Once that's decided: write a real `delete` action in `supplies/suppliers/[id]/+page.server.ts` (mirroring the correct, working `supplies/[id]/+page.server.ts` one), fix the redirect target and copy, and replace `userCount` with whatever the real "supplier is in use" check should be.

---

## New bugs found by the Vitest test suite (not fixed yet)

Writing real browser tests (`vitest` + `vitest-browser-svelte`, real Chromium via Playwright) for `src/lib/formComponents/*` and `src/lib/components/Table/*` surfaced two more genuine bugs, on top of confirming `RadioComp.svelte`'s broken import (see the "no use for RadioComp" note — deferred, not fixed, since nothing renders it).

### 24. `InputComp.svelte` never associates its `<Label>` with the field it labels

**File:** `src/lib/formComponents/InputComp.svelte`

```svelte
<Label for={name} class="capitalize">{label}</Label>
...
<Input {type} step="any" {name} bind:value={$form[name]} ... />
<!-- no id! -->
```

**Impact:** `Label for={name}` expects an element with `id={name}` — but the underlying `Input`/`Textarea` is only ever given a `name`, never an `id`. Since `InputComp` is the single shared field component used by nearly every form in the app, this means **no form field anywhere has a properly associated label**: screen readers can't tell which label goes with which input, and clicking label text doesn't focus/activate the field (only works today because the label happens to sit visually next to the input for mouse users). Caught by a test asserting `getByLabelText('Name')` finds the field — it doesn't.

**Fix:** pass `id={name}` through to the underlying `Input`/`Textarea` (and to `SelectComp`/`ComboboxComp`/`CheckboxComp` where relevant) so the `for`/`id` pair actually matches.

---

### 25. `Table/address.svelte` shows every address field, even ones that were never provided

**File:** `src/lib/components/Table/address.svelte`

The component computes a filtered `addressFields` array via `$derived` — only fields that actually have a value — and uses it solely to decide `hasAddress` (whether to show the panel at all or "No address information available"). But the actual list rendered inside the panel iterates the _different_, unfiltered `hierarchyItems` array, which always includes all six fields (Subcity, Street, Kebele, Building Number, Floor, House Number) regardless of whether they're empty.

**Impact:** a customer/site/employee address with only 2 of 6 fields filled in still shows all 6 rows in the popup, with 4 of them blank — `addressFields` is effectively dead code. Minor UX rather than a crash.

**Fix:** render `addressFields` in the panel instead of `hierarchyItems` (or filter `hierarchyItems` the same way `addressFields` does).

---

## 🟡 Semi-urgent

### 16. Stale-value pattern across many edit dialogs

**Files:** most `editX.svelte` dialog components (`editSites.svelte`, `editContract.svelte`, `editContacts.svelte`, `editFamily.svelte`, `editSchedule.svelte`, `editExperience.svelte`, `editQualification.svelte`, `suppliers/[id]/edit.svelte`, and others — flagged by Svelte's `state_referenced_locally` warning in ~15+ files)

```js
$form.id = id;
$form.name = name;
// ...directly assigning prop values into the form state at component-init time
```

**Impact:** These assignments only capture the _initial_ value of each prop. If the same dialog component instance is ever reused with new props without a full remount (e.g., a parent re-renders a table row with updated data but Svelte reuses the existing component instance), the dialog will keep showing stale values. Not currently causing visible issues, but it's a landmine — the moment any of these components stop being freshly-keyed per row, edits will silently show/save wrong data.

**Fix:** wrap these assignments in `$effect(() => { $form.id = id; ... })` or otherwise key the components so a fresh instance is always created per row.

---

### 17. Data tables with fully untyped (`any`) columns

**Files:** `src/routes/dashboard/sites/[id]/contracts.svelte`, `src/routes/dashboard/sites/[id]/sites.svelte`, `src/routes/dashboard/supplies/+page.svelte`

Column definitions, cell renderers, and row/column callback params are all implicitly `any`. This means none of these three (fairly central) data tables get any compiler protection if the underlying row type changes — regressions here would only surface at runtime.

---

## ⚪ Annoying, not harmful

### 18. ✅ FIXED (import) — `EditAppointment.svelte` is dead code with a broken import

**File:** `src/lib/forms/EditAppointment.svelte:52` references `SelectComp`, which is never imported. Confirmed via repo-wide search that this component is not referenced anywhere else in the app — it's unreachable, so the missing import is harmless in practice. Should either be finished and wired up, or deleted.

**Fix applied:** added `import SelectComp from '$lib/formComponents/SelectComp.svelte';` (the component already exists in `formComponents/`). The file is still unused dead code otherwise — that part is unchanged and still worth a decision (finish it or delete it).

### 19. ✅ FIXED (by removal) — Duplicate files

`src/routes/dashboard/customers/[id]/editContacts.svelte` and `src/routes/dashboard/customers/[id]/editContract.svelte` are byte-for-byte identical (both implement contact-editing; the "editContract" one is presumably a stray copy-paste that was never repurposed). Confusing to maintain, not a functional bug.

**Fix applied:** confirmed `editContract.svelte` was never imported anywhere in the app (only `editContacts.svelte` is, from `contracts.svelte`) and had its own extra bug on top (`$form.contractType` instead of `$form.contactType` — moot since nothing rendered it). Deleted it.

### 20. ✅ FIXED — Dead commented-out imports

`requests/approved/[range]/+page.svelte` has `// import { toPng } from 'html-to-image';` and `// import jsPDF from 'jspdf';` sitting at the top of the file — remnants tied directly to bug #9. Removed as part of the #9 fix.

### 22. ✅ FIXED — Wrong icon on submit buttons (`Plus` instead of `Save`)

**Files:** `src/routes/dashboard/admin-panel/pensions/edit.svelte`, `src/routes/dashboard/salary/transactions/expenses/categories/edit.svelte`, `src/lib/forms/EditAppointment.svelte`

```svelte
{:else}
	<Plus class="h-4 w-4" />
	Save Changes
{/if}
```

**Impact:** Purely cosmetic — every other edit form in the app uses a `Save` (floppy disk) icon next to "Save Changes"; these three showed a `+` icon instead, which reads as "add/create" rather than "save," inconsistent with the rest of the UI. Reported directly by the user, not part of the original `svelte-check`-driven sweep.

**Fix applied:** swapped the icon to `<Save class="h-4 w-4" />` and updated each file's `@lucide/svelte` import from `Plus` to `Save` (it was otherwise unused in all three files).

### 21. Large volume of `svelte-check` narrowing noise

The bulk of the 2,390 flagged diagnostics are `Did you mean X` / strict-nullability warnings on `+page.svelte` files across `sites/`, `supplies/`, and elsewhere, plus repeated `SuperValidated<...>` "does not satisfy constraint 'Schema'" errors that look like a systemic mismatch between the Zod/Valibot adapter version and `sveltekit-superforms`'s expected generic constraints. Not behavior-affecting on their own, but worth a dedicated pass at some point since they're currently drowning out the real signal above.

---

## Suggested fix order

1. ~~#1 and #2~~ — ✅ **fixed**, both by removing the five unreachable delete actions (see pass 2 summary near the top).
2. ~~#3, #4, #5, #6, #7, #8, #9, #10~~ — ✅ **all fixed.**
3. ~~#11, #14 (addressId part), #15~~ — ✅ **fixed.** #14's `userCount` part is intentionally left open, folded into #23.
4. **#16, #17** — structural correctness/type-safety debt; still open, see note below.
5. ~~#18–#21~~ — #18, #19, #20 fixed; #21 is systemic `svelte-check` noise, not something to mechanically fix. #22 (icon mismatch, reported by user) is ✅ fixed.
6. **#23** — needs a product decision (should suppliers be deletable, and by what real rule) before it can be fixed, so left open.
7. **#24, #25** — new, found by the Vitest test suite (see below). Not fixed yet.

### Test suite

`vitest` + `vitest-browser-svelte` (real Chromium via Playwright) tests now cover every non-shadcn component in `src/lib/formComponents/` and `src/lib/components/Table/`, plus `QueryBuilder.svelte` and `SingleTable.svelte`. Run with `npm run test`. As of this writing: 78 passing, 2 intentionally-failing (document #24 and #25 above until fixed), 1 suite that fails to import (`RadioComp.svelte` — dead code, deferred per the "no use for RadioComp" note).

### On #16 and #17 (still open)

These two are deliberately not touched yet:

- **#16** (stale-value `$form.x = prop` pattern) spans 15+ dialog components. The mechanical fix (wrap each in `$effect`) is safe in isolation, but doing it across that many files in one pass is a lot of surface area to verify, and it's not causing any bug today — it's a landmine for a scenario (component reuse across row updates) that hasn't been confirmed to actually happen anywhere in this codebase yet.
- **#17** (untyped `any` columns in 3 data tables) needs a real row-type interface authored per table before the column defs can be typed properly — not a rename, a small design task each.

Both are exactly the kind of "not urgent, don't break anything today" issue the severity tiers were meant to separate from the crash/data-corruption bugs — happy to take either on next if you want them done now instead of scheduled.
