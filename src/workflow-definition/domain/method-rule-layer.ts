import type { RuleLevel } from "./contribution.ts";
import type { MethodSourcePath } from "./method-source.ts";
import type { RuleLayer } from "./rule.ts";
import { PHASES } from "./vocabulary.ts";

export const ruleLayerFor = (request: {
  readonly path: MethodSourcePath;
  readonly policy: { readonly kind: "core" } | { readonly kind: "plugin"; readonly level: RuleLevel };
}): RuleLayer | null => {
  const name = request.path.replace(/^memory\//, "").replace(/\.md$/, "");
  const phase = PHASES.find((candidate) => name === `phases/${candidate}`);
  if (phase) return { kind: "phase", phase };
  if (request.policy.kind === "plugin") return { kind: request.policy.level };
  return name === "org" || name === "team" || name === "project" ? { kind: name } : null;
};
