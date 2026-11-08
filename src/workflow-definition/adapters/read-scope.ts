import type { Result } from "../../kernel/result.ts";
import { pluginId, scopeName, stageSlug } from "../domain/identities.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { FreeformDefaultClaim, Scope, ScopeMembership } from "../domain/scope.ts";
import type { CeremonyDefaults, Depth } from "../domain/vocabulary.ts";
import { authoredValue, decodeMarkdown, translated } from "./authored-markdown.ts";
import { ScopeFileSchema, type ScopeFile } from "./scope-file.ts";

type ScopeReading = { readonly scope: Scope; readonly memberships: readonly ScopeMembership[];
  readonly freeformDefaults: readonly FreeformDefaultClaim[] };

const depthOf = (depth: ScopeFile["depth"]): Depth => {
  if (depth === "Minimal") return "minimal";
  if (depth === "Standard") return "standard";
  return "comprehensive";
};

const ceremonyOf = (file: ScopeFile): CeremonyDefaults => ({
  ...(file.sensors ? { sensors: file.sensors } : {}),
  ...(file.learnings ? { learnings: file.learnings } : {}),
  ...(file.summary_confirmation ? { "summary-confirmation": file.summary_confirmation } : {}),
  ...(file.plan_approval ? { "plan-approval": file.plan_approval } : {}),
  ...(file.collaborators ? { collaborators: file.collaborators } : {}),
});

const scopeOf = (request: { readonly file: ScopeFile; readonly guidance: string;
  readonly source: MethodSourceLocation }): Scope => {
  const { file, guidance, source } = request;
  return {
    source: source.path, name: authoredValue(scopeName(file.name)),
    owner: file.plugin ? { kind: "plugin", plugin: authoredValue(pluginId(file.plugin)) }
      : { kind: "core" },
    description: file.description, keywords: file.keywords, depth: depthOf(file.depth),
    testStrategy: file.testStrategy ?? null, runner: file.runner === "true" ? "generated" : "none",
    skeleton: file.skeleton === "on" ? "walking-skeleton" : "none",
    codebase: file.existing_code === "true" ? "existing" : "new",
    guardPolicy: file.guard_policy ?? "off", ceremony: ceremonyOf(file),
    reviewCap: file.review_cap ?? null, guidance,
  };
};

export const readScope = (source: MethodSourceLocation, raw: string):
  Result<ScopeReading, readonly MethodRefusal[]> => {
  const decoded = decodeMarkdown({ source, raw, schema: ScopeFileSchema,
    strings: ["name", "depth", "description", "plugin", "testStrategy", "runner", "skeleton",
      "existing_code", "freeform_default", "review_cap", "guard_policy", "sensors", "learnings",
      "summary_confirmation", "plan_approval", "collaborators"] });
  if (!decoded.ok) return decoded;
  const { file, body: authoredText } = decoded.value;
  return translated(source, () => {
    const scope = scopeOf({ file, guidance: authoredText, source });
    return { scope, memberships: (file.include_stages ?? []).map((slug) => ({
      scope: scope.name, stage: authoredValue(stageSlug(slug)), declaredBy: scope.owner,
    })), freeformDefaults: file.freeform_default === "true"
      ? [{ scope: scope.name, declaredBy: scope.owner }] : [],
    };
  });
};

