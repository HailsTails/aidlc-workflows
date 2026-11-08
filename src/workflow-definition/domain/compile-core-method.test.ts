import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { pluginId } from "./identities.ts";
import { artifact, scope, stage } from "../fixtures/identities.fixture.ts";

import { compileCoreMethod, numberStage } from "./compile-core-method.ts";
import type { CoreContent } from "./method.ts";
import type { Stage } from "./stage.ts";
import { stageNumber } from "./stage-graph.ts";

const requirements: Stage = {
  slug: stage("requirements-analysis"),
  source: methodSource({ kind: "stage", within: "inception/requirements-analysis.md" }),
  displayName: "Requirements Analysis", phase: "inception", orderingHint: null,
  owner: { kind: "core" }, execution: { trigger: "always", condition: "A feature request" },
  participation: { mode: "inline", lead: { kind: "conductor" }, supports: [] },
  cardinality: { kind: "once" }, workspace: "read-only",
  produces: [{ artifact: artifact("requirements"), obligation: "required", unitKinds: "all" }],
  consumes: [], requires: [], sensors: [], review: null, summaryConfirmation: "none",
  activation: { kind: "always" }, composerPrior: null, requiredSections: [],
  briefing: { inputs: "Intent", outputs: "Requirements", instructions: { text: "", headings: [] } },
};
const units: Stage = { ...requirements, slug: stage("units-generation"),
  source: methodSource({ kind: "stage", within: "inception/units-generation.md" }),
  produces: [{ artifact: artifact("units"), obligation: "required", unitKinds: "all" }],
};
const code: Stage = { ...requirements, slug: stage("code-generation"), phase: "construction",
  source: methodSource({ kind: "stage", within: "construction/code-generation.md" }),
  produces: [{ artifact: artifact("code"), obligation: "required", unitKinds: "all" }],
};
const core: CoreContent = { stages: [requirements, units, code], scopes: [],
  memberships: [], freeformDefaults: [], agents: [], sensors: [], rules: [], knowledge: [], hooks: [],
};
const number = (raw: string) => accept(stageNumber(raw));

test("fresh compilation assigns phase-local numbers", () => {
  expect(accept(compileCoreMethod(core)).graph).toEqual({ nodes: [
    { stage: stage("requirements-analysis"), number: number("2.1"), availability: "enabled",
      rulesInContext: [], activeSensors: [] },
    { stage: stage("units-generation"), number: number("2.2"), availability: "enabled",
      rulesInContext: [], activeSensors: [] },
    { stage: stage("code-generation"), number: number("3.1"), availability: "enabled",
      rulesInContext: [], activeSensors: [] },
  ] });
});

test("a dependency cycle never constructs an accepted Method", () => {
  expect(compileCoreMethod({ ...core, stages: [
    { ...requirements, requires: [units.slug] }, { ...units, requires: [requirements.slug] },
  ] })).toEqual({ ok: false, refusal: [{ kind: "requires-cycle",
    stages: [stage("requirements-analysis"), stage("units-generation")] }] });
});

test("per-unit regrouping cannot move a stage before its prerequisite", () => {
  expect(compileCoreMethod({ ...core, stages: [
    { ...requirements, cardinality: { kind: "per-unit" }, orderingHint: 1 },
    { ...units, orderingHint: 2 },
    { ...code, phase: "inception", cardinality: { kind: "per-unit" },
      requires: [units.slug], orderingHint: 3 },
  ] })).toEqual({ ok: false, refusal: [{ kind: "invalid-file",
    location: { kind: "method-source", owner: { kind: "core" },
      path: methodSource({ kind: "stage", within: "construction/code-generation.md" }) },
    issues: ["Stage code-generation requires a stage after its per-unit run block begins"],
  }] });
});

test("an invalid stage position is refused at the real stage source", () => {
  expect(numberStage({ stage: requirements, position: -1, rules: [] })).toEqual({
    ok: false,
    refusal: [{ kind: "invalid-file",
      location: { kind: "method-source", owner: { kind: "core" },
        path: methodSource({ kind: "stage", within: "inception/requirements-analysis.md" }) },
      issues: ["Stage requirements-analysis cannot be numbered at position -1 in phase inception"],
    }],
  });
});

test("compilation returns an unattributed membership without inventing a source", () => {
  expect(compileCoreMethod({ ...core, memberships: [{ scope: scope("missing-scope"),
    stage: stage("missing-stage"), declaredBy: { kind: "core" } }] })).toEqual({
    ok: false, refusal: [{ kind: "unattributed-membership", scope: scope("missing-scope"),
      stage: stage("missing-stage"), declaredBy: { kind: "core" } }],
  });
});

test("core admission still rejects a plugin-owned definition before minting a Method", () => {
  const claimed = { kind: "plugin" as const, plugin: accept(pluginId("extension")) };
  expect(compileCoreMethod({ ...core, stages: [{ ...requirements, owner: claimed }] }))
    .toEqual({ ok: false, refusal: [{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: requirements.source },
    issues: ["An authored core definition may not claim non-core ownership"] }] });
});
