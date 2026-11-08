import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { Contribution } from "./contribution.ts";
import { pluginId } from "./identities.ts";
import { prepareContributions } from "./plugin-selection.ts";

const id = (raw: string) => accept(pluginId(raw));
const base: Contribution = { plugin: id("base"), version: "1", description: "A base contribution",
  dependsOn: [{ kind: "core" }], rulesLevel: "team", overlays: [],
  content: { stages: [], agents: [], scopes: [], sensors: [], rules: [], knowledge: [],
    memberships: [], freeformDefaults: [] }, tools: { scripts: [], doctorCheck: null, commands: [] } };
const extension: Contribution = { ...base, plugin: id("extension"),
  dependsOn: [{ kind: "plugin", plugin: base.plugin }] };

test("a requested extension selects its base first without changing the requested set", () => {
  const selection = { kind: "only" as const, core: "excluded" as const,
    plugins: [extension.plugin] };
  expect(prepareContributions({ contributions: [extension, base], selection })).toEqual({ ok: true,
    value: { ordered: [base, extension], selected: [extension.plugin, base.plugin] } });
  expect(selection.plugins).toEqual([extension.plugin]);
});

test("missing dependencies are refused with the actual dependent identity", () => {
  expect(prepareContributions({ contributions: [extension], selection: { kind: "every-installed" } }))
    .toEqual({ ok: false, refusal: [{ kind: "missing-dependency",
      plugin: extension.plugin, needs: base.plugin }] });
});

test("a dependency cycle refuses every cycle member rather than yielding a partial order", () => {
  const cyclic = { ...base, dependsOn: [{ kind: "plugin" as const, plugin: extension.plugin }] };
  expect(prepareContributions({ contributions: [extension, cyclic],
    selection: { kind: "every-installed" } })).toEqual({ ok: false, refusal: [
    { kind: "invalid-file", location: { kind: "plugin-manifest", plugin: "extension" },
      issues: ["Plugin dependencies form a cycle."] },
    { kind: "invalid-file", location: { kind: "plugin-manifest", plugin: "base" },
      issues: ["Plugin dependencies form a cycle."] },
  ] });
});

test("an absent selected plugin is refused without inventing a source file", () => {
  expect(prepareContributions({ contributions: [base], selection: {
    kind: "only", core: "included", plugins: [id("missing")] } })).toEqual({ ok: false,
    refusal: [{ kind: "invalid-file", location: { kind: "plugin-manifest", plugin: "missing" },
      issues: ["Selected plugin is not installed."] }] });
});

test("the core namespace cannot be an installed plugin identity", () => {
  expect(prepareContributions({ contributions: [{ ...base, plugin: id("aidlc") }],
    selection: { kind: "every-installed" } })).toEqual({ ok: false,
    refusal: [{ kind: "core-namespace-claimed", plugin: "aidlc" }] });
});
