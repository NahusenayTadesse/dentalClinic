import type { Session, User } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
			session: Session | null;
			permList: string[];
			/** True when the user holds every permission that exists. */
			isSuperAdmin: boolean;
		}

		interface PageData {
			flash?: { type: 'success' | 'error'; message: string };
			permList?: string[];
			isSuperAdmin?: boolean;
		}
	}
}

export {};
