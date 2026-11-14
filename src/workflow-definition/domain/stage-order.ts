import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { StageSlug } from "./identities.ts";
import type { MethodRefusal } from "./refusals.ts";
import type { Stage } from "./stage.ts";
import { PHASES } from "./vocabulary.ts";

type Traversal = {
  readonly stages: readonly Stage[];
  readonly path: readonly StageSlug[];
  readonly stage: Stage;
};

const cycleFrom = (request: Traversal): readonly StageSlug[] => {
  const first = request.path.indexOf(request.stage.slug);
  if (first >= 0) return request.path.slice(first);
  const dependencies = request.stages.filter((candidate) =>
    request.stage.requires.includes(candidate.slug));
  return dependencies.map((stage) => cycleFrom({
    stages: request.stages, path: [...request.path, request.stage.slug], stage,
  })).find((cycle) => cycle.length > 0) ?? [];
};

const phaseIssues = (stages: readonly Stage[]): readonly MethodRefusal[] =>
  stages.flatMap((stage) => {
    const later = stages.filter((candidate) => stage.requires.includes(candidate.slug)
      && PHASES.indexOf(candidate.phase) > PHASES.indexOf(stage.phase));
    return later.length === 0 ? [] : [{
      kind: "invalid-file", location: { kind: "method-source", path: stage.source,
        owner: stage.owner },
      issues: [`Stage ${stage.slug} requires a stage in a later phase`],
    }];
  });

const byHintThenSlug = (left: Stage, right: Stage): number =>
  (left.orderingHint ?? Infinity) - (right.orderingHint ?? Infinity)
  || left.slug.localeCompare(right.slug);

const sortedPhase = (pending: readonly Stage[]): readonly Stage[] => {
  if (pending.length === 0) return [];
  const next = pending.filter((stage) => pending.every((candidate) =>
    !stage.requires.includes(candidate.slug))).toSorted(byHintThenSlug)[0];
  if (!next) return [];
  return [next, ...sortedPhase(pending.filter((stage) => stage.slug !== next.slug))];
};

export const orderStages = (
  stages: readonly Stage[],
): Result<readonly Stage[], readonly MethodRefusal[]> => {
  const cycle = stages.map((stage) => cycleFrom({ stages, path: [], stage }))
    .find((path) => path.length > 0);
  if (cycle) return refused([{ kind: "requires-cycle", stages: cycle }]);
  const issues = phaseIssues(stages);
  if (issues.length > 0) return refused(issues);
  return accepted(PHASES.flatMap((phase) =>
    sortedPhase(stages.filter((stage) => stage.phase === phase))));
};

export const routeStages = (stages: readonly Stage[]): readonly Stage[] =>
  stages.flatMap((stage) => {
    if (stage.cardinality.kind === "once") return [stage];
    const group = stages.filter((candidate) => candidate.phase === stage.phase
      && candidate.cardinality.kind === "per-unit");
    return group[0] === stage ? group : [];
  });
