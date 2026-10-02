import type { KitLabels } from '@nahu/admin-kit/labels';

/**
 * The kit's own words — tables, pagers, date pickers, dialogs — handed to `setKitLabels`. English
 * leaves them as the kit wrote them. The date pickers draw their grids in Amharic in both
 * languages, as this app's own pickers always did.
 */
export const kit: Partial<KitLabels> = { dateLocale: 'am-ET' };
