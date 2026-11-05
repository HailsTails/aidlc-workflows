import { describe, expect, test } from "bun:test";
import { compileWorkflowCandidate, type WorkflowCompilationRequest } from "./aidlc-workflow-candidate.ts";
import { workflowGraphJson, workflowStageToGraph } from "./aidlc-workflow-wire.ts";

const minimalRequest: WorkflowCompilationRequest = {
  stageSources: [{ path: "operation/minimal.md", phase: "operation", text: `---
slug: minimal
phase: operation
execution: ALWAYS
condition: Always
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: []
consumes: []
requires_stage: []
inputs: none
outputs: none
---
# Minimal
` }],
  existingStages: [], knownAgents: ["aidlc-quality-agent", "aidlc-architect-agent"],
  rules: [], sensors: [], selectedPlugins: null, selectedScopeNames: null,
  installedScopeNames: [], composedRecords: {}, priorGridJson: null,
};

const reviewedRequest: WorkflowCompilationRequest = {
  ...minimalRequest,
  stageSources: [{ path: "operation/probe-review.md", phase: "operation", text: `---
slug: probe-review
number: 4.7
name: Probe review
plugin: probe
phase: operation
execution: CONDITIONAL
condition: When requested
lead_agent: aidlc-quality-agent
support_agents: [aidlc-architect-agent]
mode: subagent
for_each: unit-of-work
workspace_requires: false
produces: [review-report]
optional_produces: [optional-report]
produces_kinds:
  review-report: [service, library]
consumes:
  - artifact: existing-report
    required: true
    conditional_on: brownfield
  - artifact: planned-report
    required: false
    conditional_on: greenfield
  - artifact: shared-report
    required: false
requires_stage: []
sensors: [probe-gate, probe-write]
scopes: [probe-scope]
reviewer: aidlc-architect-agent
review_artifact: review-report
approval_mode: autonomous
summary_confirmation: required
inputs: existing-report
outputs: review-report
---
# Probe review
` }],
  rules: [{ path: "memory/org.md", scope: "org" }, { path: "memory/operation.md", scope: "phase", phase: "operation" }],
  sensors: [
    { id: "probe-write", path: ".codex/sensors/aidlc-probe-write.md", fireOn: "write", defaultSeverity: "advisory" },
    { id: "probe-gate", path: ".codex/sensors/aidlc-probe-gate.md", fireOn: "gate", defaultSeverity: "blocking", category: "code-quality", matches: "**/*.ts" },
  ],
  selectedPlugins: ["aidlc"],
};

const overriddenReviewSource = {
  path: "operation/probe-review.md", phase: "operation", text: `---
slug: probe-review
number: 4.7
name: Probe review
plugin: probe
phase: operation
execution: CONDITIONAL
condition: When requested
lead_agent: aidlc-quality-agent
support_agents: [aidlc-architect-agent]
mode: subagent
for_each: unit-of-work
workspace_requires: false
produces: [review-report]
optional_produces: [optional-report]
produces_kinds:
  review-report: [service, library]
consumes:
  - artifact: existing-report
    required: true
    conditional_on: brownfield
  - artifact: planned-report
    required: false
    conditional_on: greenfield
  - artifact: shared-report
    required: false
requires_stage: []
sensors: [probe-gate, probe-write]
scopes: [probe-scope]
reviewer: aidlc-architect-agent
review_artifact: review-report
reviewer_max_iterations: 5
review_class: advisory
approval_mode: autonomous
summary_confirmation: required
inputs: existing-report
outputs: review-report
---
# Probe review
`,
};

// Independent protocol bytes: no expected fields, ordering or defaults are
// obtained from production emitters, FIELD_ORDER, or compiled candidates.
const minimalJson = `[
  {
    "slug": "minimal",
    "number": "4.1",
    "name": "Minimal",
    "phase": "operation",
    "execution": "ALWAYS",
    "condition": "Always",
    "lead_agent": "aidlc-quality-agent",
    "support_agents": [],
    "mode": "inline",
    "produces": [],
    "consumes": [],
    "requires_stage": [],
    "sensors": [],
    "scopes": [],
    "inputs": "none",
    "outputs": "none",
    "rules_in_context": [],
    "sensors_applicable": []
  }
]
`;

