import { z } from "zod";

const ruleVisitorSchema = z.record(
  z.string(),
  z.function({ input: z.array(z.unknown()), output: z.unknown() }),
);

const ruleSchema = z.looseObject({
  meta: z.looseObject({
    type: z.enum(["problem", "suggestion", "layout"]),
    messages: z.record(z.string(), z.string()).optional(),
  }),
  create: z.function({ input: [z.unknown()], output: ruleVisitorSchema }),
});

export const eslintPluginModuleSchema = z.object({
  default: z.looseObject({ rules: z.record(z.string(), ruleSchema) }),
});

export type LoadedEslintPlugin = z.infer<typeof eslintPluginModuleSchema>["default"];

export const inlineConfigNodesSchema = z.array(
  z.looseObject({ type: z.enum(["Line", "Block"]), value: z.string() }),
);
export type InlineConfigNode = z.output<typeof inlineConfigNodesSchema>[number];
