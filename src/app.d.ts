import type { Session, User } from '$lib/server/auth';
import type { BranchContext } from '$lib/server/branchScope';
import type { Lang } from '$lib/i18n/lang';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
			session: Session | null;
			permList: string[];
			/** True when the user holds every permission that exists. */
			isSuperAdmin: boolean;
			/**
			 * The branch this request is being served for, already validated against what the
			 * user may see. Loaders read `branch.active`; they never read the cookie.
			 */
			branch: BranchContext;
			/** The interface language, from the viewer's cookie (`handleLanguage`). */
			lang: Lang;
		}

		interface PageData {
			flash?: { type: 'success' | 'error'; message: string };
			permList?: string[];
			isSuperAdmin?: boolean;
			branch?: BranchContext;
			lang?: Lang;
		}
	}
}

export {};
