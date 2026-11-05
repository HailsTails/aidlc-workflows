import { describe, expect, test } from "bun:test";
import {
  compileWorkflowCandidate, composedFoldBack, mergeComposedScopes, transposeScopeGrid,
  type WorkflowCompilationRequest,
} from "./aidlc-workflow-candidate.ts";

const emptyRequest: WorkflowCompilationRequest = {
  stageSources: [], existingStages: [], knownAgents: ["aidlc-quality-agent"],
  rules: [], sensors: [], selectedPlugins: null, selectedScopeNames: null,
  installedScopeNames: ["legacy-plan"], composedRecords: {}, priorGridJson: null,
};

interface OperationSourceOptions {
  dependencies?: string;
  authoredFields?: string;
  path?: string;
}

function operationSource(slug: string, options: OperationSourceOptions = {}) {
  const { dependencies = "", authoredFields = "", path = `operation/${slug}.md` } = options;
  return { path, phase: "operation", text: `---
slug: ${slug}
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: []
consumes: []
requires_stage: [${dependencies}]
scopes: [baseline]
sensors: []
${authoredFields}
---
# Stage
` };
}

// Literal observations from the C1b compiler, not stricter plan validation.
describe("legacy scope-grid compatibility", () => {
  test.each([
    { caseName: "null stages", priorGridJson: '{"legacy-plan":{"stages":null}}', expectedGrid: { "legacy-plan": { stages: null } } },
    { caseName: "empty array stages", priorGridJson: '{"legacy-plan":{"stages":[]}}', expectedGrid: { "legacy-plan": { stages: [] } } },
    { caseName: "array cells", priorGridJson: '{"legacy-plan":{"stages":["EXECUTE",false]}}', expectedGrid: { "legacy-plan": { stages: ["EXECUTE", false] } } },
    { caseName: "arbitrary cells", priorGridJson: '{"legacy-plan":{"stages":{"a":7,"b":false,"c":null,"d":"MAYBE","e":{"x":1}}}}',
      expectedGrid: { "legacy-plan": { stages: { a: 7, b: false, c: null, d: "MAYBE", e: { x: 1 } } } } },
    { caseName: "extra entry field", priorGridJson: '{"legacy-plan":{"stages":{},"extra":7}}', expectedGrid: { "legacy-plan": { stages: {}, extra: 7 } } },
  ] as const)("preserves $caseName without claiming valid cells", ({ priorGridJson, expectedGrid }) => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest, priorGridJson });
    expect(candidate.grid).toEqual(expectedGrid);
    expect(candidate.composedScopes).toEqual({ names: ["legacy-plan"], recordNames: [], gridOnlyNames: ["legacy-plan"] });
    expect(mergeComposedScopes({ fresh: {}, onDiskJson: priorGridJson, preserveNames: new Set(["legacy-plan"]) })).toEqual(expectedGrid);
  });

  test.each([
    '{"legacy-plan":null}', '{"legacy-plan":[]}', '{"legacy-plan":{}}',
    '{"legacy-plan":{"stages":"EXECUTE"}}', '{"legacy-plan":{"stages":7}}',
  ])("retains migration names when the entry cannot supply a column: %s", (priorGridJson) => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest, priorGridJson });
    expect(candidate.grid).toEqual({});
    expect(candidate.composedScopes).toEqual({ names: ["legacy-plan"], recordNames: [], gridOnlyNames: ["legacy-plan"] });
    expect(composedFoldBack({ records: {}, onDiskJson: priorGridJson, stockScopeNames: new Set(), installedScopeNames: new Set(["legacy-plan"]) }).json).toBe("{}");
  });

  test.each([null, "", "{bad", "null", "[]", "7", '"legacy-plan"'])
  ("ignores invalid roots while preserving the fresh object: %s", (priorGridJson) => {
    const fresh = { zulu: { stages: {} }, alpha: { stages: {} } };
    const candidate = compileWorkflowCandidate({ ...emptyRequest, priorGridJson });
    expect(candidate.grid).toEqual({});
    expect(candidate.composedScopes).toEqual({ names: [], recordNames: [], gridOnlyNames: [] });
    expect(mergeComposedScopes({ fresh, onDiskJson: priorGridJson })).toBe(fresh);
    expect(JSON.stringify(fresh)).toBe('{"zulu":{"stages":{}},"alpha":{"stages":{}}}');
  });

  test("a valid empty root still canonicalizes fresh scope order", () => {
    const fresh = { zulu: { stages: {} }, alpha: { stages: {} } };
    expect(JSON.stringify(mergeComposedScopes({ fresh, onDiskJson: "{}" }))).toBe('{"alpha":{"stages":{}},"zulu":{"stages":{}}}');
  });

  test("records win, stock remains fresh, grid-only survives, and orphans stay absent", () => {
    const candidate = compileWorkflowCandidate({
      ...emptyRequest, stageSources: [operationSource("alpha")],
      installedScopeNames: ["baseline", "legacy-plan", "older-plan"],
      composedRecords: {
        "legacy-plan": { name: "legacy-plan", identity: "# Legacy\n", stages: { alpha: "SKIP" } },
        baseline: { name: "baseline", identity: "# Stock\n", stages: { alpha: "SKIP" } },
        orphan: { name: "orphan", identity: "# Orphan\n", stages: { alpha: "EXECUTE" } },
      },
      priorGridJson: '{"legacy-plan":{"stages":{"alpha":"EXECUTE"}},"baseline":{"stages":{"alpha":"SKIP"}},"older-plan":{"stages":{"alpha":"SKIP"}},"orphan":{"stages":{"alpha":"EXECUTE"}}}',
    });
    expect(candidate.grid).toEqual({
      baseline: { stages: { alpha: "EXECUTE" } },
      "legacy-plan": { stages: { alpha: "SKIP" } },
      "older-plan": { stages: { alpha: "SKIP" } },
    });
    expect(candidate.composedScopes).toEqual({
      names: ["legacy-plan", "older-plan"], recordNames: ["legacy-plan"], gridOnlyNames: ["older-plan"],
    });
  });
});

