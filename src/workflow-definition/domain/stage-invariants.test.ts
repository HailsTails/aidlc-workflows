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

import { agent } from "../fixtures/identities.fixture.ts";
import { validateStage } from "./stage-invariants.ts";
const reviewed: Stage = { ...requirements, review: { reviewer: agent("aidlc-product-agent"),
  artifact: artifact("requirements"), maxIterations: 2, reviewClass: "advisory" } };

test("a valid reviewed stage passes its own invariants", () => {
  expect(validateStage(reviewed)).toEqual([]);
});

test("a review cannot target an optional production", () => {
  expect(validateStage({ ...reviewed, produces: [{ artifact: artifact("requirements"),
    obligation: "optional", unitKinds: "all" }] })).toMatchObject([{ kind: "invalid-file",
    issues: ["The review artifact must be a required production"] }]);
});
