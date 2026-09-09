import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { timeStats } from '../analytics/time.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'Time & Leave', timeStats);
