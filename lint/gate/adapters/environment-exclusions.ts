import { z } from "zod";
import type { CapabilityExclusion } from "../domain/capability-exclusion.ts";
import type { Workspace } from "../application/ports.ts";

export const EXCLUSIONS_PATH = "lint/environment-exclusions.json";

const ExclusionsSchema = z.object({
  schemaVersion: z.literal(1),
  exclusions: z.array(
    z.object({
      capability: z.enum(["symlinks", "short-names", "listable-system-temp"]),
      cases: z.array(z.string().min(1)),
    }),
  ),
});

export const environmentExclusions = (workspace: Workspace): readonly CapabilityExclusion[] =>
  ExclusionsSchema.parse(JSON.parse(workspace.read(EXCLUSIONS_PATH) ?? "{}")).exclusions;
