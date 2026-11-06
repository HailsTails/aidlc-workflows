import { expect, mock, test } from "bun:test";
import { previewRuntimeContract, previewRegistrationDisposition, previewFailure, isPreviewOutcome } from "./preview-runtime-contract.mjs";

const generatePreviewLaunch = mock<() => undefined>().mockReturnValue(undefined);
const mainRootFrom = mock<() => undefined>().mockReturnValue(undefined);
const prunedWorktrees = mock<() => undefined>().mockReturnValue(undefined);
const readRegistry = mock<() => undefined>().mockReturnValue(undefined);
const writeRegistry = mock<() => undefined>().mockReturnValue(undefined);
const generator = { generatePreviewLaunch };
const registry = { mainRootFrom, prunedWorktrees, readRegistry, writeRegistry };
const inheritedOutcome: unknown = Object.create({ kind: "registered" });

export type GeneratorNamespace = { readonly generatePreviewLaunch: () => void };
const getterGenerator = ({ readExport }: { readonly readExport: () => () => void }): GeneratorNamespace => ({ get generatePreviewLaunch() { return readExport(); } });

test("a complete project capability is captured without invoking it", () => {
  expect(previewRuntimeContract({ generator, registry })).toEqual({ kind: "ready", runtime: { generatePreviewLaunch, mainRootFrom, prunedWorktrees, readRegistry, writeRegistry } });
  expect(generatePreviewLaunch.mock.calls).toEqual([]);
  expect(mainRootFrom.mock.calls).toEqual([]);
  expect(prunedWorktrees.mock.calls).toEqual([]);
  expect(readRegistry.mock.calls).toEqual([]);
  expect(writeRegistry.mock.calls).toEqual([]);
});

test("additional project exports do not make the existing contract incompatible", () => {
  expect(previewRuntimeContract({ generator: { generatePreviewLaunch, anotherProjectFunction: mainRootFrom }, registry })).toEqual({ kind: "ready", runtime: { generatePreviewLaunch, mainRootFrom, prunedWorktrees, readRegistry, writeRegistry } });
});

test("a capability export is read once and its admitted reference is retained", () => {
  const readExport = mock<() => () => void>().mockReturnValueOnce(generatePreviewLaunch).mockReturnValue(writeRegistry);
  const generator = getterGenerator({ readExport });
  expect(previewRuntimeContract({ generator, registry })).toEqual({ kind: "ready", runtime: { generatePreviewLaunch, mainRootFrom, prunedWorktrees, readRegistry, writeRegistry } });
  expect(readExport.mock.calls).toEqual([[]]);
});

test.each([
  { name: "absent generator", generator: undefined, registry },
  { name: "nonfunction generator", generator: { generatePreviewLaunch: "not executable" }, registry },
  { name: "absent registry", generator, registry: undefined },
  { name: "missing main-root function", generator, registry: { prunedWorktrees, readRegistry, writeRegistry } },
  { name: "missing prune function", generator, registry: { mainRootFrom, readRegistry, writeRegistry } },
  { name: "missing read function", generator, registry: { mainRootFrom, prunedWorktrees, writeRegistry } },
  { name: "missing write function", generator, registry: { mainRootFrom, prunedWorktrees, readRegistry } },
  { name: "nonfunction write export", generator, registry: { mainRootFrom, prunedWorktrees, readRegistry, writeRegistry: true } },
])("$name refuses before executing project capabilities", ({ generator, registry }) => {
  expect(previewRuntimeContract({ generator, registry })).toEqual({ kind: "invalid", reason: "incompatible-exports" });
  expect(generatePreviewLaunch.mock.calls).toEqual([]);
  expect(mainRootFrom.mock.calls).toEqual([]);
  expect(prunedWorktrees.mock.calls).toEqual([]);
  expect(readRegistry.mock.calls).toEqual([]);
  expect(writeRegistry.mock.calls).toEqual([]);
});

