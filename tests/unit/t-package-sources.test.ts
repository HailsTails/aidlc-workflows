// covers: file:src/packaging/adapters/packaged-sources-file.ts
import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPackagedSourcesFile } from "../../src/packaging/adapters/packaged-sources-file.ts";
import { createNodeFileSystem } from "../../src/kernel/file-system.ts";
import { createBunContentDigester } from "../../src/kernel/content-digester.ts";
import { distributionId } from "../../src/kernel/values.ts";
import { assertRunnerFixtureImports } from "../lib/runner-fixture-imports.ts";
import { NATIVE_STARTUP_TIMEOUT_MS } from "../harness/test-budget.ts";

const SOURCE = resolve(import.meta.dir, "../..");
const GENERATOR = "tests/gen-coverage-registry.ts";
const GENERATOR_SOURCES = [
  GENERATOR,
  "src/packaging/adapters/packaged-sources-file.ts", "src/kernel/file-system.ts", "src/kernel/file-system-port.ts",
  "src/kernel/content-digester.ts", "src/kernel/values.ts", "src/kernel/brand.ts", "src/kernel/result.ts",
];
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "aidlc-package-sources-"));
  roots.push(root);
  for (const path of GENERATOR_SOURCES) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(join(SOURCE, path), join(root, path));
  }
  assertRunnerFixtureImports(root, [GENERATOR]);
  cpSync(join(SOURCE, "node_modules", "zod"), join(root, "node_modules", "zod"), { recursive: true });
  return root;
}

function runGenerator(root: string, registry: string, args: readonly string[]): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [join(root, GENERATOR), ...args], {
    encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
    env: { ...process.env, AIDLC_COVERAGE_SRC_ROOT: root,
      AIDLC_COVERAGE_TESTS_DIR: join(root, "tests"), AIDLC_COVERAGE_REGISTRY: registry },
  });
}

test("copied coverage refuses stale sources without changing its registry", async () => {
  const root = fixture();
  mkdirSync(join(root, "core", "tools"), { recursive: true });
  const input = join(root, "core", "tools", "example.ts");
  writeFileSync(input, "export const x = 1;\n");
  const sources = createPackagedSourcesFile({ repository: pathToFileURL(`${root}/`),
    record: pathToFileURL(join(root, "dist", ".package-sources.json")),
    fileSystem: createNodeFileSystem(), hasher: createBunContentDigester() });
  const host = distributionId("claude");
  const builtFrom = await sources.fingerprint();
  expect(host.ok).toBe(true);
  expect(builtFrom.ok).toBe(true);
  if (!host.ok || !builtFrom.ok) throw new Error("Fixture admission failed");
  expect(await sources.record({ hosts: [host.value], builtFrom: builtFrom.value }))
    .toEqual({ ok: true, value: "recorded" });
  writeFileSync(input, "export const x = 2;\n");
  const registry = join(root, "registry.json");
  writeFileSync(registry, "committed\n");
  for (const args of [["--check"], []]) {
    const run = runGenerator(root, registry, args);
    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(String(run.stderr).trim().split("\n")).toEqual([
      "coverage registry: dist/claude was packaged from other sources than this checkout: " +
        "run `bun scripts/package.ts` first.",
    ]);
    expect(readFileSync(registry, "utf8")).toBe("committed\n");
  }
});

test("copied coverage prints a source refusal before changing its registry", () => {
  const root = fixture();
  mkdirSync(join(root, "core"));
  mkdirSync(join(root, "scripts", "package.ts"), { recursive: true });
  const registry = join(root, "registry.json");
  writeFileSync(registry, "committed\n");
  const run = runGenerator(root, registry, ["--check"]);
  expect(run.status).toBe(1);
  expect(run.stdout).toBe("");
  expect(String(run.stderr).trim().split("\n")).toEqual([
    'coverage registry: {"kind":"packaged-sources-failed","operation":"read-inputs",' +
      '"path":"scripts/package.ts","reason":"not-a-file"}',
  ]);
  expect(readFileSync(registry, "utf8")).toBe("committed\n");
});
