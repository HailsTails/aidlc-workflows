import { expect, mock, test } from "bun:test";
import { reportPackageRuntimeFailure, type PackageRuntimeCliPort } from "./package-runtime-cli.ts";

test("authored runtime refusal is printed with a failing CLI status", () => {
  const writeError = mock<PackageRuntimeCliPort["writeError"]>();
  const setExitCode = mock<PackageRuntimeCliPort["setExitCode"]>();
  reportPackageRuntimeFailure({ failure: { kind: "refused", message: "unsupported metadata" }, port: { writeError, setExitCode } });
  expect(writeError.mock.calls).toEqual([[{ message: "unsupported metadata" }]]);
  expect(setExitCode.mock.calls).toEqual([[{ code: 1 }]]);
});

test("compiler failure is reported without throwing or terminating inside the runtime service", () => {
  const writeError = mock<PackageRuntimeCliPort["writeError"]>();
  const setExitCode = mock<PackageRuntimeCliPort["setExitCode"]>();
  reportPackageRuntimeFailure({ failure: { kind: "unavailable", error: {
    kind: "runtime-bundle-failed", pluginRoot: "/plugin", file: "guard.ts", message: "bundle failed", cause: new Error("bundle failed"),
  } }, port: { writeError, setExitCode } });
  expect(writeError.mock.calls).toEqual([[{ message: "bundle failed" }]]);
  expect(setExitCode.mock.calls).toEqual([[{ code: 1 }]]);
});

test("artifact write failure reaches the same explicit CLI boundary", () => {
  const writeError = mock<PackageRuntimeCliPort["writeError"]>();
  const setExitCode = mock<PackageRuntimeCliPort["setExitCode"]>();
  reportPackageRuntimeFailure({ failure: { kind: "unavailable", error: {
    kind: "artifact-write-failed", outDir: "/output", file: "guard.ts", message: "disk full", writtenFiles: [],
  } }, port: { writeError, setExitCode } });
  expect(writeError.mock.calls).toEqual([[{ message: "disk full" }]]);
  expect(setExitCode.mock.calls).toEqual([[{ code: 1 }]]);
});
