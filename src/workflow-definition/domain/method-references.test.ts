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
import { validateArtifactProducers, validateCoreDuplicates,
  validateCoreReferences } from "./method-references.ts";

test("known references are accepted", () => {
  expect(validateCoreReferences(core)).toEqual([]);
});

test("repeated stage identities name both owning sources", () => {
  expect(validateCoreDuplicates({ ...core, stages: [requirements, requirements] }))
    .toMatchObject([{ kind: "duplicate", concept: "stage", name: "requirements-analysis",
      sources: [{ owner: { kind: "core" },
        path: "aidlc-common/stages/inception/requirements-analysis.md" },
      { owner: { kind: "core" }, path: "aidlc-common/stages/inception/requirements-analysis.md" }],
    }]);
});

test("repeating an output within one stage is not a second producer", () => {
  expect(validateArtifactProducers({ ...core, stages: [{ ...requirements, produces: [
    { artifact: artifact("requirements"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("requirements"), obligation: "required", unitKinds: "all" },
  ], consumes: [{ artifact: artifact("requirements"), obligation: "required",
    when: "always", citation: "uncited" }] }] })).toEqual([]);
});

test("two stages producing one consumed artifact are refused", () => {
  expect(validateArtifactProducers({ ...core, stages: [requirements, { ...units, produces: [
    { artifact: artifact("requirements"), obligation: "required", unitKinds: "all" },
  ], consumes: [{ artifact: artifact("requirements"), obligation: "required",
    when: "always", citation: "uncited" }] }] })).toMatchObject([
    { kind: "duplicate", concept: "artifact", name: "requirements" },
  ]);
});
