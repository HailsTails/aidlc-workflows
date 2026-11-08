import { describe, expect, test } from "bun:test";
import { STAGE_RESERVED_KEYS, StageFileSchema } from "./stage-file.ts";

const CODE_GENERATION = `{
  "slug": "code-generation", "execution": "ALWAYS",
  "condition": "Always executes for every unit in the execution plan.",
  "mode": "subagent", "lead_agent": "aidlc-developer-agent", "support_agents": [],
  "reviewer": "aidlc-architecture-reviewer-agent", "review_artifact": "code-generation-plan",
  "sensors": ["required-sections", "traceability"], "reviewer_max_iterations": 2,
  "scopes": ["enterprise", "feature", "mvp", "poc", "bugfix", "refactor", "classic"],
  "inputs": "ALL prior design artifacts for this unit", "for_each": "unit-of-work",
  "outputs": "code-generation-plan.md, code-summary.md", "workspace_requires": true,
  "produces": ["code-generation-plan", "unit-test-instructions", "code-summary", "traceability"],
  "consumes": [
    { "artifact": "functional-spec", "required": false },
    { "artifact": "unit-of-work", "required": true },
    { "artifact": "requirements", "required": true }
  ],
  "phase": "construction", "requires_stage": [
    "units-generation", "functional-design", "nfr-requirements", "nfr-design",
    "infrastructure-design"
  ]
}`;

const REQUIREMENTS_ANALYSIS = `{
  "slug": "requirements-analysis", "phase": "inception", "review_class": "advisory",
  "condition": "Always executes — depth scales with project complexity", "support_agents": [],
  "execution": "ALWAYS", "mode": "inline", "lead_agent": "aidlc-product-agent",
  "reviewer": "aidlc-product-lead-agent", "review_artifact": "requirements",
  "sensors": ["required-sections", "upstream-coverage"], "reviewer_max_iterations": 2,
  "scopes": ["enterprise", "feature", "classic"], "requires_stage": ["approval-handoff"],
  "produces": ["requirements", "requirements-analysis-questions"],
  "outputs": "requirements.md, traceability.json", "optional_produces": ["traceability"],
  "inputs": "RE artifacts (if brownfield)", "summary_confirmation": "required",
  "consumes": [
    { "artifact": "intent-statement", "required": false, "cited": true },
    { "artifact": "business-overview", "required": false, "conditional_on": "brownfield" }
  ]
}`;

const FUNCTIONAL_DESIGN = `{
  "slug": "functional-design", "phase": "construction", "mode": "inline",
  "condition": "New data models or business rules need design.", "support_agents": [],
  "execution": "CONDITIONAL", "for_each": "unit-of-work",
  "consumes": [{ "artifact": "unit-of-work", "required": true }], "requires_stage": [],
  "produces": ["entities", "functional-spec"], "optional_produces": ["frontend-components"],
  "inputs": "Unit of work", "produces_kinds": {
    "entities": ["service", "spec", "library"],
    "functional-spec": ["service", "spec", "ui", "library"],
    "frontend-components": ["ui"]
  },
  "outputs": "entities.md, functional-spec.md", "lead_agent": "aidlc-architect-agent"
}`;

const PLUGIN_STAGE = `{
  "slug": "test-pro-integration", "number": "3.85", "plugin": "test-pro",
  "name": "Cross-Unit Integration Testing", "phase": "construction", "execution": "CONDITIONAL",
  "condition": "Execute once after build-and-test when the build spans more than one unit.",
  "mode": "inline", "lead_agent": "aidlc-quality-agent",
  "inputs": "All per-unit build/test outputs", "support_agents": ["test-pro-metrics-agent"],
  "produces": ["test-pro-integration-test-plan", "test-pro-integration-test-results"],
  "consumes": [{ "artifact": "build-and-test-summary", "required": false }],
  "sensors": ["required-sections", "upstream-coverage"], "requires_stage": ["build-and-test"],
  "scopes": ["enterprise", "feature", "test-pro-validation"],
  "ars": { "targets": ["ve", "r"], "cost": 4 },
  "outputs": "test-pro-integration-test-plan.md, test-pro-integration-test-results.md"
}`;

const READABLE_STAGES = [
  { shape: "a per-unit construction stage that writes to the workspace", text: CODE_GENERATION },
  {
    shape: "a reviewed inception stage with cited and brownfield-only inputs",
    text: REQUIREMENTS_ANALYSIS,
  },
  { shape: "the unit kinds each artifact is produced for", text: FUNCTIONAL_DESIGN },
  { shape: "a numbered plugin stage with a composer prior", text: PLUGIN_STAGE },
];

const STAGE_BASICS = `
  "slug": "code-generation", "phase": "construction", "condition": "Always executes.",
  "inputs": "Design", "outputs": "Code", "lead_agent": "aidlc-developer-agent",
  "produces": ["code-summary"], "support_agents": [], "requires_stage": []`;

const VALID_STAGE_FIELDS = `${STAGE_BASICS},
  "execution": "ALWAYS", "mode": "inline", "consumes": []`;

const REFUSED_STAGES = [
  {
    shape: "a misspelt key",
    text: `{${VALID_STAGE_FIELDS}, "reviewr": "aidlc-product-lead-agent" }`,
    issues: [{ code: "unrecognized_keys", keys: ["reviewr"], path: [] }],
  },
  {
    shape: "a key reserved for a later mechanism",
    text: `{${VALID_STAGE_FIELDS}, "on_failure": "retry" }`,
    issues: [{ code: "unrecognized_keys", keys: ["on_failure"], path: [] }],
  },
  {
    shape: "a misspelt key on a consumed artifact",
    text: `{${STAGE_BASICS}, "execution": "ALWAYS", "mode": "inline",
      "consumes": [{ "artifact": "unit-of-work", "required": true, "citied": true }] }`,
    issues: [{ code: "unrecognized_keys", keys: ["citied"], path: ["consumes", 0] }],
  },
  {
    shape: "an execution written in lower case",
    text: `{${STAGE_BASICS}, "execution": "always", "mode": "inline", "consumes": [] }`,
    issues: [{ code: "invalid_value", path: ["execution"] }],
  },
  {
    shape: "a collaboration mode it does not know",
    text: `{${STAGE_BASICS}, "execution": "ALWAYS", "mode": "solo", "consumes": [] }`,
    issues: [{ code: "invalid_value", path: ["mode"] }],
  },
  {
    shape: "a composer cost above five",
    text: `{${VALID_STAGE_FIELDS}, "ars": { "targets": ["ve"], "cost": 6 } }`,
    issues: [{ code: "too_big", path: ["ars", "cost"] }],
  },
  {
    shape: "an artifact produced for no unit kind",
    text: `{${VALID_STAGE_FIELDS}, "produces_kinds": { "entities": [] } }`,
    issues: [{ code: "too_small", path: ["produces_kinds", "entities"] }],
  },
];

const RESERVED_KEYS = `{
  "retry": "loop driver", "on_failure": "loop driver",
  "timeout": "sensor binding", "blocks_on": "construction worktrees"
}`;

describe("StageFileSchema", () => {
  test.each(READABLE_STAGES)("reads $shape", ({ text }) => {
    expect(StageFileSchema.parse(JSON.parse(text))).toEqual(JSON.parse(text));
  });

  test.each(REFUSED_STAGES)("refuses $shape", ({ text, issues }) => {
    expect(StageFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});

describe("STAGE_RESERVED_KEYS", () => {
  test("names the mechanism each reserved stage key waits for", () => {
    expect(STAGE_RESERVED_KEYS).toEqual(JSON.parse(RESERVED_KEYS));
  });
});
