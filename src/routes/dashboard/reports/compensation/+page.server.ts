import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { compensationStats } from '../analytics/compensation.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'Compensation', compensationStats);
