// covers: function:guardPolicyAcceptsChanges, function:scopeDefinitionGuardPolicy, function:resolveGuardPolicy
//
// Guard Policy off holds whatever the scope is: a shipped scope, a plugin's
// scope, a composed plan, a saved composed scope, or a team's memory layer.
// Every case creates its work through the project's own installed tools, so the
// scope is read by the engine's own loader, and the policy through the one
// reader every changed-input check uses.

import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { guardPolicyAcceptsChanges, hookChildEnv, markHumanTurn, resolveGuardPolicy } from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import { setupIntegrationProject } from "../harness/fixtures.ts";
import { buildPluginProjection, composePluginFixture } from "../harness/plugin-kit.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const BUN = process.execPath;
const PLUGIN_SCOPE = "test-pro-validation";
const temps: string[] = [];
const fixtureHome = mkdtempSync(join(tmpdir(), "aidlc-policy-home-"));
temps.push(fixtureHome);
const fixtureEnvironment = { PATH: process.env.PATH, HOME: fixtureHome, TMPDIR: tmpdir() };

afterAll(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// The project's installed tools resolve its scopes and policy.
function runTool(proj: string, tool: string, args: string[]): { status: number; out: string } {
  const sessionEnvironment = hookChildEnv(proj, "rin-policy-human");
  const env: Record<string, string | undefined> = {
    ...fixtureEnvironment,
    CLAUDE_PROJECT_DIR: proj,
    AIDLC_SESSION_OVERRIDE: sessionEnvironment.AIDLC_SESSION_OVERRIDE,
    AIDLC_SESSION_OVERRIDE_SOURCE: sessionEnvironment.AIDLC_SESSION_OVERRIDE_SOURCE,
  };
  for (const key of ["AIDLC_SCOPE_MAPPING", "AIDLC_SCOPE_GRID", "AIDLC_SCOPES_DIR", "AIDLC_COMPOSED_SCOPES_DIR", "AIDLC_STAGE_GRAPH"]) {
    delete env[key];
  }
  const res = spawnSync(BUN, [join(proj, ".claude", "tools", tool), ...args, "--project-dir", proj], {
    encoding: "utf-8",
    env: env as Record<string, string>,
  });
  return { status: res.status ?? -1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

function create(proj: string, scope: string, extra: string[] = []): void {
  const made = runTool(proj, "aidlc-utility.ts", [
    "intent-create", "--scope", scope, "--arguments=fix the flaky date parser", "--label", `work on ${scope}`, ...extra,
  ]);
  expect(made.status, made.out).toBe(0);
}

function latestStatePath(proj: string): string {
  const intents = join(proj, "aidlc", "spaces", "default", "intents");
  const records = readdirSync(intents)
    .map((name) => join(intents, name))
    .filter((path) => existsSync(join(path, "aidlc-state.md")))
    .sort((a, b) => statSync(join(b, "aidlc-state.md")).mtimeMs - statSync(join(a, "aidlc-state.md")).mtimeMs);
  return join(records[0], "aidlc-state.md");
}

function policyLine(proj: string, path = latestStatePath(proj)): string {
  const state = readFileSync(path, "utf-8");
  return /- \*\*Guard Policy\*\*: (.*)/.exec(state)?.[1] ?? "(no line)";
}

function effective(proj: string): string {
  const got = runTool(proj, "aidlc-utility.ts", ["config-get", "guard-policy"]);
  expect(got.status, got.out).toBe(0);
  return got.out.trim();
}

function declareMemory(proj: string, layer: "org" | "team" | "project", mode: string): void {
  const path = join(proj, "aidlc", "spaces", "default", "memory", `${layer}.md`);
  const content = readFileSync(path, "utf-8");
  const next = content.replace(/(## Guard Policy\n\n)<!--[\s\S]*?-->/, `$1Mode: ${mode}`);
  expect(next).not.toBe(content);
  writeFileSync(path, next);
}

function plainProject(): string {
  const proj = setupIntegrationProject({ noAidlcDocs: true, stripEnvScope: true });
  temps.push(proj);
  return proj;
}

describe("a plugin's scope", () => {
  let tmp = "";
  let undeclared = "";
  let declaredStrict = "";

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "aidlc-t-every-scope-"));
    temps.push(tmp);
    const built = join(tmp, "plugin", "claude");
    buildPluginProjection("test-pro", "claude", built);
    undeclared = composePluginFixture({ plugin: "test-pro", harness: "claude", projectDir: join(tmp, "undeclared"), pluginBuilt: built, env: fixtureEnvironment }).projectDir;
    const builtStrict = join(tmp, "plugin-strict", "claude");
    buildPluginProjection("test-pro", "claude", builtStrict);
    declaredStrict = composePluginFixture({
      plugin: "test-pro",
      harness: "claude",
      projectDir: join(tmp, "strict"),
      pluginBuilt: builtStrict,
      env: fixtureEnvironment,
      beforeCompose: ({ pluginBuilt }) => {
        const found = spawnSync("find", [pluginBuilt, "-name", `${PLUGIN_SCOPE}.md`], { encoding: "utf-8" }).stdout.trim().split("\n").filter(Boolean);
        expect(found.length).toBeGreaterThan(0);
        for (const file of found) {
          writeFileSync(file, readFileSync(file, "utf-8").replace("skeleton: off\n", "skeleton: off\nguard_policy: strict\n"));
        }
      },
    }).projectDir;
  });

  test("with no guard_policy key it starts off, and the reader accepts changes", () => {
    create(undeclared, PLUGIN_SCOPE);
    expect(policyLine(undeclared)).toBe(`off (from scope ${PLUGIN_SCOPE})`);
    expect(effective(undeclared)).toContain("off");
    expect(guardPolicyAcceptsChanges(undeclared)).toBe(true);
  });

  test("an author who writes strict gets strict", () => {
    create(declaredStrict, PLUGIN_SCOPE);
    expect(policyLine(declaredStrict)).toBe(`strict (from scope ${PLUGIN_SCOPE})`);
    expect(guardPolicyAcceptsChanges(declaredStrict)).toBe(false);
  });
});

describe("a composed plan", () => {
  test("an unsaved custom plan and a saved composed scope both start off", () => {
    const proj = plainProject();
    create(proj, "bugfix", ["--add", "functional-design", "--skip", "deployment-pipeline,deployment-execution"]);
    expect(policyLine(proj)).toBe("off (from scope bugfix)");
    expect(guardPolicyAcceptsChanges(proj)).toBe(true);
    const saved = runTool(proj, "aidlc-utility.ts", ["scope-save", "--name", "quick-fix", "--keywords", "parser-fix"]);
    expect(saved.status, saved.out).toBe(0);
    create(proj, "quick-fix");
    expect(policyLine(proj)).toBe("off (from scope quick-fix)");
    expect(guardPolicyAcceptsChanges(proj)).toBe(true);
  });
});

describe("a team's memory layer", () => {
  test("Mode: off replaces a strict scope default, and status names the layer", () => {
    const proj = plainProject();
    create(proj, "enterprise");
    expect(policyLine(proj)).toBe("strict (from scope enterprise)");
    expect(guardPolicyAcceptsChanges(proj)).toBe(false);
    declareMemory(proj, "team", "off");
    expect(effective(proj)).toContain("off (from team.md)");
    expect(guardPolicyAcceptsChanges(proj)).toBe(true);
  });

  test("the narrowest layer wins, and a strict lock in any layer still wins over all", () => {
    const proj = plainProject();
    create(proj, "classic");
    declareMemory(proj, "org", "off");
    declareMemory(proj, "project", "relaxed");
    expect(effective(proj)).toContain("relaxed (from project.md)");
    declareMemory(proj, "team", "strict");
    expect(effective(proj)).toContain("strict");
    expect(guardPolicyAcceptsChanges(proj)).toBe(false);
  });

  test("a value the person set for this work keeps it", () => {
    const proj = plainProject();
    create(proj, "classic", ["--guard-policy", "strict"]);
    expect(policyLine(proj)).toBe("strict (set by you)");
    declareMemory(proj, "team", "off");
    expect(guardPolicyAcceptsChanges(proj)).toBe(false);
  });
});


describe("Rin native strict scope policy", () => {
  let project = "";
  let policyState = "";

  beforeAll(() => {
    const temporary = mkdtempSync(join(tmpdir(), "aidlc-rin-policy-"));
    temps.push(temporary);
    const built = join(temporary, "plugin", "claude");
    buildPluginProjection("rin", "claude", built);
    project = composePluginFixture({ plugin: "rin", harness: "claude", projectDir: join(temporary, "project"), pluginBuilt: built, env: fixtureEnvironment }).projectDir;
    const started = spawnSync(BUN, [join(project, ".claude", "tools", "aidlc.ts"), "engine", "hook", "session-start", "--project-dir", project], {
      cwd: project,
      encoding: "utf-8",
      env: { ...fixtureEnvironment, CLAUDE_PROJECT_DIR: project },
      input: JSON.stringify({ cwd: project, hook_event_name: "SessionStart", session_id: "rin-policy-human", source: "startup" }),
    });
    expect(started.status).toBe(0);
  });

  test.each(["rin-audit", "rin-bugfix", "rin-dep-bump", "rin-gates", "rin-harness", "rin-ops", "rin-retired", "rin-unit"])("%s creates with strict native policy", (scope) => {
    create(project, scope);
    expect(policyLine(project)).toBe(`strict (from scope ${scope})`);
    expect(guardPolicyAcceptsChanges(project)).toBe(false);
  });

  test("explicit strict remains the person's setting", () => {
    create(project, "rin-gates", ["--guard-policy", "strict"]);
    policyState = latestStatePath(project);
    expect(policyLine(project, policyState)).toBe("strict (set by you)");
  });

  test("an unapproved lower override is refused", () => {
    const refused = runTool(project, "aidlc-utility.ts", ["intent-create", "--scope", "rin-gates", "--arguments=fix parser", "--guard-policy", "off"]);
    expect(refused.status).not.toBe(0);
    expect(policyLine(project, policyState)).toBe("strict (set by you)");
  });

  test("a fixture-recorded human request authorizes native lowering", () => {
    const joined = runTool(project, "aidlc-utility.ts", ["intent", "switch", basename(dirname(policyState))]);
    expect(joined.status, joined.out).toBe(0);
    appendAuditEntry("HUMAN_TURN", { Session: "rin-policy-human" }, project);
    markHumanTurn(project);
    const changed = runTool(project, "aidlc-utility.ts", ["config-change", "--guard-policy", "off"]);
    expect(changed.status, changed.out).toBe(0);
    expect(policyLine(project, policyState)).toBe("off (set by you)");
    expect(guardPolicyAcceptsChanges(project)).toBe(true);
  });

  test("existing off state and absent policy state retain native semantics", () => {
    expect(resolveGuardPolicy(project, "- **Scope**: rin-gates\n- **Guard Policy**: off (from scope rin-gates)\n").value).toBe("off");
    expect(resolveGuardPolicy(project, "- **Scope**: rin-gates\n").value).toBe("strict");
  });

  test("engine resume preserves an existing off policy", () => {
    const state = policyState;
    const before = readFileSync(state, "utf-8");
    const resumed = runTool(project, "aidlc-orchestrate.ts", ["next"]);
    expect(resumed.status, resumed.out).toBe(0);
    expect(policyLine(project, policyState)).toBe("off (set by you)");
    expect(readFileSync(state, "utf-8")).toBe(before);
  });

  test("engine resume does not manufacture an absent legacy policy", () => {
    const state = policyState;
    const legacy = readFileSync(state, "utf-8").replace(/^- \*\*Guard Policy\*\*:.*\n/m, "");
    writeFileSync(state, legacy);
    const resumed = runTool(project, "aidlc-orchestrate.ts", ["next"]);
    expect(resumed.status, resumed.out).toBe(0);
    expect(policyLine(project, policyState)).toBe("(no line)");
    expect(guardPolicyAcceptsChanges(project)).toBe(false);
    expect(readFileSync(state, "utf-8")).toBe(legacy);
  });

  test("a strict memory lock rejects explicit lowering and overrides existing off", () => {
    declareMemory(project, "team", "strict");
    const refused = runTool(project, "aidlc-utility.ts", ["intent-create", "--scope", "rin-gates", "--arguments=fix parser", "--guard-policy", "off"]);
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("Your team set Guard Policy to strict");
    expect(resolveGuardPolicy(project, "- **Scope**: rin-gates\n- **Guard Policy**: off (set by you)\n").value).toBe("strict");
  });
});
