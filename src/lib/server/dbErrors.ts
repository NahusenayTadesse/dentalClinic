/**
 * Reading MySQL's error codes back out of a Drizzle failure.
 *
 * Drizzle wraps every driver error in a `DrizzleQueryError` carrying the SQL and params, and
 * puts the mysql2 error underneath as `cause`. So `err.code` is `undefined` on anything Drizzle
 * throws, and a check written against it silently never matches — which is what happened to the
 * duplicate-key branches in `contentCrud` and `childCrud`: adding a row whose name already
 * existed returned "Could not add Region" with a 500 instead of naming the clash, for as long
 * as those factories have existed. It only showed up when the app was first run against a
 * database with a row in it.
 *
 * The chain is walked rather than reaching for `.cause` once, because nothing guarantees the
 * wrapping stays one layer deep.
 */

/** The MySQL error code on a failure, wrapped or not. */
export function mysqlErrorCode(err: unknown): string | undefined {
	let current: unknown = err;

	// Bounded: a cause chain is short, and a cycle must not hang the request.
	for (let depth = 0; current && depth < 5; depth++) {
		const code = (current as { code?: unknown }).code;
		if (typeof code === 'string') return code;
		current = (current as { cause?: unknown }).cause;
	}

	return undefined;
}

/** A unique-constraint violation — the row already exists. */
export function isDuplicateKey(err: unknown): boolean {
	return mysqlErrorCode(err) === 'ER_DUP_ENTRY';
}

/** A foreign-key violation — the row is still referenced, or points at something absent. */
export function isForeignKeyViolation(err: unknown): boolean {
	const code = mysqlErrorCode(err);
	return code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_NO_REFERENCED_ROW_2';
}

/**
 * Logs a failure in full and returns the sentence the client is allowed to see.
 *
 * CLAUDE.md §9: loud in the log, quiet to the client. The employee detail page alone had eleven
 * actions putting `err.message` straight into the toast — which, for a failed query, is Drizzle's
 * message: the SQL, the table and column names, and the parameters that were bound. That hands
 * the schema to whoever can provoke an error, and tells an ordinary user nothing they can act on.
 *
 * Returns the text rather than building the response, so it works the same whether the caller
 * answers with a superforms `message`, a flash, or `fail`.
 *
 *     return message(form, { type: 'error', text: hideFailure('employees.editAddress', err,
 *       'Could not save the address. Please try again.') });
 */
export function hideFailure(context: string, err: unknown, shown: string): string {
	console.error(`[${context}]`, err);
	return shown;
}
