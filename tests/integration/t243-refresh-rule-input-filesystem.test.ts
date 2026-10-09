// covers: file:core/tools/aidlc-refresh-rules.ts
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadRules } from "../../core/tools/aidlc-graph.ts";
import { sha256File } from "../../core/tools/aidlc-distribution.ts";
import { prepareRefreshRuleInputs } from "../../core/tools/aidlc-refresh-rules.ts";
import { executePlan, type TransactionPlan, writeOperation } from "../../core/tools/aidlc-transaction.ts";

const ownedRoots = new Set<string>();
afterEach(() => {
  [...ownedRoots].forEach((root) => { rmSync(root, { recursive: true, force: true }); });
  ownedRoots.clear();
});
const memory = "aidlc/spaces/default/memory";
const put = (args: { readonly root: string; readonly path: string; readonly text: string }): void => {
  mkdirSync(dirname(join(args.root, args.path)), { recursive: true });
  writeFileSync(join(args.root, args.path), args.text);
};
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-rule-inputs-"));
  ownedRoots.add(root);
  const projectDir = join(root, "project");
  const stagedRoot = join(root, "staged");
  put({ root: projectDir, path: `${memory}/org.md`, text: "# Private org\r\n" });
  put({ root: projectDir, path: `${memory}/team.md`, text: "# Private team\r\n" });
  put({ root: projectDir, path: `${memory}/project.md`, text: "# Private project\n" });
  put({ root: projectDir, path: `${memory}/phases/construction.md`, text: "# Private construction\n" });
  put({ root: projectDir, path: "aidlc/spaces/default/intents/open/aidlc-state.md", text: "Existing open state.\n" });
  put({ root: projectDir, path: "aidlc/spaces/default/intents/open/audit.md", text: "Existing audit.\n" });
  put({ root: stagedRoot, path: `${memory}/org.md`, text: "# Release org\n" });
  put({ root: stagedRoot, path: `${memory}/team.md`, text: "# Release team\n" });
  put({ root: stagedRoot, path: `${memory}/project.md`, text: "# Release project\n" });
  put({ root: stagedRoot, path: `${memory}/phases/construction.md`, text: "# Release construction\n" });
  put({ root: stagedRoot, path: `${memory}/phases/inception.md`, text: "# Release inception\n" });
  return { root, projectDir, stagedRoot };
};
const withoutPrivateOptionalRules = (args: { readonly projectDir: string }): void => {
  rmSync(join(args.projectDir, memory, "team.md"));
  rmSync(join(args.projectDir, memory, "project.md"));
  rmSync(join(args.projectDir, memory, "phases/construction.md"));
};
const rulePaths = (args: { readonly root: string }): readonly string[] =>
  loadRules({ projectDir: args.root }).map(({ path }) => path);
const payloadPlan = (args: { readonly projectDir: string }): TransactionPlan => {
  put({ root: args.projectDir, path: ".claude/tools/payload.ts", text: "original payload\n" });
  return { schemaVersion: 1, root: args.projectDir, operations: [
    writeOperation(".claude/tools/payload.ts", "updated payload\n", sha256File(join(args.projectDir, ".claude/tools/payload.ts"))),
  ] };
};

