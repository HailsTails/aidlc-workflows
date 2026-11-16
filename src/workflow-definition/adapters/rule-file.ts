import { z } from "zod";

export const RuleFileSchema = z.object({
  pairing: z
    .union([z.literal("feedforward-only"), z.string().regex(/^aidlc-[a-z0-9-]+$/)])
    .optional(),
  status: z.string().optional(),
  stale_after: z.string().optional(),
});

export type RuleFile = z.infer<typeof RuleFileSchema>;
