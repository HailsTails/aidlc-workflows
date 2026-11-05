// covers: scope:bugfix, scope:express, scope:feature, scope:mvp, scope:security-patch, scope:infra, scope:refactor
//
// The installed engine must reach each scope's first stage and deliver its
// conductor persona with production guards on. Synthetic provider events drive
// the actual shipped Claude registrations, including session binding and every
// matching Bash pre/post hook. No ledger or heartbeat is seeded by the test.
// This is a no-model installed contract, not execution by a live Claude host.

import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { setDefaultTimeout, afterAll, describe, expect, test } from "bun:test";
import {
  cleanupTestProject,
  resetAidlcEnv,
  setupIntegrationProject,
} from "../harness/fixtures.ts";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderComposedScopeRecord } from "../../core/tools/aidlc-graph.ts";
import { getField, resolveWorkflowSelection, stateFilePathForSelection } from "../../core/tools/aidlc-lib.ts";
import { createClaudeStartupHost } from "../harness/claude-startup.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

// Clear leaked AWS_AIDLC_DEFAULT_SCOPE so the scope resolves from the --scope
// flag / state, not a developer's shell env (parity with the .sh's pure env).
resetAidlcEnv();

// Per first-batch scope: the first EXECUTE stage the engine resolves on a fresh
// greenfield init. Mirrors the .sh's CASES at :26. Measured live
// against the shipped engine before authoring (see the SOURCE UNDER TEST note).
const CASES: ReadonlyArray<{ scope: string; wantStage: string }> = [
  { scope: "bugfix", wantStage: "requirements-analysis" },
  { scope: "express", wantStage: "requirements-analysis" },
  { scope: "feature", wantStage: "intent-capture" },
  { scope: "mvp", wantStage: "intent-capture" },
  // security-patch's first EXECUTE is reverse-engineering, but that brownfield
  // conditional stage greenfield-SKIPs on the empty workspace, so the engine
  // lands on the next EXECUTE: requirements-analysis (in scope so the
  // `requirements` artifact its downstream consumers hard-require has a
  // producer — scopes/aidlc-security-patch.md).
  { scope: "security-patch", wantStage: "requirements-analysis" },
  // infra skips ideation + application-code construction; practices-discovery is
  // its first EXECUTE stage (scopes/aidlc-infra.md). Measured live.
  { scope: "infra", wantStage: "practices-discovery" },
  // refactor's first EXECUTE is reverse-engineering, but that brownfield
  // conditional stage greenfield-SKIPs on the empty workspace (same as
  // security-patch's reverse-engineering), so the engine lands on the next
  // EXECUTE: requirements-analysis (scopes/aidlc-refactor.md). Measured live.
  { scope: "refactor", wantStage: "requirements-analysis" },
];

const tempDirs: string[] = [];
afterAll(() => {
  tempDirs.forEach(cleanupTestProject);
});

function firstMoveDirective(scope: string): Record<string, unknown> {
  const proj = setupIntegrationProject();
  tempDirs.push(proj);
  const host = createClaudeStartupHost(proj);
  host.start();
  host.prompt(`/aidlc --scope ${scope} fix the sample parser`);
  const init = host.tool("aidlc-utility.ts", ["intent-create", "--scope", scope, "--project-dir", proj]);
  expect(init.status, init.stderr || init.stdout).toBe(0);
  return host.next(["--scope", scope]).directive;
}

describe("t130 scope runners — baked-scope first move through the engine (migrated from t130-scope-runners.sh, plan 12)", () => {
  test.each([...CASES])("aidlc-$scope: first move -> run-stage($wantStage) carrying the engine-delivered conductor persona", ({ scope, wantStage }) => {
    const d = firstMoveDirective(scope);
    // .sh assert 1: baked-scope first move resolves a run-stage directive.
    expect(d.kind, JSON.stringify(d)).toBe("run-stage");
    // .sh assert 2: it lands on this scope's first EXECUTE stage.
    expect(d.stage).toBe(wantStage);
    // .sh assert 3: D-E — the engine bakes the conductor persona into the
    // FIRST run-stage (the runner never loads it by hand). STRONGER than the
    // .sh's `has_persona == "1"` flag: assert it is a non-empty string.
    expect(typeof d.conductor_persona).toBe("string");
    expect(String(d.conductor_persona).length).toBeGreaterThan(0);
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
});


describe("named scope runner commands reach the installed engine", () => {
  test.each(["feature.dot", "feature+api", "feature@home", "Build_2026", "2fast"])("%s survives generation and reaches its first stage with production guards", (scope) => {
    const proj = setupIntegrationProject();
    tempDirs.push(proj);
    const scopes = join(proj, ".claude/scopes");
    const source = readFileSync(join(scopes, "aidlc-feature.md"), "utf8");
    const named = source.replace("name: feature", `name: ${scope}`);
    writeFileSync(join(scopes, `aidlc-${scope}.md`), named);
    const grid = JSON.parse(readFileSync(join(proj, ".claude/tools/data/scope-grid.json"), "utf8"));
    mkdirSync(join(proj, "aidlc/scopes"), { recursive: true });
    writeFileSync(join(proj, `aidlc/scopes/${scope}.md`), renderComposedScopeRecord(named, grid.feature.stages, "Named runner identity fixture"));
    const host = createClaudeStartupHost(proj);
    host.start();
    host.prompt(`/aidlc --scope ${scope} fix the sample parser`);
    const compiled = host.tool("aidlc-graph.ts", ["compile"]);
    expect(compiled.status, compiled.stderr || compiled.stdout).toBe(0);
    const init = host.tool("aidlc-utility.ts", ["intent-create", "--scope", scope, "--project-dir", proj]);
    expect(init.status, init.stderr || init.stdout).toBe(0);
    const selection = resolveWorkflowSelection(proj, { sessionId: host.session });
    expect(selection.binding).not.toBeNull();
    const statePath = stateFilePathForSelection(proj, selection);
    expect(getField(readFileSync(statePath, "utf8"), "Scope")).toBe(scope);
    const generated = host.tool("aidlc-runner-gen.ts", ["scopes"]);
    expect(generated.status, generated.stderr || generated.stdout).toBe(0);
    const body = readFileSync(join(proj, `.claude/skills/aidlc-${scope}/SKILL.md`), "utf8");
    const command = body.match(/1\. `directive = ([^`]+) \$ARGUMENTS`/)?.[1];
    expect(command).toBeDefined();
    // Execute the emitted command itself, rather than reconstructing its scope.
    const first = host.command(command!);
    expect(first.status, first.stderr || first.stdout).toBe(0);
    let directive = JSON.parse(first.stdout);
    while (directive.kind === "load-steering") {
      const continued = host.tool("aidlc-orchestrate.ts", ["continue", directive.receipt]);
      expect(continued.status, continued.stderr || continued.stdout).toBe(0);
      directive = JSON.parse(continued.stdout);
    }
    expect(directive.kind, JSON.stringify(directive)).toBe("run-stage");
    expect(directive.stage).toBe("intent-capture");
    expect(getField(readFileSync(statePath, "utf8"), "Scope")).toBe(scope);
    expect(typeof directive.conductor_persona).toBe("string");
    expect(directive.conductor_persona.length).toBeGreaterThan(0);
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
});
