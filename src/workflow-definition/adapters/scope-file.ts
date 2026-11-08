import { z } from "zod";
import { GUARD_POLICIES, REVIEW_CLASSES } from "../domain/vocabulary.ts";

const onOff = z.enum(["on", "off"]);

const trueFalse = z.enum(["true", "false"]);

export const ScopeFileSchema = z.strictObject({
  name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+@-]*$/),
  depth: z.enum(["Minimal", "Standard", "Comprehensive"]),
  keywords: z.array(z.string()),
  description: z.string(),
  plugin: z.string().optional(),
  testStrategy: z.string().optional(),
  runner: trueFalse.optional(),
  skeleton: onOff.optional(),
  existing_code: trueFalse.optional(),
  freeform_default: trueFalse.optional(),
  include_stages: z.array(z.string()).optional(),
  review_cap: z.enum(REVIEW_CLASSES).optional(),
  guard_policy: z.enum(GUARD_POLICIES).optional(),
  sensors: onOff.optional(),
  learnings: onOff.optional(),
  summary_confirmation: onOff.optional(),
  plan_approval: onOff.optional(),
  collaborators: onOff.optional(),
});

export type ScopeFile = z.infer<typeof ScopeFileSchema>;
