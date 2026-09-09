import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { systemStats } from '../analytics/system.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'System', systemStats);
