import { globMatcher } from "../domain/glob.ts";
import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import { laneById, type Lane, type LanePlan } from "../domain/lane-plan.ts";
import type { FullRequest, ScopeRequest } from "./gate-request.ts";
import type { HeavySlot, Loaded, Repository, Workspace } from "./ports.ts";

export type ScopeFacts = {
  readonly lane: Lane | undefined;
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
  lane: Lane,
): Loaded<ScopeFacts> => {
  const base = baseFor(sources.repository, request.baseRef);
  if (!base.ok) {
    return base;
  }
  const changes = sources.repository.changesSince(base.value);
  const scope = { lane, base: base.value, changes, everything: false, build: false };
  return { ok: true, value: { ...scope, record: request.record, allTests: request.allTests } };
};

export const scopeOf = (sources: ScopeSources, request: ScopeRequest): Loaded<ScopeFacts> => {
  const lane = laneById(sources.plan, request.target);
  if (lane !== undefined) {
    return laneScope(sources, request, lane);
  }
  const paths = request.target.split(",").filter((path) => path !== "");
  const changes = pathChanges(sources.workspace, paths);
  const scope = { lane: undefined, base: undefined, changes, everything: false, build: false };
  return { ok: true, value: { ...scope, record: request.record, allTests: request.allTests } };
};

export const fullScopeOf = (sources: ScopeSources, request: FullRequest): Loaded<ScopeFacts> => {
  const lane = request.laneId === undefined ? undefined : laneById(sources.plan, request.laneId);
  if (request.laneId !== undefined && lane === undefined) {
    return unknownLane(sources.plan, request.laneId);
  }
  const base = baseFor(sources.repository, request.baseRef);
  if (!base.ok) {
    return base;
  }
  const changes = sources.repository.changesSince(base.value);
  const { build, record, allTests } = request;
  const everything = true;
  return {
    ok: true,
    value: { lane, base: base.value, changes, everything, build, record, allTests },
  };
};

export const touches = (scope: GateScope, globs: readonly string[]): boolean => {
  const matches = globMatcher(globs);
  return scope.changes.some((change) => matches(change.path));
};
