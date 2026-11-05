// covers: tool:aidlc-init, file:core/tools/aidlc-distribution.ts, file:core/tools/aidlc-transaction.ts
// covers: file:core/tools/aidlc-managed-file-reconciliation.ts, file:core/tools/aidlc-destination-collision.ts
// Actual packaged and installed CLI composition. Pure decisions are tested in tests/unit/t-install-*.
import { afterEach, beforeEach, expect, test, setDefaultTimeout } from "bun:test";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { PRODUCTION_GUARD_OFF_SWITCHES } from "../harness/runner-profile.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import {
  actionFor, appendFixtureFile, cleanInstallFixture, createInstallFixture, descriptorOf, fileHash,
  type InstallFixture, LEDGER_FILE, MANAGED_FILE, OTHER_FILE, OVERLAY_FILE,
  preservedUserState, projectSnapshot, RETIRED_FILE, runConfig, writeDescriptor, writeFixtureFile,
} from "../harness/install-adoption.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
let fixture: InstallFixture;
beforeEach(() => { fixture = createInstallFixture(); });
afterEach(() => { cleanInstallFixture(fixture); }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const EXPECTED_USER_STATE = {
  model: "personal-model", customEnv: "keep-me", allow: true, deny: true,
  overlay: "project overlay bytes", ledger: "untouched ledger bytes", overlayOwned: false, ledgerOwned: false,
};
const PRODUCTION_FILES = [
  "aidlc-distribution.ts", "aidlc-transaction.ts", "aidlc-destination-collision.ts",
  "aidlc-init.ts", "aidlc-managed-file-reconciliation.ts",
];

function installFixture(): void {
  const result = runConfig({ fixture, runner: fixture.packagedRunner, options: ["--yes"] });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

function installedSourceHashes(): string[] {
  return PRODUCTION_FILES.map((name) => fileHash(join(fixture.project, ".claude/tools", name)));
}
function authoredSourceHashes(): string[] {
  return PRODUCTION_FILES.map((name) => fileHash(join(REPO_ROOT, "core/tools", name)));
}
function guardValues(): (string | undefined)[] {
  return PRODUCTION_GUARD_OFF_SWITCHES.map((name) => fixture.env[name]);
}

test("packaged create hands off to the installed config and repeat preserves bytes and user state", () => {
  expect(fixture.env.AIDLC_TEST_GUARD_PROFILE).toBe("production");
  expect(guardValues()).toEqual(PRODUCTION_GUARD_OFF_SWITCHES.map(() => "0"));
  const empty = projectSnapshot(fixture.project);
  const create = runConfig({ fixture, runner: fixture.packagedRunner, options: ["--dry-run"] });
  expect(create.status, create.stdout).toBe(0);
  expect(actionFor({ result: create, path: MANAGED_FILE })).toMatchObject([{ action: "create" }]);
  expect(projectSnapshot(fixture.project)).toEqual(empty);
  installFixture();
  expect(installedSourceHashes()).toEqual(authoredSourceHashes());
  expect(preservedUserState(fixture.project)).toEqual(EXPECTED_USER_STATE);
  const beforeRepeat = projectSnapshot(fixture.project);
  const repeat = runConfig({ fixture, options: ["--dry-run"] });
  expect(repeat.status, repeat.stdout).toBe(0);
  expect(actionFor({ result: repeat, path: MANAGED_FILE })).toMatchObject([{ action: "preserve" }]);
  expect(actionFor({ result: repeat, path: OVERLAY_FILE })).toMatchObject([{ action: "preserve", detail: "project-owned overlay" }]);
  expect(runConfig({ fixture, options: ["--yes"] }).status).toBe(0);
  expect(projectSnapshot(fixture.project)).toEqual(beforeRepeat);
});

test("installed update, conflict atomicity and explicit force retain user state", () => {
  installFixture();
  appendFixtureFile({ root: fixture.artifact, path: MANAGED_FILE, text: "Updated ordinary shipped descriptor.\n" });
  const update = runConfig({ fixture, options: ["--dry-run"] });
  expect(update.status, update.stdout).toBe(0);
  expect(actionFor({ result: update, path: MANAGED_FILE })).toMatchObject([{ action: "update" }]);
  expect(runConfig({ fixture, options: ["--yes"] }).status).toBe(0);
  expect(readFileSync(join(fixture.project, MANAGED_FILE), "utf8")).toEndWith("Updated ordinary shipped descriptor.\n");
  appendFixtureFile({ root: fixture.project, path: MANAGED_FILE, text: "Locally edited descriptor.\n" });
  appendFixtureFile({ root: fixture.artifact, path: OTHER_FILE, text: "Unrelated pending upstream update.\n" });
  const beforeConflict = projectSnapshot(fixture.project);
  const conflict = runConfig({ fixture, options: ["--dry-run"] });
  expect(conflict.status, conflict.stdout).toBe(4);
  expect(actionFor({ result: conflict, path: MANAGED_FILE })).toMatchObject([{ action: "conflict", detail: "locally modified or unowned" }]);
  expect(actionFor({ result: conflict, path: OTHER_FILE })).toMatchObject([{ action: "update" }]);
  expect(runConfig({ fixture, options: ["--yes"] }).status).toBe(4);
  expect(projectSnapshot(fixture.project)).toEqual(beforeConflict);
  const force = runConfig({ fixture, options: ["--force", "--dry-run"] });
  expect(force.status, force.stdout).toBe(0);
  expect(actionFor({ result: force, path: MANAGED_FILE })).toMatchObject([{ action: "update" }]);
  expect(runConfig({ fixture, options: ["--force", "--yes"] }).status).toBe(0);
  expect(readFileSync(join(fixture.project, MANAGED_FILE), "utf8")).toEndWith("Updated ordinary shipped descriptor.\n");
  expect(readFileSync(join(fixture.project, OTHER_FILE), "utf8")).toEndWith("Unrelated pending upstream update.\n");
  expect(preservedUserState(fixture.project)).toEqual(EXPECTED_USER_STATE);
});

test("installed retirement refuses local edits atomically and removes unchanged owned content", () => {
  installFixture();
  const originalRetired = readFileSync(join(fixture.project, RETIRED_FILE));
  rmSync(join(fixture.artifact, RETIRED_FILE));
  writeFixtureFile({ root: fixture.project, path: RETIRED_FILE, text: "Keep local retirement edit.\n" });
  const beforeRetirementConflict = projectSnapshot(fixture.project);
  const retirementConflict = runConfig({ fixture, options: ["--dry-run"] });
  expect(retirementConflict.status, retirementConflict.stdout).toBe(4);
  expect(actionFor({ result: retirementConflict, path: RETIRED_FILE })).toMatchObject([{ action: "conflict", detail: "removed upstream but locally modified" }]);
  expect(runConfig({ fixture, options: ["--yes"] }).status).toBe(4);
  expect(projectSnapshot(fixture.project)).toEqual(beforeRetirementConflict);
  writeFileSync(join(fixture.project, RETIRED_FILE), originalRetired);
  const retirement = runConfig({ fixture, options: ["--dry-run"] });
  expect(retirement.status, retirement.stdout).toBe(0);
  expect(actionFor({ result: retirement, path: RETIRED_FILE })).toMatchObject([{ action: "remove", detail: "no longer shipped" }]);
  expect(runConfig({ fixture, options: ["--yes"] }).status).toBe(0);
  expect(existsSync(join(fixture.project, RETIRED_FILE))).toBe(false);
  expect(preservedUserState(fixture.project)).toEqual(EXPECTED_USER_STATE);
});

test.each(["aidlc-destination-collision.ts", "aidlc-managed-file-reconciliation.ts"])(
  "missing installed %s fails explicitly before writes, then restoration recovers", (name) => {
    installFixture();
    const modulePath = join(fixture.project, ".claude/tools", name);
    const withheld = join(fixture.root, name);
    const complete = projectSnapshot(fixture.project);
    renameSync(modulePath, withheld);
    try {
      const missing = projectSnapshot(fixture.project);
      const plan = runConfig({ fixture, options: ["--dry-run"] });
      expect(plan.status).toBe(1);
      expect(`${plan.stdout}\n${plan.stderr}`).toContain(name);
      const apply = runConfig({ fixture, options: ["--yes"] });
      expect(apply.status).toBe(1);
      expect(`${apply.stdout}\n${apply.stderr}`).toContain(name);
      expect(projectSnapshot(fixture.project)).toEqual(missing);
    } finally { renameSync(withheld, modulePath); }
    expect(runConfig({ fixture, options: ["--dry-run"] }).status).toBe(0);
    expect(projectSnapshot(fixture.project)).toEqual(complete);
  },
);

const aliasedRoot = process.platform === "win32" ? ".CLAUDE" : ".claude";
const aliasedGitignore = process.platform === "win32" ? ".GITIGNORE" : ".gitignore";

test.each([
  { name: "managed duplicate or Windows alias", managed: aliasedRoot, root: "" },
  { name: "root duplicate or Windows alias", managed: "", root: aliasedGitignore },
  { name: "managed/root ancestor or Windows alias", managed: "", root: `${aliasedRoot}/settings.json` },
])("descriptor rejects $name in plan and apply without changing a populated project", ({ managed, root }) => {
  installFixture();
  const descriptor = descriptorOf(fixture.artifact);
  descriptor.managedDirectories.push(...[managed].filter(Boolean));
  descriptor.rootIntegrations.push(...[root].filter(Boolean).map((path) => ({ path, policy: "whole-file" as const })));
  writeDescriptor({ artifact: fixture.artifact, descriptor });
  const before = projectSnapshot(fixture.project);
  const plan = runConfig({ fixture, options: ["--dry-run"] });
  expect(plan.status, plan.stdout).toBe(4);
  expect(plan.stdout).toMatch(/duplicate projected path|overlapping projected paths/);
  const apply = runConfig({ fixture, options: ["--yes"] });
  expect(apply.status, apply.stdout).toBe(4);
  expect(apply.stdout).toMatch(/duplicate projected path|overlapping projected paths/);
  expect(projectSnapshot(fixture.project)).toEqual(before);
});

test("distinct managed prefix and sibling files plan and install successfully", () => {
  installFixture();
  const descriptor = descriptorOf(fixture.artifact);
  descriptor.managedDirectories.push(".claude-extra");
  writeDescriptor({ artifact: fixture.artifact, descriptor });
  writeFixtureFile({ root: fixture.artifact, path: ".claude-extra/first.txt", text: "first sibling" });
  writeFixtureFile({ root: fixture.artifact, path: ".claude-extra/second.txt", text: "second sibling" });
  const plan = runConfig({ fixture, options: ["--dry-run"] });
  expect(plan.status, plan.stdout).toBe(0);
  expect(actionFor({ result: plan, path: ".claude-extra/first.txt" })).toMatchObject([{ action: "create" }]);
  expect(actionFor({ result: plan, path: ".claude-extra/second.txt" })).toMatchObject([{ action: "create" }]);
  expect(runConfig({ fixture, options: ["--yes"] }).status).toBe(0);
  expect(readFileSync(join(fixture.project, ".claude-extra/first.txt"), "utf8")).toBe("first sibling");
  expect(readFileSync(join(fixture.project, ".claude-extra/second.txt"), "utf8")).toBe("second sibling");
  expect(preservedUserState(fixture.project)).toEqual(EXPECTED_USER_STATE);
});

test("installed transaction rejects same/parent/child destinations and accepts siblings and distinct prefixes", async () => {
  installFixture();
  const installed: typeof import("../../core/tools/aidlc-transaction.ts") = await import(pathToFileURL(join(fixture.project, ".claude/tools/aidlc-transaction.ts")).href);
  const before = projectSnapshot(fixture.project);
  const transactionProject = join(fixture.root, "transaction-project");
  mkdirSync(transactionProject);
  const plan = (paths: string[]): import("../../core/tools/aidlc-transaction.ts").TransactionPlan => ({ schemaVersion: 1, root: transactionProject,
    operations: paths.map((path) => ({ kind: "write", path, data: "control", expected: "absent" })),
  });
  expect(() => installed.validateTransactionPlan(plan([".claude/a.md", `${aliasedRoot}/a.md`]))).toThrow("operations overlap");
  expect(() => installed.validateTransactionPlan(plan([".claude/a.md", aliasedRoot]))).toThrow("operations overlap");
  expect(() => installed.validateTransactionPlan(plan([".claude", `${aliasedRoot}/a.md`]))).toThrow("operations overlap");
  expect(() => installed.validateTransactionPlan(plan([".claude/a.md", ".claude/b.md"]))).not.toThrow();
  expect(() => installed.validateTransactionPlan(plan([".claude/a.md", ".claude-extra/a.md"]))).not.toThrow();
  expect(projectSnapshot(fixture.project)).toEqual(before);
  expect(projectSnapshot(transactionProject)).toEqual([]);
  expect(existsSync(join(fixture.project, LEDGER_FILE))).toBe(true);
});