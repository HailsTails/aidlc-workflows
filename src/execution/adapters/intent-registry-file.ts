import { z } from "zod";

const intentRow = z.object({
  uuid: z.uuid(),
  slug: z.string().min(1),
  dirName: z.string().min(1).optional(),
  scope: z.string().optional(),
  repos: z.array(z.string()).optional(),
  repos_named: z.literal(true).optional(),
  status: z.string().min(1),
  request: z.string().optional(),
});

export const IntentRegistryFileSchema = z.array(intentRow);

export type IntentRegistryFile = z.infer<typeof IntentRegistryFileSchema>;
