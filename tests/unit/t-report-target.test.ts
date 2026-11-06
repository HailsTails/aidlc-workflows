// covers: function:resolveReportTarget, function:resolveProjectDirectory
// Real records exercise selection and attempt isolation without joining, claiming, or writing them.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodeOrchestratorRequest } from "../../core/tools/aidlc-orchestrator-request.ts";
import { resolveProjectDirectory } from "../../core/tools/aidlc-project-dir.ts";
import { helperSessionPath, readSessionBinding, writeSessionBinding } from "../../core/tools/aidlc-record-core.ts";
import { resolveReportTarget } from "../../core/tools/aidlc-report-target.ts";

const CHAT = "report-target-chat";
const CURSOR = "cursor-00000001";
const BOUND = "bound-00000002";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "aidlc-report-target-")));
  roots.push(root);
  return root;
}

function write(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function record(root: string, name: string, stage = "code-generation", scope = "feature", space = "default"): string {
  const dir = join(root, "aidlc", "spaces", space, "intents", name);
  write(join(dir, "aidlc-state.md"), `- **Scope**: ${scope}\n- **Current Stage**: ${stage}\n`);
  return dir;
}

function cursor(root: string, name: string, space = "default"): void {
  write(join(root, "aidlc", "active-space"), space);
  write(join(root, "aidlc", "spaces", space, "intents", "active-intent"), name);
}

function resolve(root: string, args: string[] = [], sessionId = CHAT) {
  const request = decodeOrchestratorRequest({ argv: ["report", "--result", "completed", ...args] });
  if (request.kind !== "report") throw new Error("Test request did not decode as report");
  return resolveReportTarget({ request, context: { cwd: root, environment: {}, sessionId } });
}

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      files[relative(root, path)] = entry.isDirectory() ? "directory" : readFileSync(path).toString("base64");
      if (entry.isDirectory()) walk(path);
    }
  };
  walk(root);
  return files;
}

function event(eventName: string, { stage = "code-generation", workflow = `single-stage:${stage}`, scope,
  time = "2026-11-05T12:00:00Z" }: { stage?: string; workflow?: string; scope?: string; time?: string } = {}): string {
  return `---\n**Event**: ${eventName}\n**Timestamp**: ${time}\n**Stage**: ${stage}\n**Workflow**: ${workflow}\n` +
    (scope === undefined ? "" : `**Scope**: ${scope}\n`);
}

