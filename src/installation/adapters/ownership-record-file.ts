import { z } from "zod";

const hashes = z.record(z.string(), z.string());

const rootContribution = z.discriminatedUnion("policy", [
  z.object({ policy: z.literal("managed-block"), hash: z.string(), marker: z.string().optional() }),
  z.object({ policy: z.literal("whole-file"), hash: z.string() }),
  z.object({ policy: z.literal("json-map"), entries: hashes, key: z.string().optional() }),
  z.object({ policy: z.literal("json-array"), entries: hashes, key: z.string() }),
  z.object({
    policy: z.literal("jsonc-settings"),
    entries: hashes,
    added: z.array(z.string()).optional(),
    created: z.boolean().optional(),
  }),
  z.object({ policy: z.literal("json-entries"), entries: hashes, created: z.boolean().optional() }),
]);

export const OwnershipRecordFileSchema = z.object({
  schemaVersion: z.literal(1),
  frameworkVersion: z.string(),
  distribution: z.string(),
  harnessDir: z.string(),
  mcpMode: z.enum(["defaults", "none"]),
  files: hashes,
  shippedOnly: z.literal(true).optional(),
  entries: z.record(z.string(), hashes).optional(),
  rootContributions: z.record(z.string(), rootContribution),
  statusLineKept: z.literal(true).optional(),
});

export type OwnershipRecordFile = z.infer<typeof OwnershipRecordFileSchema>;
