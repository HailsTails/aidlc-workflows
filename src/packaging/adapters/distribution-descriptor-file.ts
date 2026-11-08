import { z } from "zod";
import { HarnessProfileFileSchema } from "../../projection/adapters/harness-profile-file.ts";

const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const legacySignatures = z
  .strictObject({
    wholeFileHashes: z.array(hash).optional(),
    jsonEntryHashes: z.record(z.string(), z.array(hash)).optional(),
  })
  .optional();

const integrationBase = {
  path: z.string().min(1),
  optional: z.boolean().optional(),
  legacySignatures,
};

const sharing = z.enum(["union", "identical"]).optional();

const rootIntegration = z.discriminatedUnion("policy", [
  z.strictObject({
    ...integrationBase,
    policy: z.literal("managed-block"),
    marker: z.string().min(1),
    shared: sharing,
  }),
  z.strictObject({ ...integrationBase, policy: z.literal("whole-file"), shared: sharing }),
  z.strictObject({ ...integrationBase, policy: z.literal("json-map"), jsonKey: z.string() }),
  z.strictObject({ ...integrationBase, policy: z.literal("json-array"), jsonKey: z.string() }),
  z.strictObject({ ...integrationBase, policy: z.literal("jsonc-settings") }),
  z.strictObject({ ...integrationBase, policy: z.literal("json-entries") }),
]);

export const DistributionDescriptorFileSchema = z.strictObject({
  schemaVersion: z.literal(2),
  frameworkVersion: z.string(),
  layout: z.enum(["copy", "native"]),
  profile: HarnessProfileFileSchema,
  rootIntegrations: z.array(rootIntegration),
  managedDirectories: z.array(
    z.strictObject({
      path: z.string().min(1),
      ownership: z.enum(["whole-directory", "shipped-files-only"]),
    }),
  ),
  retiredFiles: z.record(z.string(), z.array(hash)),
});

export type DistributionDescriptorFile = z.infer<typeof DistributionDescriptorFileSchema>;
