// Plugin identity union and off-selection semantics, with all readers injected.
import { expect, mock, test } from "bun:test";
import { knownPluginNames, pluginsTurnedOff } from "./aidlc-plugin-selection.ts";
import type { PluginSelectionSources } from "./aidlc-plugin-selection.ts";

const identityCases: {
  label: string;
  stages: ReturnType<PluginSelectionSources["stages"]>;
  scopes: ReturnType<PluginSelectionSources["scopes"]>;
  composed: readonly string[];
  expected: string[];
}[] = [
  { label: "empty installation keeps core", stages: [], scopes: {}, composed: [], expected: ["aidlc"] },
  { label: "graph identities deduplicate", stages: [{ plugin: "zeta" }, { plugin: "zeta" }, {}], scopes: {}, composed: [], expected: ["aidlc", "zeta"] },
  { label: "scope-only plugins remain visible", stages: [], scopes: { feature: { plugin: "scope-only" }, core: {} }, composed: [], expected: ["aidlc", "scope-only"] },
  { label: "sidecars retain plugins without stages or scopes", stages: [], scopes: {}, composed: ["theme", "theme"], expected: ["aidlc", "theme"] },
  { label: "all sources form one sorted union", stages: [{ plugin: "zeta" }, { plugin: "shared" }], scopes: { one: { plugin: "alpha" }, two: { plugin: "shared" } }, composed: ["beta", "zeta", "aidlc"], expected: ["aidlc", "alpha", "beta", "shared", "zeta"] },
  { label: "graph empty identities are ignored", stages: [{ plugin: "" }, { plugin: "aidlc" }], scopes: {}, composed: [], expected: ["aidlc"] },
  { label: "scope empty identities are retained", stages: [], scopes: { empty: { plugin: "" } }, composed: [], expected: ["", "aidlc"] },
  { label: "ordering uses ordinary string sort", stages: [{ plugin: "z" }, { plugin: "Alpha" }, { plugin: "ä" }], scopes: {}, composed: ["beta"], expected: ["Alpha", "aidlc", "beta", "z", "ä"] },
];

test.each(identityCases)("$label", ({ stages, scopes, composed, expected }) => {
  const sources: PluginSelectionSources = {
    stages: () => stages,
    scopes: () => scopes,
    composed: () => composed,
    active: () => null,
  };
  expect(knownPluginNames(sources)).toEqual(expected);
});

const selectionCases: { label: string; active: ReadonlySet<string> | null; expected: string[] }[] = [
  { label: "absent selection leaves every plugin on", active: null, expected: [] },
  { label: "empty selection turns off every non-core plugin", active: new Set<string>(), expected: ["alpha", "beta", "zeta"] },
  { label: "enabled plugins are omitted", active: new Set(["alpha", "zeta"]), expected: ["beta"] },
  { label: "core is never returned as off", active: new Set(["beta"]), expected: ["alpha", "zeta"] },
  { label: "unknown selections do not invent plugins", active: new Set(["unknown"]), expected: ["alpha", "beta", "zeta"] },
  { label: "all known plugins enabled leaves none off", active: new Set(["aidlc", "alpha", "beta", "zeta"]), expected: [] },
];
test.each(selectionCases)("$label", ({ active, expected }) => {
  expect(pluginsTurnedOff({
    stages: () => [{ plugin: "zeta" }],
    scopes: () => ({ feature: { plugin: "alpha" } }),
    composed: () => ["beta", "alpha"],
    active: () => active,
  })).toEqual(expected);
});

test("an absent selection does not read the installation", () => {
  const stages = mock<PluginSelectionSources["stages"]>().mockReturnValue([]);
  const scopes = mock<PluginSelectionSources["scopes"]>().mockReturnValue({});
  const composed = mock<PluginSelectionSources["composed"]>().mockReturnValue([]);
  const active = mock<PluginSelectionSources["active"]>().mockReturnValue(null);
  expect(pluginsTurnedOff({ stages, scopes, composed, active })).toEqual([]);
  expect(active).toHaveBeenCalledTimes(1);
  expect(stages).not.toHaveBeenCalled();
  expect(scopes).not.toHaveBeenCalled();
  expect(composed).not.toHaveBeenCalled();
});

test("identity discovery does not consult the enabled selection", () => {
  const active = mock<PluginSelectionSources["active"]>().mockReturnValue(new Set());
  expect(knownPluginNames({ stages: () => [], scopes: () => ({}), composed: () => [], active })).toEqual(["aidlc"]);
  expect(active).not.toHaveBeenCalled();
});

test("discovery leaves returned source collections unchanged", () => {
  const stages = Object.freeze([{ plugin: "zeta" }, { plugin: "alpha" }]);
  const scopes = Object.freeze({ feature: Object.freeze({ plugin: "beta" }) });
  const composed = Object.freeze(["zeta", "theme"]);
  expect(knownPluginNames({ stages: () => stages, scopes: () => scopes, composed: () => composed, active: () => null })).toEqual(["aidlc", "alpha", "beta", "theme", "zeta"]);
  expect(stages).toEqual([{ plugin: "zeta" }, { plugin: "alpha" }]);
  expect(scopes).toEqual({ feature: { plugin: "beta" } });
  expect(composed).toEqual(["zeta", "theme"]);
});


test.each([
  { label: "missing", graph: undefined },
  { label: "null", graph: null },
])("a $label graph leaves scope and sidecar discovery available", ({ graph }) => {
  expect(knownPluginNames({
    stages: () => graph,
    scopes: () => ({ feature: { plugin: "scope-only" } }),
    composed: () => ["theme"],
    active: () => null,
  })).toEqual(["aidlc", "scope-only", "theme"]);
});

test.each([
  { label: "missing", entry: undefined },
  { label: "null", entry: null },
])("a $label graph entry retains the prefix and stops later identities", ({ entry }) => {
  expect(knownPluginNames({
    stages: () => [{ plugin: "before" }, entry, { plugin: "after" }],
    scopes: () => ({ feature: { plugin: "scope-only" } }),
    composed: () => ["theme"],
    active: () => null,
  })).toEqual(["aidlc", "before", "scope-only", "theme"]);
});

test("a stale entry closes its iterator without consuming later entries", () => {
  const nextStage = mock<() => IteratorResult<{ plugin: string } | null>>()
    .mockReturnValueOnce({ done: false, value: { plugin: "before" } })
    .mockReturnValueOnce({ done: false, value: null })
    .mockReturnValueOnce({ done: false, value: { plugin: "after" } })
    .mockReturnValue({ done: true, value: undefined });
  const closeStages = mock<() => IteratorResult<{ plugin: string } | null>>()
    .mockReturnValue({ done: true, value: undefined });
  expect(knownPluginNames({
    stages: () => ({ [Symbol.iterator]: () => ({ next: nextStage, return: closeStages }) }),
    scopes: () => ({}),
    composed: () => [],
    active: () => null,
  })).toEqual(["aidlc", "before"]);
  expect(nextStage).toHaveBeenCalledTimes(2);
  expect(closeStages).toHaveBeenCalledTimes(1);
});