test.each([
  { outcome: { kind: "registered" }, expected: { exitCode: 0, diagnostic: "" } },
  { outcome: { kind: "not-requested" }, expected: { exitCode: 0, diagnostic: "" } },
  { outcome: { kind: "unavailable", reason: "missing-runtime" }, expected: { exitCode: 1, diagnostic: "Rin preview registration unavailable: project scripts must provide generate-preview-launch.mjs and preview-worktree-registry.mjs.\n" } },
  { outcome: { kind: "invalid", reason: "incompatible-exports" }, expected: { exitCode: 1, diagnostic: "Rin preview registration unavailable: project preview helpers do not provide the required registration exports.\n" } },
  { outcome: { kind: "failed", reason: "load-failed" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: project preview helpers could not be loaded.\n" } },
  { outcome: { kind: "failed", reason: "input-failed" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: hook input could not be read.\n" } },
  { outcome: { kind: "failed", reason: "execution-failed" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: project preview helpers could not complete registration.\n" } },
  { outcome: { kind: "failed", reason: "unexpected" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: project preview helpers could not complete registration.\n" } },
  { outcome: { kind: "failed", reason: "constructor" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: the hook returned an invalid outcome.\n" } },
  { outcome: { kind: "failed", reason: "toString" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: the hook returned an invalid outcome.\n" } },
  { outcome: { kind: "failed", reason: "__proto__" }, expected: { exitCode: 1, diagnostic: "Rin preview registration failed: the hook returned an invalid outcome.\n" } },
])("renders bounded hook disposition for $outcome.kind $outcome.reason", ({ outcome, expected }) => {
  expect(previewRegistrationDisposition({ outcome })).toEqual(expected);
});


test.each([
  { reason: "missing-runtime", expected: { kind: "unavailable", reason: "missing-runtime" } },
  { reason: "incompatible-exports", expected: { kind: "invalid", reason: "incompatible-exports" } },
  { reason: "load-failed", expected: { kind: "failed", reason: "load-failed" } },
  { reason: "input-failed", expected: { kind: "failed", reason: "input-failed" } },
  { reason: "execution-failed", expected: { kind: "failed", reason: "execution-failed" } },
  { reason: "unexpected", expected: { kind: "failed", reason: "unexpected" } },
  { reason: "unknown-outcome", expected: { kind: "invalid-protocol", reason: "unknown-outcome" } },
  { reason: "constructor", expected: { kind: "invalid-protocol", reason: "unknown-outcome" } },
])("constructs a plain tagged failure for $reason", ({ reason, expected }) => {
  expect(previewFailure({ reason })).toEqual(expected);
});

test.each([
  { name: "registered", outcome: { kind: "registered" }, expected: true },
  { name: "not requested", outcome: { kind: "not-requested" }, expected: true },
  { name: "unavailable", outcome: { kind: "unavailable", reason: "missing-runtime" }, expected: true },
  { name: "invalid contract", outcome: { kind: "invalid", reason: "incompatible-exports" }, expected: true },
  { name: "load failure", outcome: { kind: "failed", reason: "load-failed" }, expected: true },
  { name: "input failure", outcome: { kind: "failed", reason: "input-failed" }, expected: true },
  { name: "execution failure", outcome: { kind: "failed", reason: "execution-failed" }, expected: true },
  { name: "unexpected failure", outcome: { kind: "failed", reason: "unexpected" }, expected: true },
  { name: "invalid protocol", outcome: { kind: "invalid-protocol", reason: "unknown-outcome" }, expected: true },
  { name: "null", outcome: null, expected: false },
  { name: "missing kind", outcome: {}, expected: false },
  { name: "unknown kind", outcome: { kind: "other" }, expected: false },
  { name: "missing failure reason", outcome: { kind: "failed" }, expected: false },
  { name: "mismatched kind and reason", outcome: { kind: "unavailable", reason: "load-failed" }, expected: false },
  { name: "prototype reason", outcome: { kind: "failed", reason: "constructor" }, expected: false },
  { name: "inherited kind", outcome: inheritedOutcome, expected: false },
  { name: "success with failure reason", outcome: { kind: "registered", reason: "load-failed" }, expected: false },
])("admits only the closed outcome protocol: $name", ({ outcome, expected }) => {
  expect(isPreviewOutcome({ outcome })).toBe(expected);
});

test.each([
  null,
  {},
  { kind: "other", reason: "load-failed" },
  { kind: "unavailable", reason: "load-failed" },
])("unknown outcome %p has a distinct bounded protocol diagnostic", (outcome) => {
  expect(previewRegistrationDisposition({ outcome })).toEqual({ exitCode: 1, diagnostic: "Rin preview registration failed: the hook returned an invalid outcome.\n" });
});
