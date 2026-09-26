import { db } from '$lib/server/db';

/** A transaction on the database, as `db.transaction` hands it to its body. */
export type TestTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `body` against a real transaction and always rolls it back, returning what `body` returned.
 *
 * A database test exercises the live wiring — the queries, the constraints, the audit rows — and
 * leaves nothing behind (CLAUDE.md §16: a database test creates what it needs inside its own
 * rollback). `approvals.test.ts` and `leaveLedger.test.ts` each carried a copy of this; a third test
 * needing it is what moved it here.
 *
 * The result leaves inside the error that forces the rollback, so it arrives typed, with no cast.
 * Node-only; import it from `*.test.ts` files.
 */
export async function inRollback<T>(body: (tx: TestTx) => Promise<T>): Promise<T> {
	class Rollback {
		constructor(readonly value: T) {}
	}

	try {
		await db.transaction(async (tx) => {
			throw new Rollback(await body(tx));
		});
	} catch (err) {
		if (err instanceof Rollback) return err.value;
		throw err;
	}
	throw new Error('inRollback: the transaction finished without rolling back');
}
