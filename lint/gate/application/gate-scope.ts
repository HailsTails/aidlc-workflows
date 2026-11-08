import { globMatcher } from "../domain/glob.ts";
import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import { laneById, type Lane, type LanePlan } from "../domain/lane-plan.ts";
import type { FullRequest, ScopeRequest } from "./gate-request.ts";
import type { Loaded, Repository, Workspace } from "./ports.ts";

export type GateScope = {
  readonly lane: Lane | undefined;
  readonly base: BaseRevision | undefined;
  readonly changes: readonly ChangedFile[];
  readonly everything: boolean;
  readonly build: boolean;
  readonly record: boolean;
};

export type ScopeSources = {
  readonly plan: LanePlan;
  readonly repository: Repository;
  readonly workspace: Workspace;
};

const baseFor = (repository: Repository, ref: string): Loaded<BaseRevision> => {
  const base = repository.resolve(ref);
  return base === undefined
    ? {
        ok: false,
        problem: `the base ref ${ref} does not resolve to a merge base with HEAD`,
        fix: `Fetch it (git fetch origin) or pass --base <ref> naming the branch you build on.`,
      }
    : { ok: true, value: base };
};

const unknownLane = (plan: LanePlan, id: string): Loaded<never> => ({
  ok: false,
  problem: `lane ${id} is not in lanes.json`,
  fix: `Use one of the lane ids in lanes.json: ${plan.lanes.map((lane) => lane.id).join(", ")}.`,
});

const pathChanges = (workspace: Workspace, paths: readonly string[]): readonly ChangedFile[] => {
  const asGlobs = paths.flatMap((path) => [path, `${path.replace(/\/$/, "")}/**`]);
  return workspace.filesMatching(asGlobs).map((path) => ({ path, kind: "modified" as const }));
};

const laneScope = (sources: ScopeSources, request: ScopeRequest, lane: Lane): Loaded<GateScope> => {
  const base = baseFor(sources.repository, request.baseRef);
  if (!base.ok) {
    return base;
  }
  const changes = sources.repository.changesSince(base.value);
  const scope = { lane, base: base.value, changes, everything: false, build: false };
  return { ok: true, value: { ...scope, record: request.record } };
};

export const scopeOf = (sources: ScopeSources, request: ScopeRequest): Loaded<GateScope> => {
  const lane = laneById(sources.plan, request.target);
  if (lane !== undefined) {
    return laneScope(sources, request, lane);
  }
  const paths = request.target.split(",").filter((path) => path !== "");
  const changes = pathChanges(sources.workspace, paths);
  const scope = { lane: undefined, base: undefined, changes, everything: false, build: false };
  return { ok: true, value: { ...scope, record: request.record } };
};

export const fullScopeOf = (sources: ScopeSources, request: FullRequest): Loaded<GateScope> => {
  const lane = request.laneId === undefined ? undefined : laneById(sources.plan, request.laneId);
  if (request.laneId !== undefined && lane === undefined) {
    return unknownLane(sources.plan, request.laneId);
  }
  const base = baseFor(sources.repository, request.baseRef);
  if (!base.ok) {
    return base;
  }
  const changes = sources.repository.changesSince(base.value);
  const { build, record } = request;
  return { ok: true, value: { lane, base: base.value, changes, everything: true, build, record } };
};

export const touches = (scope: GateScope, globs: readonly string[]): boolean => {
  const matches = globMatcher(globs);
  return scope.changes.some((change) => matches(change.path));
};
