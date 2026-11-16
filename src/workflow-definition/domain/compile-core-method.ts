import { brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CompiledMethod, CoreContent, Method } from "./method.ts";
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

export const numberStage = (request: { readonly stage: Stage; readonly position: number;
  readonly rules: readonly Rule[] }): Result<StageNode, readonly MethodRefusal[]> => {
  const { stage, position } = request;
  const number = stageNumber(`${PHASES.indexOf(stage.phase)}.${position}`);
  if (!number.ok) return refused([{ kind: "invalid-file",
    location: { kind: "method-source", path: stage.source, owner: stage.owner },
    issues: [`Stage ${stage.slug} cannot be numbered at position ${position} in phase ${stage.phase}`],
  }]);
  return accepted({ stage: stage.slug, number: number.value, availability: "enabled",
    rulesInContext: rulesFor({ stage, rules: request.rules }), activeSensors: stage.sensors });
};

const numbered = (request: { readonly ordered: readonly Stage[];
  readonly core: CoreContent }): Result<readonly StageNode[], readonly MethodRefusal[]> => {
  const numberedStages = request.ordered.map((stage, index) => numberStage({ stage,
    position: request.ordered.slice(0, index).filter((prior) => prior.phase === stage.phase).length + 1,
    rules: request.core.rules,
  }));
  const issues = numberedStages.flatMap((numbering) => numbering.ok ? [] : numbering.refusal);
  return issues.length > 0 ? refused(issues)
    : accepted(numberedStages.flatMap((numbering) => numbering.ok ? [numbering.value] : []));
};

const routeIssues = (routed: readonly Stage[]): readonly MethodRefusal[] =>
  routed.flatMap((stage, index) => {
    const later = routed.slice(index).filter((candidate) => stage.requires.includes(candidate.slug));
    return later.length > 0 ? [{ kind: "invalid-file",
      location: { kind: "method-source", path: stage.source, owner: stage.owner },
      issues: [`Stage ${stage.slug} requires a stage after its per-unit run block begins`],
    }] : [];
  });

const coreOwnershipIssues = (core: CoreContent): readonly MethodRefusal[] => [
  ...core.stages, ...core.scopes, ...core.agents, ...core.rules, ...core.sensors, ...core.knowledge,
].filter((definition) => definition.owner.kind !== "core").map((definition) => ({
  kind: "invalid-file", location: { kind: "method-source", owner: { kind: "core" },
    path: definition.source },
  issues: ["An authored core definition may not claim non-core ownership"],
}));
type FreshContent = CoreContent & Pick<CompiledMethod, "graph" | "freeformDefault">;

export const compileFreshContent = (core: CoreContent): Result<FreshContent, readonly MethodRefusal[]> => {
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
  if (!nodes.ok) return nodes;
  return accepted({ ...core, freeformDefault: defaults[0] ?? null,
    graph: { nodes: routed.flatMap((stage) => {
      const node = nodes.value.find((candidate) => candidate.stage === stage.slug);
      return node ? [node] : [];
    }) },
  });
};

export const compileCoreMethod = (core: CoreContent): Result<Method, readonly MethodRefusal[]> => {
  const ownership = coreOwnershipIssues(core);
  if (ownership.length > 0) return refused(ownership);
  const compiled = compileFreshContent(core);
  return compiled.ok ? accepted(brand<Method>({ ...compiled.value, installedPlugins: [],
    selection: { kind: "every-installed" }, findings: [] })) : compiled;
};
