import { composedPluginNames } from "./aidlc-config-diagnostics.ts";
import { loadScopeMetadataAll, loadStageGraphAll, pluginsEnabled } from "./aidlc-lib.ts";
import { resolveHarnessPath } from "./aidlc-runtime-paths.ts";

type PluginIdentity = { readonly plugin?: string };
type GraphEntry = PluginIdentity | null | undefined;

export interface PluginSelectionSources {
  stages: () => Iterable<GraphEntry> | null | undefined;
  scopes: () => Readonly<Record<string, PluginIdentity>>;
  composed: () => readonly string[];
  active: () => ReadonlySet<string> | null;
}

function installedPluginSources(): PluginSelectionSources {
  return {
    stages: loadStageGraphAll,
    scopes: loadScopeMetadataAll,
    composed: () => composedPluginNames(resolveHarnessPath(["tools", "data"])),
    active: pluginsEnabled,
  };
}

function stagePluginNames(stage: GraphEntry): readonly string[] | null {
  if (stage === null || stage === undefined) return null;
  try {
    return stage.plugin ? [stage.plugin] : [];
  } catch {
    return null;
  }
}

function nextGraphPluginNames(
  stages: Iterator<GraphEntry>,
  nextStage: Iterator<GraphEntry>["next"],
): IteratorResult<readonly string[]> {
  try {
    const step: IteratorResult<GraphEntry> = Reflect.apply(nextStage, stages, []);
    if (step === null || (typeof step !== "object" && typeof step !== "function") || step.done) {
      return { done: true, value: undefined };
    }
    const names = stagePluginNames(step.value);
    if (names !== null) return { done: false, value: names };
    // Entry access failed inside the original traversal body, which closes its iterator.
    stages.return?.();
  } catch {
    // A next() failure ends the traversal without a second close attempt.
  }
  return { done: true, value: undefined };
}

function graphPluginNames(sources: PluginSelectionSources): readonly string[] {
  try {
    const graph = sources.stages();
    if (graph === null || graph === undefined) return [];
    const stages = graph[Symbol.iterator]();
    const nextStage = stages.next;
    // Ending normally on a stale entry/read keeps already yielded identities.
    return Array.from({
      [Symbol.iterator]: () => ({ next: () => nextGraphPluginNames(stages, nextStage) }),
    }).flat();
  } catch {
    // Scope files still provide known plugin identities when the graph is stale.
    return [];
  }
}

export function knownPluginNames(sources: PluginSelectionSources = installedPluginSources()): string[] {
  return [...new Set([
    "aidlc",
    ...graphPluginNames(sources),
    ...Object.values(sources.scopes()).map((scope) => scope.plugin ?? "aidlc"),
    ...sources.composed(),
  ])].sort();
}

// The plugins the selection leaves off or pauses.
export function pluginsTurnedOff(sources: PluginSelectionSources = installedPluginSources()): string[] {
  const active = sources.active();
  if (active === null) return [];
  return knownPluginNames(sources).filter((name) => name !== "aidlc" && !active.has(name));
}