describe("graph dependency ordering and refusal compatibility", () => {
  test("independent new stages seed by slug rather than source order", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest, stageSources: [operationSource("zulu"), operationSource("alpha")] });
    expect(candidate.stages).toMatchObject([
      { slug: "alpha", number: "4.1", name: "Alpha", requiresStage: [] },
      { slug: "zulu", number: "4.2", name: "Zulu", requiresStage: [] },
    ]);
    expect(candidate.grid).toEqual({ baseline: { stages: { alpha: "EXECUTE", zulu: "EXECUTE" } } });
  });

  test("new stages seed by edges and duplicate dependencies collapse", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("assemble", { dependencies: "middle, middle" }), operationSource("middle", { dependencies: "zstart" }), operationSource("zstart")],
    });
    expect(candidate.stages).toMatchObject([
      { slug: "zstart", number: "4.1", requiresStage: [] },
      { slug: "middle", number: "4.2", requiresStage: ["zstart"] },
      { slug: "assemble", number: "4.3", requiresStage: ["middle"] },
    ]);
  });

  test("cycle refusal includes downstream stages in their source order", () => {
    expect(() => compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("tail", { dependencies: "alpha" }), operationSource("zulu", { dependencies: "alpha" }), operationSource("alpha", { dependencies: "zulu" })],
    })).toThrow('Cannot seed stage numbers for phase "operation": requires_stage cycle among new stages (stuck: tail, zulu, alpha). Break the cycle.');
  });

  test("pinned cycles reach the lower-numbered dependency refusal", () => {
    expect(() => compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha", { dependencies: "zulu" }), operationSource("zulu", { dependencies: "alpha" })],
      existingStages: [{ slug: "alpha", number: "4.1", name: "Alpha" }, { slug: "zulu", number: "4.2", name: "Zulu" }],
    })).toThrow('operation/alpha.md: Compile invariant violated: stage "alpha" (4.1) requires "zulu" (4.2) \u2014 dependency must be lower-numbered. Fix: either renumber in stage-graph.json to match the dependency direction, or remove the offending requires_stage edge.');
  });

  test("unknown dependencies retain source context", () => {
    expect(() => compileWorkflowCandidate({ ...emptyRequest, stageSources: [operationSource("alpha", { dependencies: "missing" })] }))
      .toThrow('operation/alpha.md: Unknown requires_stage: "missing" on stage "alpha". Every requires_stage entry must reference a known stage slug.');
  });

  test("duplicate stage refusal retains both declaration paths", () => {
    expect(() => compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha"), operationSource("alpha", { path: "copy/alpha.md" })],
    })).toThrow('Duplicate stage slug "alpha" in copy/alpha.md \u2014 already declared in operation/alpha.md. Rename one of them.');
  });
});

describe("graph number and source identity compatibility", () => {
  test("equal explicit numbers preserve declaration order", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("zulu", { authoredFields: "number: 4.8" }), operationSource("alpha", { authoredFields: "number: 4.8" })],
    });
    expect(candidate.stages).toMatchObject([{ slug: "zulu", number: "4.8" }, { slug: "alpha", number: "4.8" }]);
  });

  test("authored numbers override the old pin absolutely while the old name survives", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha", { authoredFields: "number: 4.2" })],
      existingStages: [{ slug: "alpha", number: "4.8", name: "Pinned Alpha" }],
    });
    expect(candidate.stages).toMatchObject([{ slug: "alpha", number: "4.2", name: "Pinned Alpha" }]);
  });

  test("explicit numbers do not advance new-stage seeding and precede equal seeded rows", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha"), operationSource("zulu", { authoredFields: "number: 4.1" })],
    });
    expect(candidate.stages).toMatchObject([{ slug: "zulu", number: "4.1" }, { slug: "alpha", number: "4.1" }]);
  });

  test("last duplicate pin wins while every old row contributes to the next index", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha"), operationSource("zulu")],
      existingStages: [{ slug: "alpha", number: "4.9", name: "First Alpha" }, { slug: "alpha", number: "4.3", name: "Last Alpha" }],
    });
    expect(candidate.stages).toMatchObject([
      { slug: "alpha", number: "4.3", name: "Last Alpha" }, { slug: "zulu", number: "4.10", name: "Zulu" },
    ]);
  });

  test("source identities accept both separators independently of the host platform", () => {
    const slashCandidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha", { path: "operation/alpha.md" })],
    });
    const backslashCandidate = compileWorkflowCandidate({ ...emptyRequest,
      stageSources: [operationSource("alpha", { path: "operation\\alpha.md" })],
    });
    expect(backslashCandidate).toEqual(slashCandidate);
    expect(backslashCandidate.stages).toMatchObject([{ slug: "alpha", number: "4.1" }]);
  });
});

