import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { moneyStats } from '../analytics/money.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'Money', moneyStats);
