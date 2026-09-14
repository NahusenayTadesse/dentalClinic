import type { PageData } from './$types';

/** One appointment as the day view has it, taken from the load so the two cannot drift. */
export type DayAppointment = PageData['appointments'][number];
