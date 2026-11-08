import type { ScopeName, StageSlug } from "./identities.ts";
import type { Method } from "./method.ts";
import type { ScopeColumn } from "./stage-graph.ts";

const initializationStages = (method: Method): ReadonlySet<StageSlug> =>
  new Set(
    method.stages.filter((stage) => stage.phase === "initialization").map((stage) => stage.slug),
  );

const declaredMembers = (request: {
  readonly method: Method;
  readonly scope: ScopeName;
}): ReadonlySet<StageSlug> =>
  new Set(
    request.method.memberships
      .filter((membership) => membership.scope === request.scope)
      .map((membership) => membership.stage),
  );

export const scopeColumn = (request: {
  readonly method: Method;
  readonly scope: ScopeName;
}): ScopeColumn => {
  const always = initializationStages(request.method);
  const members = declaredMembers(request);
  return {
    scope: request.scope,
    stages: request.method.graph.nodes
      .filter((node) => always.has(node.stage) || (node.enabled && members.has(node.stage)))
      .map((node) => node.stage),
  };
};