describe("refresh compilation owns its retained rule inputs", () => {
  test("read-only preparation preserves exact private bytes and the full resolver chain", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    expect(rulePaths({ root: f.stagedRoot })).toEqual([
      "aidlc/spaces/default/memory/org.md", "aidlc/spaces/default/memory/team.md",
      "aidlc/spaces/default/memory/project.md", "aidlc/spaces/default/memory/phases/construction.md",
    ]);
    expect(readFileSync(join(f.stagedRoot, memory, "org.md"), "utf8")).toBe("# Private org\r\n");
    expect(readFileSync(join(f.stagedRoot, memory, "team.md"), "utf8")).toBe("# Private team\r\n");
    expect(readFileSync(join(f.stagedRoot, memory, "project.md"), "utf8")).toBe("# Private project\n");
    expect(readFileSync(join(f.stagedRoot, memory, "phases/construction.md"), "utf8")).toBe("# Private construction\n");
    expect(Object.keys(prepared.evidence)).toEqual([
      "aidlc/spaces/default/memory/org.md", "aidlc/spaces/default/memory/phases/construction.md",
      "aidlc/spaces/default/memory/project.md", "aidlc/spaces/default/memory/team.md",
    ]);
    expect(prepared.validateLocked()).toEqual({ kind: "validated" });
  });
  test("read-only preparation keeps missing project rules absent even when release seeds exist", () => {
    const f = fixture();
    withoutPrivateOptionalRules(f);
    prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    expect(rulePaths({ root: f.stagedRoot })).toEqual(["aidlc/spaces/default/memory/org.md"]);
    expect(existsSync(join(f.stagedRoot, memory, "team.md"))).toBe(false);
    expect(existsSync(join(f.stagedRoot, memory, "project.md"))).toBe(false);
    expect(existsSync(join(f.stagedRoot, memory, "phases/construction.md"))).toBe(false);
    expect(existsSync(join(f.stagedRoot, memory, "phases/inception.md"))).toBe(false);
  });
  test("ordinary preparation retains authored bytes and keeps forthcoming seeds", () => {
    const f = fixture();
    withoutPrivateOptionalRules(f);
    prepareRefreshRuleInputs({ ...f, workspaceMode: "seed" });
    expect(readFileSync(join(f.stagedRoot, memory, "org.md"), "utf8")).toBe("# Private org\r\n");
    expect(readFileSync(join(f.stagedRoot, memory, "team.md"), "utf8")).toBe("# Release team\n");
    expect(readFileSync(join(f.stagedRoot, memory, "project.md"), "utf8")).toBe("# Release project\n");
    expect(readFileSync(join(f.stagedRoot, memory, "phases/construction.md"), "utf8")).toBe("# Release construction\n");
    expect(readFileSync(join(f.stagedRoot, memory, "phases/inception.md"), "utf8")).toBe("# Release inception\n");
  });
  test("preparation does not copy or mutate workflow records", () => {
    const f = fixture();
    prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    expect(existsSync(join(f.stagedRoot, "aidlc/spaces/default/intents"))).toBe(false);
    expect(readFileSync(join(f.projectDir, "aidlc/spaces/default/intents/open/aidlc-state.md"), "utf8")).toBe("Existing open state.\n");
    expect(readFileSync(join(f.projectDir, "aidlc/spaces/default/intents/open/audit.md"), "utf8")).toBe("Existing audit.\n");
  });
  test("an edit after preparation refuses before planning can accept a new snapshot", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    put({ root: f.projectDir, path: `${memory}/team.md`, text: "# Edited team\n" });
    expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
    expect(readFileSync(join(f.stagedRoot, memory, "team.md"), "utf8")).toBe("# Private team\r\n");
  });
  test("a newly added rule changes the dependency membership", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    put({ root: f.projectDir, path: `${memory}/phases/inception.md`, text: "# Added inception\n" });
    expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
  });
  test("a removed rule changes the dependency membership", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    rmSync(join(f.projectDir, memory, "team.md"));
    expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
  });
  test("an invalid replacement becomes a typed locked refusal", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    put({ root: f.projectDir, path: `${memory}/team.md`, text: "---\nstatus: invalid\n---\n" });
    expect(prepared.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
  });
  test("a locked transaction refuses changed inputs before any payload write", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" });
    const plan = payloadPlan(f);
    put({ root: f.projectDir, path: `${memory}/team.md`, text: "# Changed under lock\n" });
    expect(executePlan(plan, { validateLocked: prepared.validateLocked })).toMatchObject({ kind: "refused", reason: "inputs-changed" });
    expect(readFileSync(join(f.projectDir, ".claude/tools/payload.ts"), "utf8")).toBe("original payload\n");
    expect(readFileSync(join(f.projectDir, "aidlc/spaces/default/intents/open/audit.md"), "utf8")).toBe("Existing audit.\n");
  });
  test("ordinary seed mode returns locked refusal before payload or workflow writes", () => {
    const f = fixture();
    const prepared = prepareRefreshRuleInputs({ ...f, workspaceMode: "seed" });
    const plan = payloadPlan(f);
    put({ root: f.projectDir, path: `${memory}/team.md`, text: "# Changed ordinary input\n" });
    expect(executePlan(plan, { validateLocked: prepared.validateLocked })).toMatchObject({ kind: "refused", reason: "inputs-changed" });
    expect(readFileSync(join(f.projectDir, ".claude/tools/payload.ts"), "utf8")).toBe("original payload\n");
    expect(readFileSync(join(f.projectDir, "aidlc/spaces/default/intents/open/audit.md"), "utf8")).toBe("Existing audit.\n");
  });
  test("a project rule symlink is refused before copying its target", () => {
    const f = fixture();
    put({ root: f.root, path: "owned-link-target.md", text: "# Owned target\n" });
    rmSync(join(f.projectDir, memory, "team.md"));
    symlinkSync(join(f.root, "owned-link-target.md"), join(f.projectDir, memory, "team.md"));
    expect(() => prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" })).toThrow();
    expect(readFileSync(join(f.stagedRoot, memory, "team.md"), "utf8")).toBe("# Release team\n");
  });
  test("a nonregular project rule is refused", () => {
    const f = fixture();
    rmSync(join(f.projectDir, memory, "team.md"));
    mkdirSync(join(f.projectDir, memory, "team.md"));
    expect(() => prepareRefreshRuleInputs({ ...f, workspaceMode: "read-only" })).toThrow();
  });
});
