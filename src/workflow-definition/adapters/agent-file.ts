import { z } from "zod";
import { TIERS } from "../domain/vocabulary.ts";

export const AgentFileSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  display_name: z.string().min(1),
  description: z.string().min(1),
  examples: z.array(z.string()).optional(),
  disallowedTools: z.string().optional(),
  tier: z.enum(TIERS).optional(),
  maxTurns: z.number().int().positive().optional(),
  plugin: z.string().optional(),
});

export type AgentFile = z.infer<typeof AgentFileSchema>;