const reviewedJson = `[
  {
    "slug": "probe-review",
    "number": "4.7",
    "name": "Probe review",
    "plugin": "probe",
    "enabled": false,
    "phase": "operation",
    "execution": "CONDITIONAL",
    "condition": "When requested",
    "lead_agent": "aidlc-quality-agent",
    "support_agents": [
      "aidlc-architect-agent"
    ],
    "mode": "subagent",
    "for_each": "unit-of-work",
    "workspace_requires": false,
    "produces": [
      "review-report"
    ],
    "optional_produces": [
      "optional-report"
    ],
    "produces_kinds": {
      "review-report": [
        "service",
        "library"
      ]
    },
    "consumes": [
      {
        "artifact": "existing-report",
        "required": true,
        "conditional_on": "brownfield"
      },
      {
        "artifact": "planned-report",
        "required": false,
        "conditional_on": "greenfield"
      },
      {
        "artifact": "shared-report",
        "required": false
      }
    ],
    "requires_stage": [],
    "sensors": [
      "probe-gate",
      "probe-write"
    ],
    "scopes": [
      "probe-scope"
    ],
    "reviewer": "aidlc-architect-agent",
    "review_artifact": "review-report",
    "reviewer_max_iterations": 2,
    "approval_mode": "autonomous",
    "review_class": "adversarial",
    "summary_confirmation": "required",
    "inputs": "existing-report",
    "outputs": "review-report",
    "rules_in_context": [
      {
        "path": "memory/org.md",
        "scope": "org"
      },
      {
        "path": "memory/operation.md",
        "scope": "phase"
      }
    ],
    "sensors_applicable": [
      {
        "id": "probe-gate",
        "path": ".codex/sensors/aidlc-probe-gate.md",
        "fire_on": "gate",
        "default_severity": "blocking",
        "category": "code-quality",
        "matches": "**/*.ts"
      },
      {
        "id": "probe-write",
        "path": ".codex/sensors/aidlc-probe-write.md",
        "fire_on": "write",
        "default_severity": "advisory"
      }
    ]
  }
]
`;

const emptyCollectionsJson = `[
  {
    "slug": "minimal",
    "number": "4.1",
    "name": "Minimal",
    "phase": "operation",
    "execution": "ALWAYS",
    "condition": "Always",
    "lead_agent": "aidlc-quality-agent",
    "support_agents": [],
    "mode": "inline",
    "workspace_requires": false,
    "produces": [],
    "optional_produces": [],
    "produces_kinds": {},
    "consumes": [],
    "requires_stage": [],
    "sensors": [],
    "scopes": [],
    "inputs": "none",
    "outputs": "none",
    "rules_in_context": [],
    "sensors_applicable": []
  }
]
`;

const compilerProperty = /"(?:leadAgent|supportAgents|forEach|workspaceRequirement|optionalProduces|producesKinds|requiresStage|reviewArtifact|reviewerMaxIterations|approvalMode|reviewClass|summaryConfirmation|rulesInContext|sensorsApplicable|conditionalOn|requirement|fireOn|defaultSeverity)":/u;

describe("workflow wire compatibility bytes", () => {
  test("omits unauthored policy fields while retaining parser-defaulted collections and final newline", () => {
    const candidate = compileWorkflowCandidate(minimalRequest);
    expect(candidate.json).toBe(minimalJson);
    expect(candidate.json).not.toMatch(compilerProperty);
    expect(Object.hasOwn(workflowStageToGraph(candidate.stages[0]), "reviewer")).toBe(false);
    expect(Object.hasOwn(workflowStageToGraph(candidate.stages[0]), "optional_produces")).toBe(false);
  });

  test("retains every authored protocol field, reviewer defaults and nested binding order", () => {
    const candidate = compileWorkflowCandidate(reviewedRequest);
    expect(candidate.json).toBe(reviewedJson);
    expect(candidate.json).not.toMatch(compilerProperty);
    expect(candidate.stages[0]).toMatchObject({ reviewerMaxIterations: 2, reviewClass: "adversarial", workspaceRequirement: "not-required",
      consumes: [
        { artifact: "existing-report", requirement: "required", conditionalOn: "brownfield" },
        { artifact: "planned-report", requirement: "optional", conditionalOn: "greenfield" },
        { artifact: "shared-report", requirement: "optional" },
      ],
      sensorsApplicable: [
        { id: "probe-gate", fireOn: "gate", defaultSeverity: "blocking", category: "code-quality", matches: "**/*.ts" },
        { id: "probe-write", fireOn: "write", defaultSeverity: "advisory" },
      ],
    });
  });

  test("keeps explicit empty collections and false flags distinct from absence", () => {
    const candidate = compileWorkflowCandidate(minimalRequest);
    const json = workflowGraphJson([{ ...candidate.stages[0], workspaceRequirement: "not-required",
      optionalProduces: [], producesKinds: {}, sensors: [], scopes: [],
    }]);
    expect(json).toBe(emptyCollectionsJson);
    expect(json).not.toMatch(compilerProperty);
  });

  test("does not create absent optional collection or condition keys at the wire boundary", () => {
    const candidate = compileWorkflowCandidate(minimalRequest);
    const graph = workflowStageToGraph({ ...candidate.stages[0], sensors: undefined, scopes: undefined, condition: undefined });
    expect(Object.hasOwn(graph, "sensors")).toBe(false);
    expect(Object.hasOwn(graph, "scopes")).toBe(false);
    expect(Object.hasOwn(graph, "condition")).toBe(false);
  });
});

describe("workflow reviewer policy overrides", () => {
  test("authored reviewer cap and class override defaults without changing wire names", () => {
    const candidate = compileWorkflowCandidate({ ...reviewedRequest, stageSources: [overriddenReviewSource] });
    expect(candidate.stages[0]).toMatchObject({ reviewerMaxIterations: 5, reviewClass: "advisory" });
    expect(candidate.json).toContain('"reviewer_max_iterations": 5,');
    expect(candidate.json).toContain('"review_class": "advisory",');
    expect(candidate.json).not.toContain('"reviewer_max_iterations": 2');
    expect(candidate.json).not.toMatch(compilerProperty);
  });
});
