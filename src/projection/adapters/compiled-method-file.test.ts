import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { distributionId, projectPath } from "../../kernel/values.ts";
import { compileCoreMethod } from "../../workflow-definition/domain/compile-core-method.ts";
import { scopeName, stageSlug } from "../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../workflow-definition/domain/method-source.ts";
import { serializeCompiledMethod } from "./compiled-method-file.ts";

const example = accept(stageSlug("example"));
const feature = accept(scopeName("feature"));
const coreMethod = accept(compileCoreMethod({
  stages: [{ slug: example,
    source: accept(methodSourcePath({ kind: "stage", within: "inception/example.md" })),
    displayName: "Example", phase: "inception", orderingHint: null, owner: { kind: "core" },
    execution: { trigger: "always", condition: "Feature request" },
    participation: { mode: "inline", lead: { kind: "conductor" }, supports: [] },
    cardinality: { kind: "once" }, workspace: "read-only", produces: [], consumes: [],
    requires: [], sensors: [], review: null, summaryConfirmation: "none",
    activation: { kind: "always" }, composerPrior: null, requiredSections: [],
    briefing: { inputs: "Intent", outputs: "Requirements", instructions: { text: "", headings: [] } },
  }],
  scopes: [{ name: feature,
    source: accept(methodSourcePath({ kind: "scope", within: "aidlc-feature.md" })),
    owner: { kind: "core" }, description: "Feature work", keywords: [], depth: "standard",
    testStrategy: null, runner: "generated", skeleton: "none", codebase: "new", guardPolicy: "off",
    ceremony: {}, reviewCap: null, guidance: "",
  }],
  memberships: [{ scope: feature, stage: example, declaredBy: { kind: "core" } }],
  freeformDefaults: [], agents: [], rules: [], sensors: [], knowledge: [], hooks: [],
}));
const request = { method: coreMethod,
  host: { distribution: accept(distributionId("claude")), directory: accept(projectPath(".claude")) },
  memoryRoot: accept(projectPath("aidlc/spaces/default/memory")),
};

test("the accepted Method translates to the existing runtime graph format", () => {
  const rendered = serializeCompiledMethod(request);
  expect(JSON.parse(rendered.graph)).toEqual(JSON.parse(`[
    { "slug": "example", "number": "2.1", "name": "Example", "phase": "inception",
      "execution": "ALWAYS", "condition": "Feature request", "lead_agent": "orchestrator",
      "support_agents": [], "mode": "inline", "produces": [], "consumes": [],
      "requires_stage": [], "sensors": [], "scopes": ["feature"],
      "inputs": "Intent", "outputs": "Requirements", "rules_in_context": [],
      "sensors_applicable": [] }
  ]`));
  expect(JSON.parse(rendered.grid)).toEqual({ feature: { stages: { example: "EXECUTE" } } });
});