describe("read-only report target", () => {
  test("session binding wins over a different space and cursor, preserving explicit stage and unit", () => {
    const root = project();
    record(root, CURSOR, "requirements-analysis");
    const selected = record(root, BOUND, "functional-design", "bugfix", "other");
    cursor(root, CURSOR);
    writeSessionBinding(root, CHAT, "other", BOUND, "switch");
    const before = snapshot(root);
    const result = resolve(root, ["--stage", " code-generation ", "--unit", "checkout"]);
    expect(result).toMatchObject({
      kind: "resolved", mode: "main", recordDir: selected, participation: "participant",
      selection: { intent: BOUND, space: "other", sessionId: CHAT }, stage: "code-generation",
      stageSource: "explicit", currentStage: "functional-design", scope: "bugfix", unit: "checkout",
    });
    expect(snapshot(root)).toEqual(before);
  });

  test("an unknown session observes the cursor and never settles its first binding", () => {
    const root = project();
    record(root, CURSOR);
    record(root, BOUND);
    cursor(root, CURSOR);
    const before = snapshot(root);
    expect(resolve(root)).toMatchObject({ kind: "resolved", stage: "code-generation", stageSource: "current" });
    expect(readSessionBinding(root, CHAT)).toBeNull();
    expect(snapshot(root)).toEqual(before);
  });

  test("a helper session uses its root chat without copying the root binding", () => {
    const root = project();
    record(root, CURSOR);
    record(root, BOUND, "unit-test-generation");
    cursor(root, CURSOR);
    writeSessionBinding(root, CHAT, "default", BOUND, "switch");
    write(helperSessionPath(root, "report-target-helper"), CHAT);
    const before = snapshot(root);
    expect(resolve(root, [], "report-target-helper")).toMatchObject({
      kind: "resolved", stage: "unit-test-generation", selection: { sessionId: CHAT, intent: BOUND },
    });
    expect(snapshot(root)).toEqual(before);
  });

  test("the lone-record fallback remains an outsider rather than inventing participation", () => {
    const root = project();
    record(root, CURSOR);
    const before = snapshot(root);
    expect(resolve(root)).toMatchObject({ kind: "resolved", participation: "outsider", selection: { intent: CURSOR } });
    expect(snapshot(root)).toEqual(before);
  });

  test("an unjoined binding does not borrow the lone record's state", () => {
    const root = project();
    record(root, CURSOR);
    writeSessionBinding(root, CHAT, "default", null, "unjoined");
    const before = snapshot(root);
    expect(resolve(root).kind).toBe("unavailable");
    expect(snapshot(root)).toEqual(before);
  });

  test.each(["", "- **Scope**: feature\n", "- **Current Stage**: code-generation\n"])(
    "missing required state fields refuse even an explicit stage: %s", (content) => {
      const root = project();
      const dir = record(root, CURSOR);
      cursor(root, CURSOR);
      write(join(dir, "aidlc-state.md"), content);
      const before = snapshot(root);
      expect(resolve(root, ["--stage", "unit-test-generation"]).kind).toBe("unavailable");
      expect(snapshot(root)).toEqual(before);
    },
  );

  test("a stale binding follows record-core's cursor fallback without rewriting the binding", () => {
    const root = project();
    record(root, CURSOR);
    cursor(root, CURSOR);
    writeSessionBinding(root, CHAT, "default", BOUND, "switch");
    const before = snapshot(root);
    expect(resolve(root)).toMatchObject({ kind: "resolved", selection: { intent: CURSOR, binding: null } });
    expect(snapshot(root)).toEqual(before);
  });

  test("malformed delegated-worktree provenance refuses instead of guessing a target", () => {
    const root = project();
    write(join(root, ".aidlc", "worktree-meta.json"), JSON.stringify({ version: 0, swarmUnit: "unit" }));
    const before = snapshot(root);
    expect(resolve(root)).toMatchObject({ kind: "unavailable", reason: "Invalid delegated worktree intent provenance" });
    expect(snapshot(root)).toEqual(before);
  });

  test("delegated worktree resolution reads parent provenance without binding an ambient session", () => {
    const root = project();
    const parentRecord = record(root, CURSOR);
    cursor(root, CURSOR);
    write(join(root, "aidlc", "spaces", "default", "intents", "intents.json"), JSON.stringify([
      { uuid: "00000000-0000-7000-8000-000000000001", slug: "cursor", dirName: CURSOR, status: "in-flight" },
    ]));
    const child = join(root, ".aidlc", "worktrees", "bolt-00000001_unit");
    const childRecord = record(child, CURSOR, "unit-test-generation");
    const intentRecord = `aidlc/spaces/default/intents/${CURSOR}`;
    write(join(child, ".aidlc", "worktree-meta.json"), JSON.stringify({
      version: 1, intentRecord, intentId8: "00000001", repoSelector: null, swarmUnit: "unit", boltSlug: "unit",
    }));
    write(join(parentRecord, "audit", "one.md"),
      event("WORKTREE_CREATED") + `**Bolt slug**: unit\n**Worktree path**: ${child}\n` +
      `**Intent record**: ${intentRecord}\n**Repo**: -\n**Swarm Unit**: unit\n`);
    const previous = { ...process.env };
    process.env.AIDLC_SESSION_OVERRIDE = "report-target-ambient";
    delete process.env.AIDLC_SESSION_OVERRIDE_SOURCE;
    try {
      const before = snapshot(root);
      expect(resolve(child)).toMatchObject({
        kind: "resolved", recordDir: childRecord, stage: "unit-test-generation", participation: "participant",
        selection: { intent: CURSOR, sessionId: null },
      });
      expect(snapshot(root)).toEqual(before);
    } finally {
      process.env = previous;
    }
  });

  test("single reports require an explicit stage and an open synthetic attempt", () => {
    const root = project();
    const dir = record(root, CURSOR);
    cursor(root, CURSOR);
    write(join(dir, "audit", "one.md"), event("STAGE_STARTED", { workflow: "main", scope: "feature" }));
    const before = snapshot(root);
    expect(resolve(root, ["--single"]).kind).toBe("unavailable");
    expect(resolve(root, ["--single", "--stage", "code-generation"]).kind).toBe("unavailable");
    expect(snapshot(root)).toEqual(before);
  });

  test("single scope comes only from the bound record's latest isolated start", () => {
    const root = project();
    const current = record(root, CURSOR);
    const selected = record(root, BOUND, "functional-design", "feature");
    cursor(root, CURSOR);
    writeSessionBinding(root, CHAT, "default", BOUND, "switch");
    write(join(current, "audit", "one.md"), event("STAGE_STARTED", { scope: "wrong-record" }));
    write(join(selected, "audit", "one.md"), event("STAGE_STARTED", { scope: "bugfix" }));
    const before = snapshot(root);
    expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({
      kind: "resolved", mode: "single", recordDir: selected, stage: "code-generation", stageSource: "explicit",
      scope: "bugfix", stateContent: null, workflow: "single-stage:code-generation", selection: { intent: BOUND },
    });
    expect(snapshot(root)).toEqual(before);
    write(join(selected, "audit", "one.md"), event("STAGE_STARTED"));
    expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({ kind: "resolved", scope: null });
  });

  test("a space-only single run never borrows the cursor's state or attempt", () => {
    const root = project();
    const current = record(root, CURSOR);
    cursor(root, CURSOR);
    writeSessionBinding(root, CHAT, "default", null, "switch");
    const spaceDir = join(root, "aidlc", "spaces", "default", "intents");
    write(join(current, "audit", "one.md"), event("STAGE_STARTED", { scope: "feature" }));
    expect(resolve(root, ["--single", "--stage", "code-generation"]).kind).toBe("unavailable");
    write(join(spaceDir, "audit", "one.md"), event("STAGE_STARTED", { scope: "spike" }));
    const before = snapshot(root);
    expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({
      kind: "resolved", mode: "single", recordDir: spaceDir, scope: "spike", stateContent: null, selection: { intent: null },
    });
    expect(snapshot(root)).toEqual(before);
  });

  test("closed, cross-shard ambiguous, and unreadable single attempts refuse", () => {
    const root = project();
    const dir = record(root, CURSOR);
    cursor(root, CURSOR);
    const first = join(dir, "audit", "one.md");
    write(first, event("STAGE_STARTED", { scope: "feature" }) + event("STAGE_COMPLETED"));
    expect(resolve(root, ["--single", "--stage", "code-generation"]).kind).toBe("unavailable");
    write(first, event("STAGE_STARTED", { scope: "feature" }));
    const second = join(dir, "audit", "two.md");
    write(second, event("STAGE_STARTED", { scope: "bugfix" }));
    expect(resolve(root, ["--single", "--stage", "code-generation"]).kind).toBe("unavailable");
    write(second, event("STAGE_STARTED", { scope: "bugfix", time: "2026-11-05T13:00:00Z" }));
    expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({ kind: "resolved", scope: "bugfix" });
    mkdirSync(join(dir, "audit", "unreadable.md"));
    const before = snapshot(root);
    expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({
      kind: "unavailable", reason: "The selected record's isolated-attempt evidence could not be read.",
    });
    expect(snapshot(root)).toEqual(before);
  });
});

