import { brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CoreContent, Method } from "./method.ts";
import { validateArtifactProducers, validateCoreDuplicates,
  validateCoreReferences } from "./method-references.ts";
import type { MethodRefusal } from "./refusals.ts";
import type { Rule } from "./rule.ts";
import type { Stage } from "./stage.ts";
import { stageNumber, type StageNode } from "./stage-graph.ts";
import { validateStage } from "./stage-invariants.ts";
import { orderStages, routeStages } from "./stage-order.ts";
import { PHASES } from "./vocabulary.ts";

const priority = { org: 0, team: 1, project: 2, phase: 3 } as const;

const rulesFor = (request: { readonly stage: Stage; readonly rules: readonly Rule[] }) =>
  request.rules.filter((rule) => rule.layer.kind !== "phase"
    || rule.layer.phase === request.stage.phase).toSorted((left, right) =>
    priority[left.layer.kind] - priority[right.layer.kind] || left.id.localeCompare(right.id))
    .map((rule) => rule.id);

const numbered = (request: { readonly ordered: readonly Stage[];
  readonly core: CoreContent }): readonly StageNode[] => request.ordered.map((stage, index) => {
  const position = request.ordered.slice(0, index)
    .filter((prior) => prior.phase === stage.phase).length + 1;
  const number = stageNumber(`${PHASES.indexOf(stage.phase)}.${position}`);
  if (!number.ok) throw new Error("A known phase and positive position form a stage number");
  return { stage: stage.slug, number: number.value, availability: "enabled",
    rulesInContext: rulesFor({ stage, rules: request.core.rules }), activeSensors: stage.sensors };
});

const routeIssues = (routed: readonly Stage[]): readonly MethodRefusal[] =>
  routed.flatMap((stage, index) => {
    const later = routed.slice(index).filter((candidate) => stage.requires.includes(candidate.slug));
    return later.length > 0 ? [{ kind: "invalid-file",
      location: { kind: "method-source", path: stage.source, owner: stage.owner },
      issues: [`Stage ${stage.slug} requires a stage after its per-unit run block begins`],
    }] : [];
  });

export const compileCoreMethod = (core: CoreContent): Result<Method, readonly MethodRefusal[]> => {
  const issues = [...validateCoreDuplicates(core), ...validateCoreReferences(core),
    ...validateArtifactProducers(core), ...core.stages.flatMap(validateStage)];
  if (issues.length > 0) return refused(issues);
  const ordered = orderStages(core.stages);
  if (!ordered.ok) return ordered;
  const routed = routeStages(ordered.value);
  const invalidRoute = routeIssues(routed);
  if (invalidRoute.length > 0) return refused(invalidRoute);
  const defaults = [...new Set(core.freeformDefaults.map((claim) => claim.scope))];
  if (defaults.length > 1) return refused([{ kind: "several-freeform-defaults", scopes: defaults }]);
  const nodes = numbered({ ordered: ordered.value, core });
  return accepted(brand<Method>({ ...core, freeformDefault: defaults[0] ?? null,
    installedPlugins: [], selection: { kind: "every-installed" }, findings: [],
    graph: { nodes: routed.flatMap((stage) => {
      const node = nodes.find((candidate) => candidate.stage === stage.slug);
      return node ? [node] : [];
    }) },
  }));
};
