// Real filesystem and runtime-cache integration, entered by the integration tier.
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { loadAgents, loadScopeMetadata, loadStageGraphAll, pluginsEnabled } from "./aidlc-lib.ts";
import { compileWorkflowCandidate } from "./aidlc-workflow-candidate.ts";
import { readWorkflowCompilationRequest } from "./aidlc-workflow-candidate-inputs.ts";
import { sedReplaceInFile } from "../../tests/harness/fixtures.ts";
import { projectSnapshot, writeFixtureFile } from "../../tests/harness/install-adoption.ts";
import { bindCandidateRuntime, candidateStageSource, cleanupWorkflowFixtures, COMPOSED_SCOPE_NAME,
  createCandidateFixture, readFixtureText } from "../../tests/harness/workflow-candidate-fixtures.ts";

afterEach(() => { cleanupWorkflowFixtures(); mock.restore(); });

describe("explicit workflow input snapshots", () => {
  test("captures two candidates without environment/cache leakage or filesystem writes", () => {
    const firstFixture = createCandidateFixture("probe-first");
    const secondFixture = createCandidateFixture("probe-second", ".codex");
    const firstBefore = projectSnapshot(firstFixture.root);
    const secondBefore = projectSnapshot(secondFixture.root);
    const environmentBefore = { ...process.env };
    const firstRequest = readWorkflowCompilationRequest(firstFixture.paths);
    const secondRequest = readWorkflowCompilationRequest(secondFixture.paths);
    const firstCandidate = compileWorkflowCandidate(firstRequest);
    const secondCandidate = compileWorkflowCandidate(secondRequest);
    expect(compileWorkflowCandidate(firstRequest)).toEqual(firstCandidate);
    expect(firstCandidate.stages).toContainEqual(expect.objectContaining({ slug: "probe-check", sensorsApplicable: [
      { id: "probe-first", path: ".claude/sensors/aidlc-probe-first.md", fireOn: "write", defaultSeverity: "blocking", category: "code-quality", matches: "**/*.{ts,js}" },
    ] }));
    expect(secondCandidate.json).toContain(".codex/sensors/aidlc-probe-second.md");
    expect(secondCandidate.json).not.toContain("probe-first");
    expect(firstCandidate.json).not.toContain("probe-second");
    // A universal binding assertion, not an expected value derived from production.
    expect(firstCandidate.stages).not.toContainEqual(expect.not.objectContaining({
      rulesInContext: expect.arrayContaining([expect.objectContaining({ scope: "team" })]),
    }));
    expect(firstCandidate.composedScopes.recordNames).toEqual([COMPOSED_SCOPE_NAME]);
    expect(firstCandidate.grid[COMPOSED_SCOPE_NAME]).toHaveProperty("stages.units-generation", "SKIP");
    expect(firstCandidate.grid[COMPOSED_SCOPE_NAME]).toHaveProperty("stages.observability-setup", "EXECUTE");
    expect(Object.isFrozen(firstRequest)).toBe(true);
    expect(Object.isFrozen(firstRequest.sensors[0])).toBe(true);
    expect(Object.isFrozen(firstCandidate.stages[0].rulesInContext)).toBe(true);
    expect(() => { firstCandidate.stages[0].requiresStage[0] = "mutated"; }).toThrow();
    expect(process.env).toEqual(environmentBefore);
    expect(projectSnapshot(firstFixture.root)).toEqual(firstBefore);
    expect(projectSnapshot(secondFixture.root)).toEqual(secondBefore);
    writeFixtureFile({ root: firstFixture.harnessRoot, path: "aidlc-common/stages/operation/probe-check.md", text: "broken source" });
    expect(compileWorkflowCandidate(firstRequest)).toEqual(firstCandidate);
  });
});