describe("project directory context", () => {
  test("explicit and environment selectors resolve against the command's cwd in order", () => {
    const cwd = project();
    const environment = { AIDLC_PROJECT_DIR: "aidlc-project", CLAUDE_PROJECT_DIR: "claude-project" };
    expect(resolveProjectDirectory({ cwd, explicitDir: "explicit", environment })).toBe(join(cwd, "explicit"));
    expect(resolveProjectDirectory({ cwd, environment })).toBe(join(cwd, "aidlc-project"));
    expect(resolveProjectDirectory({ cwd, environment: { CLAUDE_PROJECT_DIR: "claude-project" } })).toBe(join(cwd, "claude-project"));
    expect(resolveProjectDirectory({ cwd, explicitDir: cwd, environment })).toBe(cwd);
  });

  test("installed tools and hooks use an open-set harness name; source checkouts use cwd", () => {
    const cwd = project();
    const root = join(cwd, "installed");
    expect(resolveProjectDirectory({ cwd, sourceFile: join(root, ".new-harness", "tools", "aidlc.ts") })).toBe(root);
    expect(resolveProjectDirectory({ cwd, sourceFile: join(root, ".new-harness", "hooks", "guard.ts"), leaf: "hooks" })).toBe(root);
    expect(resolveProjectDirectory({ cwd, sourceFile: join(root, "core", "tools", "aidlc.ts") })).toBe(cwd);
  });

  test("native runtime payloads use cwd without discarding a similarly named project", () => {
    const cwd = project();
    const install = join(cwd, "install");
    const execPath = join(install, "aidlc.exe");
    const sourceFile = join(install, "runtime", "claude", ".claude", "tools", "aidlc.ts");
    expect(resolveProjectDirectory({ cwd, sourceFile, native: true, execPath })).toBe(cwd);
    expect(resolveProjectDirectory({ cwd, sourceFile, native: false, execPath })).toBe(join(install, "runtime", "claude"));
    const sibling = join(install, "runtime-other", ".claude", "tools", "aidlc.ts");
    expect(resolveProjectDirectory({ cwd, sourceFile: sibling, native: true, execPath })).toBe(join(install, "runtime-other"));
  });

  test("a native report observed from another project's install uses the command's cwd", async () => {
    const installed = project();
    const target = project();
    record(installed, CURSOR, "functional-design");
    cursor(installed, CURSOR);
    record(target, CURSOR, "code-generation");
    cursor(target, CURSOR);
    const outdir = join(installed, ".test-harness", "tools");
    const built = await Bun.build({
      entrypoints: [fileURLToPath(new URL("../../core/tools/aidlc-report-target.ts", import.meta.url))],
      outdir, target: "bun",
    });
    expect(built.success, built.logs.map(String).join("\n")).toBe(true);
    const observer = await import(pathToFileURL(join(outdir, "aidlc-report-target.js")).href);
    const request = decodeOrchestratorRequest({ argv: ["report", "--result", "completed"] });
    const context = { cwd: target, environment: {}, sessionId: CHAT };
    expect(observer.resolveReportTarget({ request, context: { ...context, native: true } })).toMatchObject({
      kind: "resolved", projectDir: target, stage: "code-generation",
    });
    expect(observer.resolveReportTarget({ request, context: { ...context, native: false } })).toMatchObject({
      kind: "resolved", projectDir: installed, stage: "functional-design",
    });
  });
});

test("a space-only attempt is not an unjoined main workflow", () => {
  const root = project();
  write(join(root, "aidlc", "active-space"), "default");
  write(join(root, "aidlc", "spaces", "default", "intents", "audit", "single.md"), event("STAGE_STARTED", { scope: "feature" }));
  expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({ kind: "resolved", mode: "single", participation: "outsider", unjoined: false });
  writeSessionBinding(root, CHAT, "default", null, "unjoined");
  expect(resolve(root, ["--single", "--stage", "code-generation"])).toMatchObject({ kind: "resolved", unjoined: true });
});
