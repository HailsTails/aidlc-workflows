// covers: tool:aidlc-init, tool:aidlc-plugin, tool:aidlc-utility
// Config/refresh and local plugin selection must agree on retained content versus execution.
import { afterEach, beforeEach, expect, test, setDefaultTimeout } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanInstallFixture, type InstallFixture, preservedUserState, projectSnapshot, runConfig } from "../harness/install-adoption.ts";
import { allRetainedContent, capturePluginEvidence, createPluginRefreshFixture, hostInventory, installedCommand, pluginState, recordedExecution, RIN_HOOK } from "../harness/install-plugin-refresh.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
let fixture: InstallFixture;
beforeEach(() => { fixture = createPluginRefreshFixture(); });
afterEach(() => { cleanInstallFixture(fixture); }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

function installedAndSelected(): void {
  const installed = runConfig({ fixture, runner: fixture.packagedRunner, options: ["--yes"] });
  expect(installed.status, installed.stdout + installed.stderr).toBe(0);
  const selected = installedCommand({ fixture, command: "select", selection: "aidlc,test-pro,rin" });
  expect(selected.status, selected.stdout + selected.stderr).toBe(0);
  const synced = installedCommand({ fixture, command: "sync" });
  expect(synced.status, synced.stdout + synced.stderr).toBe(0);
}

const OFF = { selection: ["aidlc"], hookBody: false, hookRegistration: false,
  runner: false, contribution: false, graphPresent: true, graphEnabled: false, coreClaimsPlugin: false };
const ON = { selection: ["aidlc", "rin", "test-pro"], hookBody: true, hookRegistration: true,
  runner: true, contribution: true, graphPresent: true, graphEnabled: undefined, coreClaimsPlugin: false };

test.each(["refresh-immediately", "sync-then-refresh"] as const)(
  "installed %s while deselected preserves content without resurrecting hooks or runners", (route) => {
    installedAndSelected();
    expect(pluginState(fixture.project)).toEqual(ON);
    expect(hostInventory(fixture)).toEqual({ status: 0, capability: "full-inventory", keys: ["rin", "test-pro"] });
    const evidence = capturePluginEvidence(fixture.project);
    expect(evidence.hookPaths.length).toBeGreaterThan(1);
    expect(evidence.registrations.length).toBeGreaterThan(1);
    const content = allRetainedContent({ project: fixture.project, evidence });
    const selectedExecution = recordedExecution({ project: fixture.project, evidence });
    expect(selectedExecution.registrations).toEqual(evidence.registrations);
    expect(Object.keys(selectedExecution.bodies).sort()).toEqual(evidence.hookPaths);
    const userState = preservedUserState(fixture.project);
    const off = installedCommand({ fixture, command: "select", selection: "aidlc" });
    expect(off.status, off.stdout + off.stderr).toBe(0);
    expect(pluginState(fixture.project)).toEqual(OFF);
    expect(recordedExecution({ project: fixture.project, evidence })).toEqual({ bodies: {}, registrations: [] });
    expect(allRetainedContent({ project: fixture.project, evidence })).toEqual(content);
    if (route === "sync-then-refresh") {
      const sync = installedCommand({ fixture, command: "sync" });
      expect(sync.status, sync.stdout + sync.stderr).toBe(0);
      expect(pluginState(fixture.project)).toEqual(OFF);
      expect(recordedExecution({ project: fixture.project, evidence })).toEqual({ bodies: {}, registrations: [] });
    }
    const before = projectSnapshot(fixture.project);
    const plan = runConfig({ fixture, options: ["--dry-run"] });
    expect(plan.status, plan.stdout + plan.stderr).toBe(0);
    expect(projectSnapshot(fixture.project)).toEqual(before);
    const refresh = runConfig({ fixture, options: ["--yes"] });
    expect(refresh.status, refresh.stdout + refresh.stderr).toBe(0);
    expect(pluginState(fixture.project)).toEqual(OFF);
    expect(recordedExecution({ project: fixture.project, evidence })).toEqual({ bodies: {}, registrations: [] });
    expect(allRetainedContent({ project: fixture.project, evidence })).toEqual(content);
    expect(preservedUserState(fixture.project)).toEqual(userState);
    const on = installedCommand({ fixture, command: "select", selection: "aidlc,test-pro,rin" });
    expect(on.status, on.stdout + on.stderr).toBe(0);
    const restore = installedCommand({ fixture, command: "sync" });
    expect(restore.status, restore.stdout + restore.stderr).toBe(0);
    expect(pluginState(fixture.project)).toEqual(ON);
    expect(recordedExecution({ project: fixture.project, evidence })).toEqual(selectedExecution);
    expect(allRetainedContent({ project: fixture.project, evidence })).toEqual(content);
  },
);

test("installed combined selection refuses an edited Rin execution body atomically", () => {
  installedAndSelected();
  const hook = join(fixture.project, RIN_HOOK);
  writeFileSync(hook, `${readFileSync(hook, "utf8")}\n// user edit\n`);
  const before = projectSnapshot(fixture.project);
  const off = installedCommand({ fixture, command: "select", selection: "aidlc" });
  expect(off.status, off.stdout + off.stderr).toBe(1);
  expect(off.stdout + off.stderr).toContain("owned hook path changed since composition");
  expect(projectSnapshot(fixture.project)).toEqual(before);
  expect(pluginState(fixture.project)).toEqual(ON);
});