import type { MarkdownOutliner } from "../application/ports.ts";
import type { AuthoredBody } from "../domain/outline.ts";
import type { ScopeMembership } from "../domain/scope.ts";
import { refused, type Result } from "../../kernel/result.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import { agentSlug, artifactName, pluginId, scopeName, sensorId, stageSlug,
  type Owner } from "../domain/identities.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { ArtifactProduction, Participation, ReviewPolicy, Stage } from "../domain/stage.ts";
import { validateStage } from "../domain/stage-invariants.ts";
import { decodeMarkdown, translated, authoredValue } from "./authored-markdown.ts";
import { STAGE_RESERVED_KEYS, StageFileSchema, type StageFile } from "./stage-file.ts";

const ownerOf = (file: StageFile, source: MethodSourceLocation): Owner => {
  if (!file.plugin) return source.owner;
  return { kind: "plugin", plugin: authoredValue(pluginId(file.plugin)) };
};

const participationOf = (file: StageFile): Participation => {
  const lead = file.lead_agent === "orchestrator"
    ? { kind: "conductor" as const }
    : { kind: "agent" as const, agent: authoredValue(agentSlug(file.lead_agent)) };
  const supports = file.support_agents.map((slug) => authoredValue(agentSlug(slug)));
  if (file.mode !== "mob" && file.mode !== "pipeline") return { mode: file.mode, lead, supports };
  const [first, ...others] = supports;
  if (!first) throw new Error(`${file.mode} requires at least one support agent`);
  return { mode: file.mode, lead, supports: [first, ...others] };
};

const productionsOf = (file: StageFile): readonly ArtifactProduction[] => {
  const required = file.produces.map((artifact) => ({ artifact, obligation: "required" as const }));
  const optional = (file.optional_produces ?? []).map((artifact) =>
    ({ artifact, obligation: "optional" as const }));
  const productions = [...required, ...optional];
  const undeclared = Object.keys(file.produces_kinds ?? {}).find((key) =>
    !productions.some((definition) => definition.artifact === key));
  if (undeclared) throw new Error(`produces_kinds.${undeclared} does not name a production`);
  return productions.map((definition) => {
    const [first, ...rest] = file.produces_kinds?.[definition.artifact] ?? [];
    return { artifact: authoredValue(artifactName(definition.artifact)), obligation: definition.obligation,
      unitKinds: first ? [first, ...rest] : "all" };
  });
};

const reviewOf = (file: StageFile): ReviewPolicy | null => {
  if (!file.reviewer) {
    if (file.review_artifact || file.review_class || file.reviewer_max_iterations) {
      throw new Error("Review settings require a reviewer");
    }
    return null;
  }
  if (!file.review_artifact) throw new Error("A reviewer requires review_artifact");
  return { reviewer: authoredValue(agentSlug(file.reviewer)),
    artifact: authoredValue(artifactName(file.review_artifact)),
    maxIterations: file.reviewer_max_iterations ?? 2,
    reviewClass: file.review_class ?? "adversarial" };
};

const composerPriorOf = (file: StageFile): Stage["composerPrior"] => {
  if (!file.ars) return null;
  const costs = [1, 2, 3, 4, 5] as const;
  const cost = costs.find((authored) => authored === file.ars?.cost) ?? null;
  return { targets: file.ars.targets, cost, role: file.ars.role ?? null,
    projectTypes: file.ars.project_types ?? [] };
};

const deliveryOf = (file: StageFile): Pick<Stage,
  "review" | "summaryConfirmation" | "activation" | "composerPrior" | "requiredSections"> => ({
  review: reviewOf(file), summaryConfirmation: file.summary_confirmation ?? "none",
  activation: file.when
    ? { kind: "producer-in-plan" as const,
      artifact: authoredValue(artifactName(file.when["producer-in-plan"])) }
    : { kind: "always" as const },
  composerPrior: composerPriorOf(file), requiredSections: file.required_sections ?? [],
});

const stageOf = (request: { readonly file: StageFile; readonly body: AuthoredBody; readonly source: MethodSourceLocation }): Stage => { const {file, body: authoredText, source} = request; return ({
  source: source.path, slug: authoredValue(stageSlug(file.slug)),
  displayName: file.name ?? file.slug.split("-").map((word) =>
    word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
  phase: file.phase,
  orderingHint: file.number ? Number(file.number.split(".")[1]) : null,
  owner: ownerOf(file, source),
  execution: { trigger: file.execution === "ALWAYS" ? "always" : "conditional",
    condition: file.condition },
  participation: participationOf(file),
  cardinality: { kind: file.for_each ? "per-unit" : "once" },
  workspace: file.workspace_requires ? "writes" : "read-only",
  produces: productionsOf(file),
  consumes: file.consumes.map((definition) => ({ artifact: authoredValue(artifactName(definition.artifact)),
    obligation: definition.required ? "required" : "optional", when: definition.conditional_on ?? "always", citation: definition.cited ? "cited" : "uncited" })),
  requires: file.requires_stage.map((slug) => authoredValue(stageSlug(slug))),
  sensors: (file.sensors ?? []).map((id) => authoredValue(sensorId(id))),

  ...deliveryOf(file),
  briefing: { inputs: file.inputs, outputs: file.outputs, instructions: authoredText },
}); };

export const readStage = (request: {
  readonly source: MethodSourceLocation;
  readonly raw: string;
  readonly outliner: MarkdownOutliner;
}): Result<StageReading, readonly MethodRefusal[]> => {
  const { source, raw, outliner } = request;
  const decoded = decodeMarkdown({ source, raw, schema: StageFileSchema,
    reserved: STAGE_RESERVED_KEYS,
    strings: ["slug", "number", "name", "plugin", "phase", "execution", "condition",
      "lead_agent", "mode", "for_each", "reviewer", "review_artifact", "review_class",
      "summary_confirmation", "inputs", "outputs"] });
  if (!decoded.ok) return decoded;
  const { file, body: authoredText } = decoded.value;
  if (source.path.split("/").at(-1) !== `${file.slug}.md`) {
    return refused([{ kind: "slug-differs-from-file", source, slug: file.slug }]);
  }
  const admission = translated(source, () => stageOf({ file, body: outliner.outline(authoredText), source }));
  if (!admission.ok) return admission;
  const issues = validateStage(admission.value);
  if (issues.length > 0) return refused(issues);
  return translated(source, () => ({ stage: admission.value,
    memberships: (file.scopes ?? []).map((name) => ({
      scope: authoredValue(scopeName(name)), stage: admission.value.slug,
      declaredBy: admission.value.owner,
    })),
  }));
};
type StageReading = { readonly stage: Stage; readonly memberships: readonly ScopeMembership[] };
