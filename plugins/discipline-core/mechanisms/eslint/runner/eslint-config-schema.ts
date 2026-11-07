import { z } from "zod";

export const resolvedConfigSchema = z.union([
  z.undefined(),
  z.looseObject({
    rules: z
      .record(
        z.string(),
        z.tuple([z.union([z.literal(0), z.literal(1), z.literal(2)])], z.unknown()),
      )
      .optional(),
  }),
]);

export type ResolvedConfig = z.output<typeof resolvedConfigSchema>;

export type RuleState =
  | { readonly state: "file-ignored" }
  | { readonly state: "rule-absent" }
  | { readonly state: "configured"; readonly severity: 0 | 1 | 2 };

export const ruleStateOf = (request: {
  readonly resolved: ResolvedConfig;
  readonly ruleId: string;
}): RuleState => {
  if (request.resolved === undefined) {
    return { state: "file-ignored" };
  }
  const entry = request.resolved.rules?.[request.ruleId];
  if (entry === undefined) {
    return { state: "rule-absent" };
  }
  return { state: "configured", severity: entry[0] };
};
