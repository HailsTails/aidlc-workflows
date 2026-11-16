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
import { orderStages, routeStages } from "./stage-order.ts";

test("dependency order wins over an authored stage number", () => {
  expect(orderStages([
    { ...units, orderingHint: 1, requires: [requirements.slug] },
    { ...requirements, orderingHint: 9 },
  ])).toMatchObject({ ok: true, value: [
    { slug: "requirements-analysis" }, { slug: "units-generation" },
  ] });
});

test("duplicate edges do not strand a stage", () => {
  expect(orderStages([
    { ...units, requires: [requirements.slug, requirements.slug] }, requirements,
  ])).toMatchObject({ ok: true, value: [
    { slug: "requirements-analysis" }, { slug: "units-generation" },
  ] });
});

test("cycles refuse instead of returning a partial graph", () => {
  expect(orderStages([
    { ...units, requires: [requirements.slug] }, { ...requirements, requires: [units.slug] },
  ])).toMatchObject({ ok: false, refusal: [{ kind: "requires-cycle", stages: [
    "units-generation", "requirements-analysis",
  ] }] });
});

test("later-phase requirements cannot be numbered", () => {
  expect(orderStages([{ ...requirements, requires: [code.slug] }, code])).toMatchObject({
    ok: false, refusal: [{ kind: "invalid-file" }],
  });
});

test("a phase's per-unit stages form one block", () => {
  expect(routeStages([
    { ...requirements, cardinality: { kind: "per-unit" } }, units,
    { ...code, phase: "inception", cardinality: { kind: "per-unit" } },
  ])).toMatchObject([
    { slug: "requirements-analysis" }, { slug: "code-generation" }, { slug: "units-generation" },
  ]);
});