describe("direct scope-helper assignment semantics", () => {
  test("a raw prototype-named slug does not become an own grid cell", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest, stageSources: [operationSource("alpha")] });
    const grid = transposeScopeGrid([{ ...candidate.stages[0], slug: "__proto__" }]);
    expect(grid).toEqual({ baseline: { stages: {} } });
    expect(Object.hasOwn(grid.baseline.stages, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(grid.baseline.stages)).toBe(Object.prototype);
  });

  test("a raw prototype-named scope retains the original assignment behavior", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest, stageSources: [operationSource("alpha")] });
    const grid = transposeScopeGrid([{ ...candidate.stages[0], scopes: ["__proto__"] }]);
    expect(JSON.stringify(grid)).toBe("{}");
    expect(Object.getPrototypeOf(grid)).toEqual({ stages: { alpha: "EXECUTE" } });
  });

  test("an allowed prototype-named scope retains its skipped-stage prototype", () => {
    const candidate = compileWorkflowCandidate({ ...emptyRequest, stageSources: [operationSource("alpha")] });
    const grid = transposeScopeGrid([...candidate.stages], new Set(["__proto__"]));
    expect(JSON.stringify(grid)).toBe("{}");
    expect(Object.getPrototypeOf(grid)).toEqual({ stages: { alpha: "SKIP" } });
  });

  test("merge sorting retains the prototype carried by a fresh own prototype key", () => {
    const fresh = { ["__proto__"]: { stages: { alpha: "EXECUTE" as const } }, zulu: { stages: {} } };
    const merged = mergeComposedScopes({ fresh, onDiskJson: "{}" });
    expect(JSON.stringify(merged)).toBe('{"zulu":{"stages":{}}}');
    expect(Object.getPrototypeOf(merged)).toEqual({ stages: { alpha: "EXECUTE" } });
  });
});

describe("artifact diagnostic compatibility", () => {
  test("duplicate-artifact refusal follows producer insertion order, not consumer order", () => {
    expect(() => compileWorkflowCandidate({ ...emptyRequest, stageSources: [
      { path: "operation/zulu.md", phase: "operation", text: `---
slug: zulu
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: [z-report, a-report]
consumes: []
requires_stage: []
scopes: [baseline]
sensors: []
---
# Zulu
` },
      { path: "operation/alpha.md", phase: "operation", text: `---
slug: alpha
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: [a-report, z-report]
consumes: []
requires_stage: []
scopes: [baseline]
sensors: []
---
# Alpha
` },
      { path: "operation/consumer.md", phase: "operation", text: `---
slug: consumer
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: []
consumes:
  - artifact: a-report
    required: true
  - artifact: z-report
    required: true
requires_stage: []
scopes: [baseline]
sensors: []
---
# Consumer
` },
    ] })).toThrow('Duplicate producers for consumed artifact "z-report" in operation/zulu.md (stage "zulu"), operation/alpha.md (stage "alpha") \u2014 consumed by stage "consumer" in operation/consumer.md. Rename one produced artifact or update the consumer.');
  });

  test("selection-closure refusal retains repeated declarations from the same disabled producer", () => {
    expect(() => compileWorkflowCandidate({ ...emptyRequest, selectedPlugins: ["aidlc"], stageSources: [
      { path: "operation/consumer.md", phase: "operation", text: `---
slug: consumer
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: []
consumes:
  - artifact: shared
    required: true
requires_stage: []
scopes: [baseline]
sensors: []
---
# Consumer
` },
      { path: "operation/probe-producer.md", phase: "operation", text: `---
slug: probe-producer
plugin: probe
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: [shared, shared]
optional_produces: [shared]
consumes: []
requires_stage: []
scopes: [baseline]
sensors: []
---
# Probe producer
` },
    ] })).toThrow('operation/consumer.md: Plugin selection closure failed: enabled stage "consumer" consumes required artifact "shared", but its only producer(s) are disabled: probe-producer (probe), probe-producer (probe), probe-producer (probe). Enable plugin(s) probe or disable the consuming stage.');
  });
});
