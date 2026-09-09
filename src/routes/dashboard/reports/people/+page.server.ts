import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { peopleStats } from '../analytics/people.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'People', peopleStats);
