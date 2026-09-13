/**
 * Where a child section's forms post, from the same key `childActions` generated them with.
 *
 *     <LookupSection actions={childActionPaths('Allergy')} … />
 *
 * One function rather than a hand-typed `{ add: '?/addAllergy', … }` per section, because the
 * failure is silent: a misspelt action name is a 404 on submit that looks, to the person using the
 * form, like the save did nothing.
 */
export function childActionPaths(key: string) {
	return { add: `?/add${key}`, edit: `?/edit${key}`, delete: `?/delete${key}` };
}
