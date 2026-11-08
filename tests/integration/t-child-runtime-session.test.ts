// covers: file:scripts/projection/src/adapters/child-runtime-directory.ts, file:scripts/projection/src/adapters/source-host-emission.ts
import { afterEach, expect, test } from "bun:test";
import { NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS } from "../harness/test-budget.ts";
import { appendRuntimeSource, runtimeWitnessPaths, requireExplicitDistributionFixture, changeRuntimeProcess, runtimeWitnessContainsProcess, changeRuntimeCapability, createRuntimeSourceFixtures, executeConcurrentRuntimeFixture, executeRuntimeFixture, failRuntimeFixture, instrumentRuntimeFixture, instrumentCompilerProcesses, observedCompilerProcesses, observedRuntimeFixture, runtimeInputWitness, runtimeConcurrentCounts, runtimeOutputPresence, sessionScratchRoots, runtimeWitnessContainsCapability, verifyRuntimeWitness } from "./support/child-runtime-fixture.ts";
import "./support/child-runtime-fixture.test.ts";

const fixtures = createRuntimeSourceFixtures();
afterEach(fixtures.cleanup);

test("actual table children get distinct shallow per-process homes while callback output roots stay private", () => {
  const root = fixtures.create();
  const before = sessionScratchRoots();
  instrumentRuntimeFixture(root);
  const reply = executeRuntimeFixture(root);
  expect(reply.status).toBe(0);
  expect(observedRuntimeFixture(root)).toEqual({ callbackCount: 2, callbackRootsShallow: true, callbackRootsRemoved: true, separateSessionOwners: true, emissionHomes: 4, sessions: 1, children: [
    { homeMatches: true, shallow: true, callbackRoot: true, separate: true, cleaned: true },
    { homeMatches: true, shallow: true, callbackRoot: true, separate: true, cleaned: true },
    { homeMatches: true, shallow: true, callbackRoot: true, separate: true, cleaned: true },
    { homeMatches: true, shallow: true, callbackRoot: true, separate: true, cleaned: true },
  ] });
  expect(runtimeOutputPresence(root)).toEqual([true, true]);
  expect(sessionScratchRoots()).toEqual(before);
}, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS);

test.each([
  ["callback", "deliberate callback failure"],
  ["stderr", "deliberate table warning"],
  ["mutation", "Qualified artifact requires every independently observed production input"],
])("runtime session cleans after %s failure without issuing outputs", (kind, message) => {
  const root = fixtures.create();
  const before = sessionScratchRoots();
  failRuntimeFixture({ root, kind, message });
  const reply = executeRuntimeFixture(root);
  expect(reply.status).toBe(1);
  expect(reply.stderr).toContain(message);
  expect(runtimeOutputPresence(root)).toEqual([false, false]);
  expect(sessionScratchRoots()).toEqual(before);
}, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS);

test("runtime capability bytes participate in both package currency and conservative source witnesses", () => {
  const root = fixtures.create();
  const before = runtimeInputWitness(root);
  expect(runtimeWitnessContainsCapability(before)).toBe(true);
  changeRuntimeCapability(root);
  expect(runtimeInputWitness(root).fingerprint).not.toBe(before.fingerprint);
  expect(() => verifyRuntimeWitness({ before, root })).toThrow("Qualified artifact requires every independently observed production input");
});

test("concurrent public requests keep callback state and explicit outputs separate", async () => {
  const root = fixtures.create();
  const before = sessionScratchRoots();
  const replies = await executeConcurrentRuntimeFixture(root);
  expect(replies).toEqual([{ exitCode: 0, stdout: "", stderr: "" }, { exitCode: 0, stdout: "", stderr: "" }]);
  expect(runtimeConcurrentCounts(root)).toEqual(["1", "2", "1", "2"]);
  expect(sessionScratchRoots()).toEqual(before);
}, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS);

test("retained Claude composition preserves source and distribution workdirs with isolated runtime homes", () => {
  const root = fixtures.create();
  const before = sessionScratchRoots();
  instrumentCompilerProcesses(root);
  const reply = executeRuntimeFixture(root);
  expect({ status: reply.status, stderr: reply.stderr }).toEqual({ status: 0, stderr: "" });
  const observed = observedCompilerProcesses(root);
  expect(observed.outerCount).toBe(1);
  expect(observed.outerWorkspacePreserved).toBe(true);
  expect(observed.childCount).toBe(33);
  expect({ source: observed.sourceWork, distribution: observed.distributionWork, foreign: observed.foreignWork }).toEqual({ source: 9, distribution: 24, foreign: 0 });
  expect(observed.uniqueHomes).toBe(observed.childCount);
  expect(observed.children).toEqual(Array.from({ length: observed.childCount }, () => ({ explicitOwner: true, homeMatches: true, isolatedFromWork: true, workRecognized: true, cleaned: true })));
  expect(runtimeOutputPresence(root)).toEqual([true, true]);
  expect(sessionScratchRoots()).toEqual(before);
}, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS);

test("new process capability participates in package currency and conservative source witnesses", () => {
  const root = fixtures.create();
  const before = runtimeInputWitness(root);
  expect(runtimeWitnessContainsProcess(before)).toBe(true);
  changeRuntimeProcess(root);
  expect(runtimeInputWitness(root).fingerprint).not.toBe(before.fingerprint);
  expect(() => verifyRuntimeWitness({ before, root })).toThrow("Qualified artifact requires every independently observed production input");
});

test("retained distribution allocation ignores poisoned ambient temp and never selects the standalone allocator", () => {
  const root = fixtures.create();
  const before = sessionScratchRoots();
  instrumentRuntimeFixture(root);
  requireExplicitDistributionFixture(root);
  const reply = executeRuntimeFixture(root);
  expect({ status: reply.status, stderr: reply.stderr }).toEqual({ status: 0, stderr: "" });
  expect(observedRuntimeFixture(root)).toMatchObject({ callbackCount: 2, callbackRootsShallow: true, callbackRootsRemoved: true, separateSessionOwners: true, emissionHomes: 4, sessions: 1 });
  expect(runtimeOutputPresence(root)).toEqual([true, true]);
  expect(sessionScratchRoots()).toEqual(before);
}, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS);

test.each([
  "scripts/projection/src/adapters/owned-directory.ts",
  "scripts/projection/src/adapters/session-directory-storage.ts",
  "scripts/projection/src/adapters/distribution-directory.ts",
  "scripts/projection/src/adapters/fresh-core-directories.ts",
])("distribution lifecycle module %s participates in currency and independent source witnesses", relative => {
  const root = fixtures.create();
  const before = runtimeInputWitness(root);
  expect(runtimeWitnessPaths(before)).toContain(relative);
  appendRuntimeSource({ root, relative, text: "// changed distribution ownership capability input" });
  expect(runtimeInputWitness(root).fingerprint).not.toBe(before.fingerprint);
  expect(() => verifyRuntimeWitness({ before, root })).toThrow("Qualified artifact requires every independently observed production input");
});
