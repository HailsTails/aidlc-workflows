import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { compileWorkflowCandidate, freezeWorkflowValue, type WorkflowCompilationRequest } from "./aidlc-workflow-candidate.ts";

const foundationSource = {
  path: "operation/foundation.md", phase: "operation", text: `---
slug: foundation
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: foundation-report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: [foundation-report]
consumes: []
requires_stage: []
scopes: [baseline]
sensors: []
---
# Foundation
`,
};
const probeSource = {
  path: "operation/probe-check.md", phase: "operation", text: `---
slug: probe-check
plugin: probe
phase: operation
execution: ALWAYS
condition: Always
inputs: foundation-report
outputs: probe-report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: [probe-report]
consumes: []
requires_stage: [foundation]
scopes: [probe-scope]
sensors: [probe-sensor]
---
# Probe
`,
};
const advisorySource = {
  path: "construction/code-generation.md", phase: "construction", text: `---
slug: code-generation
phase: construction
execution: ALWAYS
condition: Always
inputs: none
outputs: code-report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
for_each: unit-of-work
workspace_requires: true
produces: [code-report]
consumes: []
requires_stage: []
scopes: [baseline]
sensors: []
---
# Code generation
`,
};
const compilationRequest: WorkflowCompilationRequest = {
  stageSources: [probeSource, foundationSource],
  existingStages: [{ slug: "foundation", number: "4.8", name: "Pinned foundation" }],
  knownAgents: ["aidlc-quality-agent"],
  rules: [
    { path: "memory/org.md", scope: "org" },
    { path: "memory/team.md", scope: "team" },
    { path: "memory/operation.md", scope: "phase", phase: "operation" },
    { path: "memory/construction.md", scope: "phase", phase: "construction" },
  ],
  sensors: [{ id: "probe-sensor", path: ".claude/sensors/aidlc-probe-sensor.md",
    fireOn: "write", defaultSeverity: "blocking", category: "code-quality", matches: "**/*.ts",
  }],
  selectedPlugins: ["aidlc", "probe"], selectedScopeNames: ["baseline", "probe-scope"],
  installedScopeNames: ["baseline", "probe-scope", "custom-plan"],
  composedRecords: { "custom-plan": { name: "custom-plan", identity: "# Custom plan\n",
    stages: { foundation: "EXECUTE", "probe-check": "SKIP" } } },
  priorGridJson: '{"custom-plan":{"stages":{"foundation":"SKIP","probe-check":"EXECUTE"}},"orphan":{"stages":{"foundation":"EXECUTE"}}}',
};

afterEach(() => mock.restore());

describe("pure workflow candidate bindings", () => {
  test("preserves pinned rows and binds explicit rules, sensors and scope values", () => {
    const candidate = compileWorkflowCandidate(compilationRequest);
    expect(candidate.stages[0]).toMatchObject({ slug: "foundation", number: "4.8", name: "Pinned foundation" });
    expect(candidate.stages[1]).toMatchObject({ slug: "probe-check", number: "4.9", requiresStage: ["foundation"],
      rulesInContext: [
        { path: "memory/org.md", scope: "org" }, { path: "memory/team.md", scope: "team" },
        { path: "memory/operation.md", scope: "phase" },
      ], sensorsApplicable: [{ id: "probe-sensor", path: ".claude/sensors/aidlc-probe-sensor.md",
        fireOn: "write", defaultSeverity: "blocking", category: "code-quality", matches: "**/*.ts" }] });
    expect(candidate.grid).toEqual({
      baseline: { stages: { foundation: "EXECUTE", "probe-check": "SKIP" } },
      "custom-plan": { stages: { foundation: "EXECUTE", "probe-check": "SKIP" } },
      "probe-scope": { stages: { foundation: "SKIP", "probe-check": "EXECUTE" } },
    });
    expect(candidate.composedScopes).toEqual({ names: ["custom-plan"], recordNames: ["custom-plan"], gridOnlyNames: [] });
    expect(candidate.advisories).toEqual([]);
  });

  test("successive explicit candidates remain independent and repeatable", () => {
    const firstCandidate = compileWorkflowCandidate(compilationRequest);
    const secondCandidate = compileWorkflowCandidate({ ...compilationRequest, sensors: [{
      id: "probe-sensor", path: ".codex/sensors/aidlc-probe-sensor.md",
      fireOn: "gate", defaultSeverity: "advisory",
    }] });
    expect(firstCandidate.json).toContain(".claude/sensors/aidlc-probe-sensor.md");
    expect(firstCandidate.json).not.toContain(".codex/");
    expect(secondCandidate.stages[1].sensorsApplicable).toEqual([{
      id: "probe-sensor", path: ".codex/sensors/aidlc-probe-sensor.md", fireOn: "gate", defaultSeverity: "advisory",
    }]);
    expect(compileWorkflowCandidate(compilationRequest)).toEqual(firstCandidate);
  });

  test("plugin selection excludes its stock scope while retaining the approved composed scope", () => {
    const candidate = compileWorkflowCandidate({ ...compilationRequest, selectedPlugins: ["aidlc"], selectedScopeNames: ["baseline"] });
    expect(candidate.stages[1]).toMatchObject({ slug: "probe-check", enabled: false });
    expect(candidate.grid["probe-scope"]).toBeUndefined();
    expect(candidate.grid["custom-plan"]).toEqual({ stages: { foundation: "EXECUTE", "probe-check": "SKIP" } });
    expect(candidate.composedScopes.recordNames).toEqual(["custom-plan"]);
  });
});

