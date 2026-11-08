import { expect, test } from "bun:test";
import type { Stage } from "./stage.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { artifact, stage } from "../fixtures/identities.fixture.ts";

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
import type { CoreContent } from "./method.ts";
const core: CoreContent = { stages: [requirements, units, code], scopes: [],
  memberships: [], freeformDefaults: [], agents: [], sensors: [], rules: [], knowledge: [], hooks: [],
};
import { compileCoreMethod } from "./compile-core-method.ts";

test("fresh compilation assigns phase-local numbers", () => {
  const compilation = compileCoreMethod(core);
  expect(compilation).toMatchObject({ ok: true, value: { graph: { nodes: [
    { stage: "requirements-analysis", number: "2.1", availability: "enabled" },
    { stage: "units-generation", number: "2.2", availability: "enabled" },
    { stage: "code-generation", number: "3.1", availability: "enabled" },
  ] } } });
});

test("a dependency cycle never constructs an accepted Method", () => {
  expect(compileCoreMethod({ ...core, stages: [
    { ...requirements, requires: [units.slug] }, { ...units, requires: [requirements.slug] },
  ] })).toMatchObject({ ok: false, refusal: [{ kind: "requires-cycle",
    stages: ["requirements-analysis", "units-generation"] }] });
});

test("per-unit regrouping cannot move a stage before its prerequisite", () => {
  expect(compileCoreMethod({ ...core, stages: [
    { ...requirements, cardinality: { kind: "per-unit" }, orderingHint: 1 },
    { ...units, orderingHint: 2 },
    { ...code, phase: "inception", cardinality: { kind: "per-unit" },
      requires: [units.slug], orderingHint: 3 },
  ] })).toMatchObject({ ok: false, refusal: [{ kind: "invalid-file",
    issues: ["Stage code-generation requires a stage after its per-unit run block begins"],
  }] });
});
