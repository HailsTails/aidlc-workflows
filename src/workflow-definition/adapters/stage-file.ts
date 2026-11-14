import { z } from "zod";
import {
  COLLABORATION_MODES,
  PHASES,
  PROJECT_TYPES,
  UNIT_KINDS,
} from "../domain/vocabulary.ts";

const kebab = z.string().regex(/^[a-z][a-z0-9-]*$/);

const consumeEntry = z.strictObject({
  artifact: kebab,
  required: z.boolean(),
  conditional_on: z.enum(PROJECT_TYPES).optional(),
  cited: z.boolean().optional(),
});

const composerPrior = z.strictObject({
  targets: z.array(z.enum(["iae", "csu", "ve", "r", "ua"])),
  cost: z.number().int().min(1).max(5).nullable(),
  role: z.enum(["initialization", "core", "phase-gate", "structural"]).optional(),
  project_types: z.array(z.enum(PROJECT_TYPES)).optional(),
});

export const STAGE_RESERVED_KEYS = {
  on_failure: "loop driver",
  blocks_on: "construction worktrees",
  timeout: "sensor binding",
  retry: "loop driver",
} as const;

export const StageFileSchema = z.strictObject({
  slug: kebab,
  number: z.string().regex(/^\d+\.\d+$/).optional(),
  name: z.string().optional(),
  plugin: z.string().optional(),
  phase: z.enum(PHASES),
  execution: z.enum(["ALWAYS", "CONDITIONAL"]),
  condition: z.string(),
  lead_agent: z.string(),
  support_agents: z.array(z.string()),
  mode: z.enum(COLLABORATION_MODES),
  for_each: z.literal("unit-of-work").optional(),
  workspace_requires: z.boolean().optional(),
  produces: z.array(kebab),
  optional_produces: z.array(kebab).optional(),
  produces_kinds: z.record(kebab, z.array(z.enum(UNIT_KINDS)).min(1)).optional(),
  consumes: z.array(consumeEntry),
  requires_stage: z.array(kebab),
  sensors: z.array(kebab).optional(),
  scopes: z.array(z.string()).optional(),
  reviewer: z.string().optional(),
  review_artifact: kebab.optional(),
  reviewer_max_iterations: z.number().int().positive().optional(),
  review_class: z.enum(["adversarial", "advisory"]).optional(),
  summary_confirmation: z.enum(["required", "if-present"]).optional(),
  when: z.strictObject({ "producer-in-plan": kebab }).optional(),
  ars: composerPrior.optional(),
  required_sections: z.array(z.string().min(1)).optional(),
  inputs: z.string(),
  outputs: z.string(),
});

export type StageFile = z.infer<typeof StageFileSchema>;
