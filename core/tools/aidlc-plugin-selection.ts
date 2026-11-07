import { composedPluginNames } from "./aidlc-config-diagnostics.ts";
import { loadScopeMetadataAll, loadStageGraphAll, pluginsEnabled } from "./aidlc-lib.ts";
import { resolveHarnessPath } from "./aidlc-runtime-paths.ts";

export function knownPluginNames(): string[] {
  const names = new Set<string>(["aidlc"]);
  try {
    for (const stage of loadStageGraphAll()) {
      if (stage.plugin) names.add(stage.plugin);
    }
  } catch {
    // Scope files still provide known plugin identities when the graph is stale.
  }
  for (const meta of Object.values(loadScopeMetadataAll())) {
    names.add(meta.plugin ?? "aidlc");
  }
  for (const name of composedPluginNames(resolveHarnessPath(["tools", "data"]))) {
    names.add(name);
  }
  return [...names].sort();
}

// The plugins the selection leaves off or pauses.
export function pluginsTurnedOff(): string[] {
  const active = pluginsEnabled();
  if (active === null) return [];
  return knownPluginNames().filter((name) => name !== "aidlc" && !active.has(name));
}
