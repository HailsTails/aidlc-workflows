import { expect, mock, test } from "bun:test";
import { collaboratorFault } from "../../../../tests/harness/collaborator-fault.ts";
import type { ChildRuntimeDirectories } from "./child-runtime-directory.ts";
import type { DistributionDirectories } from "./distribution-directory.ts";
import { withFreshCoreDirectories } from "./fresh-core-directories.ts";

test("fresh core consumes only after both independent roots exist and releases both", async () => {
  const artifact = { issued: "artifact" };
  const runtimeDirectories = { allocate: mock(() => "runtime-root"), remove: mock<ChildRuntimeDirectories["remove"]>(() => undefined) };
  const distributionDirectories = { allocate: mock(() => "distribution-root"), remove: mock<DistributionDirectories["remove"]>(() => ({ status: "removed" })) };
  const consume = mock(async (_roots: { readonly runtimeRoot: string; readonly distributionRoot: string }) => artifact);
  expect(await withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume })).toBe(artifact);
  expect(consume.mock.calls).toEqual([[{ runtimeRoot: "runtime-root", distributionRoot: "distribution-root" }]]);
  expect(distributionDirectories.remove.mock.calls).toEqual([[{ root: "distribution-root" }]]);
  expect(runtimeDirectories.remove.mock.calls).toEqual([[{ root: "runtime-root" }]]);
  expect(runtimeDirectories.allocate.mock.invocationCallOrder[0]).toBeLessThan(distributionDirectories.allocate.mock.invocationCallOrder[0]!);
  expect(distributionDirectories.allocate.mock.invocationCallOrder[0]).toBeLessThan(consume.mock.invocationCallOrder[0]!);
  expect(consume.mock.invocationCallOrder[0]).toBeLessThan(distributionDirectories.remove.mock.invocationCallOrder[0]!);
  expect(distributionDirectories.remove.mock.invocationCallOrder[0]).toBeLessThan(runtimeDirectories.remove.mock.invocationCallOrder[0]!);
});

test("first allocation failure cannot consume or remove either unallocated root", async () => {
  const failure = new Error("first allocation failed");
  const runtimeDirectories = { allocate: mock(collaboratorFault(failure)), remove: mock<ChildRuntimeDirectories["remove"]>(() => undefined) };
  const distributionDirectories = { allocate: mock(() => "distribution-root"), remove: mock<DistributionDirectories["remove"]>(() => ({ status: "removed" })) };
  const consume = mock(async () => "unissued");
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume })).rejects.toBe(failure);
  expect(distributionDirectories.allocate).not.toHaveBeenCalled();
  expect(runtimeDirectories.remove).not.toHaveBeenCalled();
  expect(distributionDirectories.remove).not.toHaveBeenCalled();
  expect(consume).not.toHaveBeenCalled();
});

test("second allocation failure releases the first root without consuming", async () => {
  const failure = new Error("second allocation failed");
  const runtimeDirectories = { allocate: () => "runtime-root", remove: mock<ChildRuntimeDirectories["remove"]>(() => undefined) };
  const distributionDirectories = { allocate: mock(collaboratorFault(failure)), remove: mock<DistributionDirectories["remove"]>(() => ({ status: "removed" })) };
  const consume = mock(async () => "unissued");
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume })).rejects.toBe(failure);
  expect(runtimeDirectories.remove.mock.calls).toEqual([[{ root: "runtime-root" }]]);
  expect(distributionDirectories.remove).not.toHaveBeenCalled();
  expect(consume).not.toHaveBeenCalled();
});

test.each([undefined, null])("fresh core preserves the original %s rejection when cleanup succeeds", async failure => {
  const runtimeDirectories = { allocate: () => "runtime-root", remove: mock<ChildRuntimeDirectories["remove"]>(() => undefined) };
  const distributionDirectories = { allocate: () => "distribution-root", remove: mock<DistributionDirectories["remove"]>(() => ({ status: "removed" })) };
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume: () => Promise.reject(failure) })).rejects.toBe(failure);
  expect(runtimeDirectories.remove.mock.calls).toEqual([[{ root: "runtime-root" }]]);
  expect(distributionDirectories.remove.mock.calls).toEqual([[{ root: "distribution-root" }]]);
});

test("primary failure and both cleanup failures remain ordered and visible", async () => {
  const primary = new Error("consume failed"), distributionFailure = new Error("distribution cleanup failed"), runtimeFailure = new Error("runtime cleanup failed");
  const runtimeDirectories = { allocate: () => "runtime-root", remove: mock<ChildRuntimeDirectories["remove"]>(collaboratorFault(runtimeFailure)) };
  const distributionDirectories = { allocate: () => "distribution-root", remove: mock<DistributionDirectories["remove"]>(collaboratorFault(distributionFailure)) };
  const observeFailure = mock<(failure: AggregateError) => void>(() => undefined);
  await withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume: () => Promise.reject(primary) }).catch(observeFailure);
  const observedFailure = observeFailure.mock.calls[0]![0];
  expect(observedFailure).toBeInstanceOf(AggregateError);
  expect(observedFailure).toMatchObject({ message: "Fresh core session and cleanup failed", errors: [primary, distributionFailure, runtimeFailure] });
  const failures = observedFailure.errors;
  expect(failures[0]).toBe(primary);
  expect(failures[1]).toBe(distributionFailure);
  expect(failures[2]).toBe(runtimeFailure);
  expect(distributionDirectories.remove.mock.calls).toEqual([[{ root: "distribution-root" }]]);
  expect(runtimeDirectories.remove.mock.calls).toEqual([[{ root: "runtime-root" }]]);
});

test("successful consumption preserves one cleanup failure directly and attempts its sibling", async () => {
  const failure = new Error("distribution cleanup failed");
  const runtimeDirectories = { allocate: () => "runtime-root", remove: mock<ChildRuntimeDirectories["remove"]>(() => undefined) };
  const distributionDirectories = { allocate: () => "distribution-root", remove: mock<DistributionDirectories["remove"]>(collaboratorFault(failure)) };
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume: async () => "unissued" })).rejects.toBe(failure);
  expect(runtimeDirectories.remove.mock.calls).toEqual([[{ root: "runtime-root" }]]);
});

test("successful consumption combines both cleanup failures without issuing its value", async () => {
  const distributionFailure = new Error("distribution cleanup failed"), runtimeFailure = new Error("runtime cleanup failed");
  const runtimeDirectories = { allocate: () => "runtime-root", remove: mock<ChildRuntimeDirectories["remove"]>(collaboratorFault(runtimeFailure)) };
  const distributionDirectories = { allocate: () => "distribution-root", remove: mock<DistributionDirectories["remove"]>(collaboratorFault(distributionFailure)) };
  const observeFailure = mock<(failure: AggregateError) => void>(() => undefined);
  await withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume: async () => "unissued" }).catch(observeFailure);
  const observedFailure = observeFailure.mock.calls[0]![0];
  expect(observedFailure).toBeInstanceOf(AggregateError);
  expect(observedFailure).toMatchObject({ message: "Fresh core session cleanup failed", errors: [distributionFailure, runtimeFailure] });
  const failures = observedFailure.errors;
  expect(failures[0]).toBe(distributionFailure);
  expect(failures[1]).toBe(runtimeFailure);
  expect(distributionDirectories.remove.mock.calls).toEqual([[{ root: "distribution-root" }]]);
  expect(runtimeDirectories.remove.mock.calls).toEqual([[{ root: "runtime-root" }]]);
});
