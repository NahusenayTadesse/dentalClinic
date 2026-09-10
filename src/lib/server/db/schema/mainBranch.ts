/**
 * The id the main branch always has. `/setup` creates it, so a row can default to it safely.
 *
 * **This file must stay import-free.** It exists as its own module rather than living in
 * `branches.ts` because of a cycle: `branches.ts` spreads `secureFields`, which references
 * `user`, and `user` defaults its `branch_id` to this constant. `.default()` evaluates the
 * moment the module does — unlike `.references(() => …)`, which stays lazy — so reading it from
 * `branches.ts` threw `Cannot access 'MAIN_BRANCH_ID' before initialization` at schema load,
 * taking `drizzle-kit generate` down with it. A leaf module has no cycle to be caught in.
 *
 * A constant rather than a literal `1` scattered through the schema: if a clinic ever deletes
 * and recreates its first branch, this is the one place that has to be reconsidered.
 */
export const MAIN_BRANCH_ID = 1;
