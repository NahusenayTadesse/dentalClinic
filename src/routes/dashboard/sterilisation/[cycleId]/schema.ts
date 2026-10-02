import { z } from 'zod/v4';

/** Reading a spore test: it grew, or it did not. */
export const sporeReading = z.object({ result: z.enum(['pass', 'fail']) });

export type SporeReading = z.infer<typeof sporeReading>;
