import { z } from 'zod/v4';

export const reopenSchema = z.object({
	ids: z.array(z.number('Nothing selected')).min(1, 'Select at least one record')
});

export type Reopen = z.infer<typeof reopenSchema>;
