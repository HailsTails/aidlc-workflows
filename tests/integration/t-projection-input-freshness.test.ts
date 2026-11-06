import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { packageInputsFingerprint, recordPackagedSources, stalePackageMessage } from "../../scripts/package-sources.ts";

const scratch = mkdtempSync(join(tmpdir(), "projection-input-freshness-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const inputFixture = ({ path, name }: { readonly path: string; readonly name: string }) => {
  const root = join(scratch, name);
  const inputPath = join(root, path);
  mkdirSync(dirname(inputPath), { recursive: true });
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(inputPath, "// source before\n");
  recordPackagedSources(root, ["claude"], packageInputsFingerprint(root));
  return { root, inputPath };
};

test("a changed producer input invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "scripts/plugin-runtime.ts", name: "changed-runtime" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// source changed\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("rewriting identical producer bytes leaves the output current", () => {
  const fixture = inputFixture({ path: "scripts/plugin-runtime.ts", name: "identical" });
  writeFileSync(fixture.inputPath, "// source before\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
});

test("an agent surface policy edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "scripts/agent-surface-projection.ts", name: "changed-agent-surfaces" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed dispatch/persona decision\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("an onboarding projection edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "scripts/onboarding-projection.ts", name: "changed-onboarding-projection" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed shared/native onboarding placement\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("an authored harness projection edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "scripts/harness-surface-projection.ts", name: "changed-harness-surface" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed authored host projection\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("an unrelated test module does not invalidate runtime output", () => {
  const fixture = inputFixture({ path: "scripts/plugin-runtime.test.ts", name: "test-module" });
  writeFileSync(fixture.inputPath, "// test changed\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
});

test("a core projection contract edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "scripts/core-projection-contract.ts", name: "changed-core-projection" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed native declaration coverage\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("a runtime harness data projection edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "scripts/harness-runtime-data.ts", name: "changed-harness-runtime-data" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed runtime field selection\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("a core root-integration codec edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "core/tools/aidlc-root-integration-codec.ts", name: "changed-root-codec" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed root-policy wire compatibility\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});

test("a core projection path edit invalidates the persisted consumer record", () => {
  const fixture = inputFixture({ path: "core/tools/aidlc-projection-path.ts", name: "changed-projection-path" });
  expect(stalePackageMessage(fixture.root, "claude")).toBeNull();
  writeFileSync(fixture.inputPath, "// changed projection path admission\n");
  expect(stalePackageMessage(fixture.root, "claude")).toBe("dist/claude was packaged from other sources than this checkout: run \u0060bun scripts/package.ts\u0060 first.");
});
