#!/usr/bin/env node
/**
 * Fails when the type-error or lint-error count goes *up*.
 *
 * A gate of zero would be honest and useless: the repo carries a large inherited backlog, so a
 * zero gate would be red on every branch and quickly ignored. A ratchet is the opposite — it can
 * never be satisfied by accident, and every branch that lowers a number lowers the budget with
 * it.
 *
 * Lower a budget in the same commit that earns it. Raising one needs a reason in the message.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BUDGET = JSON.parse(readFileSync(new URL('./budget.json', import.meta.url), 'utf8'));

/** Runs a command that is expected to exit non-zero, and hands back its output either way. */
function output(command) {
	try {
		return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	} catch (err) {
		return `${err.stdout ?? ''}${err.stderr ?? ''}`;
	}
}

const checks = [];

const check = output('npx svelte-check --tsconfig ./tsconfig.json --output human');
const found = check.match(/found (\d+) errors and (\d+) warnings/);
checks.push({
	name: 'svelte-check errors',
	actual: found ? Number(found[1]) : NaN,
	budget: BUDGET.typeErrors
});
checks.push({
	name: 'svelte-check warnings',
	actual: found ? Number(found[2]) : NaN,
	budget: BUDGET.typeWarnings
});

const lint = output('npx eslint src');
const problems = lint.match(/✖ (\d+) problems?/);
// No match with a clean exit means no problems at all, which is the best possible outcome.
checks.push({
	name: 'eslint problems',
	actual: problems ? Number(problems[1]) : 0,
	budget: BUDGET.lintProblems
});

let failed = false;

for (const { name, actual, budget } of checks) {
	if (Number.isNaN(actual)) {
		console.error(`✗ ${name}: could not read a count — did the tool fail to run?`);
		failed = true;
		continue;
	}

	if (actual > budget) {
		console.error(`✗ ${name}: ${actual} (budget ${budget}) — this branch adds ${actual - budget}`);
		failed = true;
	} else if (actual < budget) {
		console.log(`✓ ${name}: ${actual} (budget ${budget}) — lower the budget to ${actual}`);
	} else {
		console.log(`✓ ${name}: ${actual}`);
	}
}

process.exit(failed ? 1 : 0);
