import { expect, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { distributionId, projectPath } from "../../kernel/values.ts";
import { compileCoreMethod } from "../../workflow-definition/domain/compile-core-method.ts";
import { pluginId, scopeName, stageSlug } from "../../workflow-definition/domain/identities.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { methodSourcePath } from "../../workflow-definition/domain/method-source.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import { stageNumber } from "../../workflow-definition/domain/stage-graph.ts";
import { agent, artifact, rule, sensor } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { CompiledGraphFileSchema, CompiledScopeGridFileSchema,
  serializeCompiledMethod } from "./compiled-method-file.ts";

const example = accept(stageSlug("example"));
const feature = accept(scopeName("feature"));
const exampleStage: Stage = {
  slug: example,
  source: accept(methodSourcePath({ kind: "stage", within: "inception/example.md" })),
  displayName: "Example", phase: "inception", orderingHint: null, owner: { kind: "core" },
  execution: { trigger: "always", condition: "Feature request" },
  participation: { mode: "inline", lead: { kind: "conductor" }, supports: [] },
  cardinality: { kind: "once" }, workspace: "read-only", produces: [], consumes: [],
  requires: [], sensors: [], review: null, summaryConfirmation: "none",
  activation: { kind: "always" }, composerPrior: null, requiredSections: [],
  briefing: { inputs: "Intent", outputs: "Requirements", instructions: { text: "", headings: [] } },
};
const coreMethod = accept(compileCoreMethod({
  stages: [exampleStage],
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
const BASIC_GRAPH = `[
  {
    "slug": "example",
    "number": "2.1",
    "name": "Example",
    "phase": "inception",
    "execution": "ALWAYS",
    "condition": "Feature request",
    "lead_agent": "orchestrator",
    "support_agents": [],
    "mode": "inline",
    "produces": [],
    "consumes": [],
    "requires_stage": [],
    "sensors": [],
    "scopes": [
      "feature"
    ],
    "inputs": "Intent",
    "outputs": "Requirements",
    "rules_in_context": [],
    "sensors_applicable": []
  }
]
`;
const BASIC_GRID = `{
  "feature": {
    "stages": {
      "example": "EXECUTE"
    }
  }
}
`;
const detailedStage: Stage = { ...exampleStage,
  owner: { kind: "plugin", plugin: accept(pluginId("test-pro")) },
  execution: { trigger: "conditional", condition: "Feature request" },
  participation: { mode: "pipeline", lead: { kind: "agent", agent: agent("author") },
    supports: [agent("support")] },
  cardinality: { kind: "per-unit" }, workspace: "writes",
  produces: [
    { artifact: artifact("requirements"), obligation: "required", unitKinds: ["service", "ui"] },
    { artifact: artifact("notes"), obligation: "optional", unitKinds: "all" },
  ],
  consumes: [
    { artifact: artifact("intent"), obligation: "required", when: "always", citation: "cited" },
    { artifact: artifact("context"), obligation: "optional", when: "brownfield", citation: "uncited" },
  ],
  requires: [], sensors: [sensor("check")],
  composerPrior: { targets: ["iae", "ve"], cost: 2, role: "core", projectTypes: ["brownfield"] },
  review: { reviewer: agent("reviewer"), artifact: artifact("requirements"),
    maxIterations: 2, reviewClass: "advisory" },
  summaryConfirmation: "required",
};
const detailedMethod = brand<Method>({ ...coreMethod,
  stages: [detailedStage], installedPlugins: [accept(pluginId("test-pro"))],
  selection: { kind: "only", core: "included", plugins: [] },
  graph: { nodes: [{ stage: example, number: accept(stageNumber("2.1")), availability: "disabled",
    rulesInContext: [rule("org")], activeSensors: [sensor("check")] }] },
  rules: [{ id: rule("org"), source: methodSource({ kind: "rule", within: "org.md" }),
    layer: { kind: "org" }, owner: { kind: "core" }, pairing: { kind: "unpaired" },
    status: null, staleAfter: null, text: "Rules" }],
  sensors: [{ id: sensor("check"), source: methodSource({ kind: "sensor", within: "aidlc-check.md" }),
    owner: { kind: "core" }, description: "A check", category: "quality", command: "check",
    severity: "blocking", firesOn: "gate", matches: "*.ts", timeoutSeconds: null,
    input: {}, output: {} }],
});
const DETAILED_GRAPH = `[
  {
    "slug": "example",
    "number": "2.1",
    "name": "Example",
    "plugin": "test-pro",
    "enabled": false,
    "phase": "inception",
    "execution": "CONDITIONAL",
    "condition": "Feature request",
    "lead_agent": "author",
    "support_agents": [
      "support"
    ],
    "mode": "pipeline",
    "for_each": "unit-of-work",
    "workspace_requires": true,
    "produces": [
      "requirements"
    ],
    "optional_produces": [
      "notes"
    ],
    "produces_kinds": {
      "requirements": [
        "service",
        "ui"
      ]
    },
    "consumes": [
      {
        "artifact": "intent",
        "required": true
      },
      {
        "artifact": "context",
        "required": false,
        "conditional_on": "brownfield"
      }
    ],
    "cites": [
      "intent"
    ],
    "requires_stage": [],
    "sensors": [
      "check"
    ],
    "scopes": [
      "feature"
    ],
    "ars": {
      "targets": [
        "iae",
        "ve"
      ],
      "cost": 2,
      "role": "core",
      "project_types": [
        "brownfield"
      ]
    },
    "reviewer": "reviewer",
    "review_artifact": "requirements",
    "reviewer_max_iterations": 2,
    "review_class": "advisory",
    "summary_confirmation": "required",
    "inputs": "Intent",
    "outputs": "Requirements",
    "rules_in_context": [
      {
        "path": "aidlc/spaces/default/memory/org.md",
        "scope": "org"
      }
    ],
    "sensors_applicable": [
      {
        "id": "check",
        "path": ".claude/sensors/aidlc-check.md",
        "fire_on": "gate",
        "default_severity": "blocking",
        "category": "quality",
        "matches": "*.ts"
      }
    ]
  }
]
`;
const DISABLED_GRID = `{
  "feature": {
    "stages": {
      "example": "SKIP"
    }
  }
}
`;

test("the accepted Method preserves exact graph and grid bytes with absent optional fields", () => {
  expect(serializeCompiledMethod(request)).toEqual({ graph: BASIC_GRAPH, grid: BASIC_GRID });
});

test("plugin availability and all optional metadata retain their literal serialized bytes", () => {
  expect(serializeCompiledMethod({ ...request, method: detailedMethod }))
    .toEqual({ graph: DETAILED_GRAPH, grid: DISABLED_GRID });
});

test("the graph schema accepts the minimal compiled file", () => {
  expect(CompiledGraphFileSchema.safeParse(JSON.parse(BASIC_GRAPH)).success).toBe(true);
});

test("the graph schema accepts the detailed compiled file", () => {
  expect(CompiledGraphFileSchema.safeParse(JSON.parse(DETAILED_GRAPH)).success).toBe(true);
});

test("the graph schema rejects metadata that does not match the file format", () => {
  expect(CompiledGraphFileSchema.safeParse(JSON.parse(
        `[{ "slug": "example", "number": "2.1", "name": "Example", "phase": "inception",
      "execution": "ALWAYS", "condition": "Feature request", "lead_agent": "orchestrator",
      "support_agents": [], "mode": "inline", "produces": [], "consumes": [],
      "requires_stage": [], "sensors": [], "scopes": ["feature"],
      "inputs": "Intent", "outputs": "Requirements", "rules_in_context": [],
      "sensors_applicable": [], "reviewer_max_iterations": "two" }]`,
  )).success).toBe(false);
});

test("the grid schema accepts execution and skip decisions", () => {
  expect(CompiledScopeGridFileSchema.safeParse(JSON.parse(BASIC_GRID)).success).toBe(true);
  expect(CompiledScopeGridFileSchema.safeParse(JSON.parse(DISABLED_GRID)).success).toBe(true);
});

test("the grid schema rejects an unknown execution decision", () => {
  expect(CompiledScopeGridFileSchema.safeParse({ feature: { stages: { example: "MAYBE" } } })
    .success).toBe(false);
});

test("stage pairing follows the graph rather than the definition array order", () => {
  expect(serializeCompiledMethod({ ...request, method: brand<Method>({ ...coreMethod,
    stages: [{ ...exampleStage, slug: accept(stageSlug("not-in-graph")) }, exampleStage],
  }) })).toEqual({ graph: BASIC_GRAPH, grid: BASIC_GRID });
});