describe("explicit workflow cache and result isolation", () => {
  test("explicit reads neither consult nor reset primed runtime caches", () => {
    const firstFixture = createCandidateFixture("probe-first");
    const secondFixture = createCandidateFixture("probe-second", ".codex");
    const bindings = bindCandidateRuntime(firstFixture);
    const agents = loadAgents(); const scopes = loadScopeMetadata();
    const graph = loadStageGraphAll(); const selection = pluginsEnabled();
    const candidate = compileWorkflowCandidate(readWorkflowCompilationRequest(secondFixture.paths));
    expect(candidate.json).toContain(".codex/sensors/aidlc-probe-second.md");
    expect(candidate.json).not.toContain("probe-first");
    expect(loadAgents()).toBe(agents); expect(loadScopeMetadata()).toBe(scopes);
    expect(loadStageGraphAll()).toBe(graph); expect(pluginsEnabled()).toBe(selection);
    expect(process.env).toMatchObject(bindings);
  });

  test("compiler returns advisories instead of printing and detaches its frozen result", () => {
    const fixture = createCandidateFixture("probe-first");
    sedReplaceInFile(fixture.codeGenerationPath, "mode: subagent", "mode: inline");
    const request = structuredClone(readWorkflowCompilationRequest(fixture.paths));
    const output = spyOn(console, "error").mockReturnValue(undefined);
    const candidate = compileWorkflowCandidate(request);
    expect(candidate.advisories).toHaveLength(1);
    expect(candidate.advisories[0]).toContain('stage "code-generation"');
    expect(output).not.toHaveBeenCalled();
    const captured = JSON.stringify(candidate);
    request.sensors[0].defaultSeverity = "blocking";
    request.composedRecords[COMPOSED_SCOPE_NAME].stages["observability-setup"] = "SKIP";
    expect(JSON.stringify(candidate)).toBe(captured);
    expect(Object.isFrozen(request.sensors[0])).toBe(false);
  });
});

describe("explicit workflow selection and source validation", () => {
  test("selection keeps disabled plugin stages inert and cannot resurrect their stock scope", () => {
    const fixture = createCandidateFixture("probe-first");
    writeFixtureFile({ root: fixture.harnessRoot, path: "tools/data/harness.json", text: '{"name":"candidate","plugins":["aidlc"]}' });
    const candidate = compileWorkflowCandidate(readWorkflowCompilationRequest(fixture.paths));
    expect(candidate.stages).toContainEqual(expect.objectContaining({ slug: "probe-check", enabled: false }));
    expect(candidate.grid["probe-scope"]).toBeUndefined();
    expect(candidate.composedScopes.recordNames).toHaveLength(1);
  });

  test.each([
    { fault: "unknown-sensor", path: "aidlc-common/stages/operation/probe-check.md", source: candidateStageSource("missing-sensor"), error: "unknown sensor" },
    { fault: "unknown-dependency", path: "aidlc-common/stages/operation/probe-check.md", source: candidateStageSource("probe-first", "missing-stage"), error: "Unknown requires_stage" },
    { fault: "duplicate-stage", path: "aidlc-common/stages/construction/probe-check.md", source: candidateStageSource("probe-first"), error: "Duplicate stage slug" },
  ])("$fault refuses with source context and leaves live files untouched", ({ path, source, error }) => {
    const fixture = createCandidateFixture("probe-first");
    writeFixtureFile({ root: fixture.harnessRoot, path, text: source });
    const before = projectSnapshot(fixture.root);
    const request = readWorkflowCompilationRequest(fixture.paths);
    expect(() => compileWorkflowCandidate(request)).toThrow("probe-check.md");
    expect(() => compileWorkflowCandidate(request)).toThrow(error);
    expect(projectSnapshot(fixture.root)).toEqual(before);
  });

  test("duplicate sensor manifests refuse through the existing schema loader", () => {
    const fixture = createCandidateFixture("probe-first");
    writeFixtureFile({ root: fixture.harnessRoot, path: "sensors/aidlc-probe-second.md", text: readFixtureText(fixture.paths.sensorsDir, "aidlc-probe-first.md") });
    const before = projectSnapshot(fixture.root);
    expect(() => readWorkflowCompilationRequest(fixture.paths)).toThrow("duplicate sensor id");
    expect(() => readWorkflowCompilationRequest(fixture.paths)).toThrow("aidlc-probe-second.md");
    expect(projectSnapshot(fixture.root)).toEqual(before);
  });
});