describe("pure workflow candidate diagnostics", () => {
  test("unknown sensor refusal retains its source context", () => {
    expect(() => compileWorkflowCandidate({ ...compilationRequest, sensors: [] })).toThrow("operation/probe-check.md");
    expect(() => compileWorkflowCandidate({ ...compilationRequest, sensors: [] })).toThrow('unknown sensor id "probe-sensor"');
  });

  test("duplicate stage refusal names both declarations", () => {
    const request = { ...compilationRequest, stageSources: [foundationSource, { ...foundationSource, path: "copy/foundation.md" }] };
    expect(() => compileWorkflowCandidate(request)).toThrow('Duplicate stage slug "foundation"');
    expect(() => compileWorkflowCandidate(request)).toThrow("operation/foundation.md");
    expect(() => compileWorkflowCandidate(request)).toThrow("copy/foundation.md");
  });

  test("advisories are returned without console output", () => {
    const output = spyOn(console, "error").mockReturnValue(undefined);
    const candidate = compileWorkflowCandidate({ ...compilationRequest, stageSources: [advisorySource], existingStages: [] });
    expect(candidate.advisories).toHaveLength(1);
    expect(candidate.advisories[0]).toContain('stage "code-generation"');
    expect(candidate.advisories[0]).toContain('mode is "inline"');
    expect(output).not.toHaveBeenCalled();
  });
});

describe("pure workflow value isolation", () => {
  test("detaches the result while freezing graph, grid and nested bindings", () => {
    const request = structuredClone(compilationRequest);
    const candidate = compileWorkflowCandidate(request);
    const captured = JSON.stringify(candidate);
    request.sensors[0].defaultSeverity = "advisory";
    request.composedRecords["custom-plan"].stages.foundation = "SKIP";
    expect(JSON.stringify(candidate)).toBe(captured);
    expect(Object.isFrozen(request.sensors[0])).toBe(false);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(candidate.grid["custom-plan"].stages)).toBe(true);
    expect(Object.isFrozen(candidate.stages[1].rulesInContext)).toBe(true);
    expect(Object.isFrozen(candidate.stages[1].sensorsApplicable[0])).toBe(true);
    expect(() => { Object.assign(candidate.grid["custom-plan"].stages!, { foundation: "SKIP" }); }).toThrow();
    expect(() => { candidate.stages[1].requiresStage[0] = "mutated"; }).toThrow();
  });

  test("deep freeze handles nested arrays, nulls and scalar values", () => {
    const snapshot = { sources: [{ path: "stage.md", prior: null }], scope: "baseline" };
    expect(freezeWorkflowValue(snapshot)).toBe(snapshot);
    expect(Object.isFrozen(snapshot.sources)).toBe(true);
    expect(Object.isFrozen(snapshot.sources[0])).toBe(true);
    expect(freezeWorkflowValue(null)).toBeNull();
    expect(freezeWorkflowValue("baseline")).toBe("baseline");
    expect(() => { snapshot.sources[0].path = "changed.md"; }).toThrow();
  });
});
