import { describe, expect, test } from "bun:test";
import { STAGE_RESERVED_KEYS, StageFileSchema, type StageFile } from "./stage-file.ts";

const codeGeneration: StageFile = {
  slug: "code-generation",
  phase: "construction",
  execution: "ALWAYS",
  condition: "Always executes for every unit in the execution plan.",
  lead_agent: "aidlc-developer-agent",
  support_agents: [],
  mode: "subagent",
  reviewer: "aidlc-architecture-reviewer-agent",
  review_artifact: "code-generation-plan",
  reviewer_max_iterations: 2,
  for_each: "unit-of-work",
  workspace_requires: true,
  produces: ["code-generation-plan", "unit-test-instructions", "code-summary", "traceability"],
  consumes: [
    { artifact: "functional-spec", required: false },
    { artifact: "unit-of-work", required: true },
    { artifact: "requirements", required: true },
  ],
  requires_stage: [
    "units-generation",
    "functional-design",
    "nfr-requirements",
    "nfr-design",
    "infrastructure-design",
  ],
  sensors: ["required-sections", "traceability"],
  scopes: ["enterprise", "feature", "mvp", "poc", "bugfix", "refactor", "classic", "express"],
  inputs: "ALL prior design artifacts for this unit",
  outputs: "application code + code-generation-plan.md, code-summary.md, traceability.json",
};

const requirementsAnalysis: StageFile = {
  slug: "requirements-analysis",
  phase: "inception",
  execution: "ALWAYS",
  condition: "Always executes — depth scales with project complexity",
  lead_agent: "aidlc-product-agent",
  support_agents: [],
  mode: "inline",
  summary_confirmation: "required",
  reviewer: "aidlc-product-lead-agent",
  review_artifact: "requirements",
  reviewer_max_iterations: 2,
  review_class: "advisory",
  produces: ["requirements", "requirements-analysis-questions"],
  optional_produces: ["traceability"],
  consumes: [
    { artifact: "intent-statement", required: false, cited: true },
    { artifact: "business-overview", required: false, conditional_on: "brownfield" },
  ],
  requires_stage: ["approval-handoff", "reverse-engineering"],
  sensors: ["required-sections", "upstream-coverage"],
  scopes: ["enterprise", "feature", "classic"],
  inputs: "RE artifacts (if brownfield), authoritative project description",
  outputs: "requirements.md, requirements-analysis-questions.md, traceability.json",
};

const functionalDesignKinds: StageFile = {
  ...codeGeneration,
  slug: "functional-design",
  produces: ["entities", "functional-spec"],
  optional_produces: ["frontend-components"],
  produces_kinds: {
    entities: ["service", "spec", "library"],
    "functional-spec": ["service", "spec", "ui", "library"],
    "frontend-components": ["ui"],
  },
};

const pluginStage: StageFile = {
  slug: "test-pro-integration",
  number: "3.85",
  name: "Cross-Unit Integration Testing",
  plugin: "test-pro",
  phase: "construction",
  execution: "CONDITIONAL",
  condition: "Execute once after build-and-test when the build spans more than one unit.",
  lead_agent: "aidlc-quality-agent",
  support_agents: ["test-pro-metrics-agent"],
  mode: "inline",
  produces: ["test-pro-integration-test-plan", "test-pro-integration-test-results"],
  consumes: [{ artifact: "build-and-test-summary", required: false }],
  requires_stage: ["build-and-test"],
  sensors: ["required-sections", "upstream-coverage"],
  scopes: ["enterprise", "feature", "test-pro-validation"],
  ars: { targets: ["ve", "r"], cost: 4 },
  inputs: "All per-unit build/test outputs and the regression suite from build-and-test",
  outputs: "test-pro-integration-test-plan.md, test-pro-integration-test-results.md",
};

describe("StageFileSchema", () => {
  test("reads a per-unit construction stage that writes to the workspace", () => {
    expect(StageFileSchema.parse(codeGeneration)).toEqual(codeGeneration);
  });

  test("reads a reviewed inception stage with cited and brownfield-only inputs", () => {
    expect(StageFileSchema.parse(requirementsAnalysis)).toEqual(requirementsAnalysis);
  });

  test("reads the unit kinds each artifact is produced for", () => {
    expect(StageFileSchema.parse(functionalDesignKinds)).toEqual(functionalDesignKinds);
  });

  test("reads a numbered plugin stage with a composer prior", () => {
    expect(StageFileSchema.parse(pluginStage)).toEqual(pluginStage);
  });

  test("refuses a misspelt key", () => {
    expect(
      StageFileSchema.safeParse({ ...codeGeneration, reviewr: "aidlc-product-lead-agent" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["reviewr"], path: [] }] },
    });
  });

  test("refuses a key reserved for a later mechanism", () => {
    expect(StageFileSchema.safeParse({ ...codeGeneration, on_failure: "retry" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["on_failure"], path: [] }] },
    });
  });

  test("refuses a misspelt key on a consumed artifact", () => {
    const stage = {
      ...codeGeneration,
      consumes: [{ artifact: "unit-of-work", required: true, citied: true }],
    };
    expect(StageFileSchema.safeParse(stage)).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["citied"], path: ["consumes", 0] }] },
    });
  });

  test("refuses an execution written in lower case", () => {
    expect(StageFileSchema.safeParse({ ...codeGeneration, execution: "always" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["execution"] }] },
    });
  });

  test("refuses a collaboration mode it does not know", () => {
    expect(StageFileSchema.safeParse({ ...codeGeneration, mode: "solo" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["mode"] }] },
    });
  });

  test("refuses a composer cost above five", () => {
    const stage = { ...pluginStage, ars: { targets: ["ve"], cost: 6 } };
    expect(StageFileSchema.safeParse(stage)).toMatchObject({
      success: false,
      error: { issues: [{ code: "too_big", path: ["ars", "cost"] }] },
    });
  });

  test("refuses an artifact produced for no unit kind", () => {
    const stage = { ...functionalDesignKinds, produces_kinds: { entities: [] } };
    expect(StageFileSchema.safeParse(stage)).toMatchObject({
      success: false,
      error: { issues: [{ code: "too_small", path: ["produces_kinds", "entities"] }] },
    });
  });
});

describe("STAGE_RESERVED_KEYS", () => {
  test("names the mechanism each reserved stage key waits for", () => {
    expect(STAGE_RESERVED_KEYS).toEqual({
      on_failure: "loop driver",
      blocks_on: "construction worktrees",
      timeout: "sensor binding",
      retry: "loop driver",
    });
  });
});
