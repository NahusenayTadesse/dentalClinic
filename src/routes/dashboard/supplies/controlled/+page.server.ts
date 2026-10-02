import { registerPage } from './register.server';
import type { PageServerLoad } from './$types';

/**
 * The controlled-medicine register for the branch being worked at: the month's return for every
 * controlled item, and one item's register line by line. Read only — stock moves on each item's own
 * page, under the register's rules. Gated with the rest of `/dashboard/supplies`.
 */
export const load: PageServerLoad = async ({ url, locals }) => registerPage(url, locals.branch);
