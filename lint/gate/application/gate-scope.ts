import { globMatcher } from "../domain/glob.ts";
import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import { laneById, type Lane, type LanePlan } from "../domain/lane-plan.ts";
import type { FullRequest, ScopeRequest } from "./gate-request.ts";
import type { HeavySlot, Loaded, Repository, Workspace } from "./ports.ts";

export type ScopeFacts = {
  readonly lane: Lane | undefined;
  readonly lanes?: readonly Lane[];
  readonly base: BaseRevision | undefined;
  readonly changes: readonly ChangedFile[];
  readonly everything: boolean;
  readonly build: boolean;
  readonly record: boolean;
  readonly allTests: boolean;
};

export type GateScope = ScopeFacts & { readonly heavy: HeavySlot };

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

const declaredLanes = (plan: LanePlan, ids: string): Loaded<readonly Lane[]> => {
  const names = [...new Set(ids.split("+"))];
  const unknown = names.find((id) => laneById(plan, id) === undefined);
  return unknown !== undefined
    ? unknownLane(plan, unknown)
    : { ok: true, value: plan.lanes.filter((lane) => names.includes(lane.id)) };
};

export const scopeLaneId = (scope: ScopeFacts): string | undefined =>
  scope.lanes?.map((lane) => lane.id).join("+") ?? scope.lane?.id;

const withoutTrailingSlash = (path: string): string => path.replace(/\/$/, "");

const pathChanges = (workspace: Workspace, paths: readonly string[]): readonly ChangedFile[] => {
  const asGlobs = paths.flatMap((path) => [path, `${withoutTrailingSlash(path)}/**`]);
  const present = workspace.filesMatching(asGlobs);
  const isPresent = (path: string): boolean =>
    present.some((file) => file === path || file.startsWith(`${withoutTrailingSlash(path)}/`));
  return [
    ...present.map((path) => ({ path, kind: "modified" as const })),
    ...paths.filter((path) => !isPresent(path)).map((path) => ({ path, kind: "deleted" as const })),
  ];
};

const laneScope = (
  sources: ScopeSources,
  request: ScopeRequest,
  lanes: readonly Lane[],
): Loaded<ScopeFacts> => {
  const base = baseFor(sources.repository, request.baseRef);
  if (!base.ok) {
    return base;
  }
  const changes = sources.repository.changesSince(base.value);
  const scope = {
    lane: lanes[0], lanes, base: base.value, changes, everything: false, build: false,
  };
  return { ok: true, value: { ...scope, record: request.record, allTests: request.allTests } };
};

export const scopeOf = (sources: ScopeSources, request: ScopeRequest): Loaded<ScopeFacts> => {
  const lane = laneById(sources.plan, request.target);
  if (lane !== undefined || request.target.includes("+")) {
    const lanes = declaredLanes(sources.plan, request.target);
    return lanes.ok ? laneScope(sources, request, lanes.value) : lanes;
  }
  const paths = request.target.split(",").filter((path) => path !== "");
  const changes = pathChanges(sources.workspace, paths);
  const scope = { lane: undefined, base: undefined, changes, everything: false, build: false };
  return { ok: true, value: { ...scope, record: request.record, allTests: request.allTests } };
};

export const fullScopeOf = (sources: ScopeSources, request: FullRequest): Loaded<ScopeFacts> => {
  const lanes = request.laneId === undefined
    ? { ok: true as const, value: [] }
    : declaredLanes(sources.plan, request.laneId);
  if (!lanes.ok) {
    return lanes;
  }
  const lane = lanes.value[0];
  const base = baseFor(sources.repository, request.baseRef);
  if (!base.ok) {
    return base;
  }
  const changes = sources.repository.changesSince(base.value);
  const { build, record, allTests } = request;
  const everything = true;
  return {
    ok: true,
    value: {
      lane, lanes: lanes.value, base: base.value, changes, everything, build, record, allTests,
    },
  };
};

export const touches = (scope: GateScope, globs: readonly string[]): boolean => {
  const matches = globMatcher(globs);
  return scope.changes.some((change) => matches(change.path));
};
