// covers: file:src/packaging/adapters/packaged-sources-file.ts
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPackagedSourcesFile } from "../../src/packaging/adapters/packaged-sources-file.ts";
import { createNodeFileSystem } from "../../src/kernel/file-system.ts";
import { createBunContentDigester } from "../../src/kernel/content-digester.ts";
import { distributionId, type DistributionId } from "../../src/kernel/values.ts";
import type { PackagedSources } from "../../src/packaging/application/ports.ts";
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

const PACKAGE_SOURCES_FILE = join("dist", ".package-sources.json");
const NEVER_PACKAGED = "dist/claude has no record of the sources it was packaged from: run `bun scripts/package.ts` first.";

function checkout(): string {
  const root = mkdtempSync(join(tmpdir(), "aidlc-package-sources-"));
  roots.push(root);
  for (const [path, body] of [
    ["core/tools/example.ts", "export const x = 1;\n"],
    ["harness/claude/hooks/example.ts", "export default {};\n"],
    ["src/hosts/claude/host-data.ts", "export default {};\n"],
    ["plugins/demo/stages/s.md", "# s\n"],
    ["plugins/demo/tests/t.test.ts", "// a plugin test\n"],
    ["scripts/package.ts", "// packager\n"],
    ["scripts/plugin-hooks-template/compose.ts", "// compose\n"],
  ] as const) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  mkdirSync(join(root, "dist"));
  return root;
}

function sourcesOf(root: string): PackagedSources {
  return createPackagedSourcesFile({ repository: pathToFileURL(`${root}/`),
    record: pathToFileURL(join(root, PACKAGE_SOURCES_FILE)),
    fileSystem: createNodeFileSystem(), hasher: createBunContentDigester() });
}

function host(name: string): DistributionId {
  const admitted = distributionId(name);
  if (!admitted.ok) throw new Error(`Fixture host ${name} was refused`);
  return admitted.value;
}

async function fingerprintOf(root: string): Promise<string> {
  const fingerprint = await sourcesOf(root).fingerprint();
  if (!fingerprint.ok) throw new Error(JSON.stringify(fingerprint.refusal));
  return fingerprint.value;
}

async function stalenessOf(root: string, name: string): Promise<string | null> {
  const staleness = await sourcesOf(root).staleness(host(name));
  if (!staleness.ok) throw new Error(JSON.stringify(staleness.refusal));
  return staleness.value;
}

async function recordFor(root: string, names: readonly string[], builtFrom: string): Promise<string> {
  const recorded = await sourcesOf(root).record({ hosts: names.map(host), builtFrom });
  if (!recorded.ok) throw new Error(JSON.stringify(recorded.refusal));
  return recorded.value;
}

async function forgetFor(root: string, names: readonly string[]): Promise<void> {
  const forgotten = await sourcesOf(root).forget(names.map(host));
  if (!forgotten.ok) throw new Error(JSON.stringify(forgotten.refusal));
}

describe("the packaged-sources fingerprint", () => {
  test("changes with a packaged input and comes back when the edit is undone", async () => {
    const root = checkout();
    const before = await fingerprintOf(root);
    expect(await fingerprintOf(root)).toBe(before);
    writeFileSync(join(root, "core/tools/example.ts"), "export const x = 2;\n");
    expect(await fingerprintOf(root)).not.toBe(before);
    writeFileSync(join(root, "core/tools/example.ts"), "export const x = 1;\n");
    expect(await fingerprintOf(root)).toBe(before);
  });

  test.each([
    ["harness/claude/hooks/example.ts"],
    ["src/hosts/claude/host-data.ts"],
    ["plugins/demo/stages/s.md"],
    ["scripts/package.ts"],
    ["scripts/plugin-hooks-template/compose.ts"],
  ])("covers %s", async (path) => {
    const root = checkout();
    const before = await fingerprintOf(root);
    writeFileSync(join(root, path), "changed\n");
    expect(await fingerprintOf(root)).not.toBe(before);
  });

  test("ignores what the packager never reads: plugin tests, node_modules, the rest of scripts/ and tests/", async () => {
    const root = checkout();
    const before = await fingerprintOf(root);
    writeFileSync(join(root, "plugins/demo/tests/t.test.ts"), "// edited\n");
    mkdirSync(join(root, "core/node_modules/dep"), { recursive: true });
    writeFileSync(join(root, "core/node_modules/dep/index.js"), "x");
    writeFileSync(join(root, "scripts/ci-other.ts"), "x");
    mkdirSync(join(root, "tests"));
    writeFileSync(join(root, "tests/t1.test.ts"), "x");
    writeFileSync(join(root, "src/hosts/claude/host-data.test.ts"), "x");
    expect(await fingerprintOf(root)).toBe(before);
  });
});

describe("the packaged-sources record", () => {
  test("a tree with no record, or an unreadable one, is reported as never packaged", async () => {
    const root = checkout();
    expect(await stalenessOf(root, "claude")).toBe(NEVER_PACKAGED);
    writeFileSync(join(root, PACKAGE_SOURCES_FILE), "{");
    expect(await stalenessOf(root, "claude")).toBe(NEVER_PACKAGED);
  });

  test("a recorded tree is current until a packaged input changes", async () => {
    const root = checkout();
    await recordFor(root, ["claude", "kiro"], await fingerprintOf(root));
    expect(await stalenessOf(root, "claude")).toBeNull();
    writeFileSync(join(root, "core/tools/example.ts"), "export const x = 2;\n");
    expect(await stalenessOf(root, "claude")).toBe(
      "dist/claude was packaged from other sources than this checkout: run `bun scripts/package.ts` first.",
    );
  });

  test("a one-harness build updates its own entry and keeps the others", async () => {
    const root = checkout();
    await recordFor(root, ["claude", "kiro"], await fingerprintOf(root));
    writeFileSync(join(root, "core/tools/example.ts"), "export const x = 2;\n");
    await recordFor(root, ["kiro"], await fingerprintOf(root));
    expect(await stalenessOf(root, "kiro")).toBeNull();
    expect(await stalenessOf(root, "claude")).toContain("was packaged from other");
    expect(Object.keys(JSON.parse(readFileSync(join(root, PACKAGE_SOURCES_FILE), "utf8")).harnesses))
      .toEqual(["claude", "kiro"]);
  });

  test("a source edited while the build runs leaves its trees unrecorded, and says so to the caller", async () => {
    const root = checkout();
    await recordFor(root, ["claude"], await fingerprintOf(root));
    const builtFrom = await fingerprintOf(root);
    await forgetFor(root, ["claude"]);
    writeFileSync(join(root, "core/tools/example.ts"), "export const x = 2;\n");
    expect(await recordFor(root, ["claude"], builtFrom)).toBe("inputs-changed");
    expect(await stalenessOf(root, "claude")).toContain("has no record");
  });

  test("a build that stops halfway leaves its trees unrecorded, never current", async () => {
    const root = checkout();
    await recordFor(root, ["claude", "kiro"], await fingerprintOf(root));
    await forgetFor(root, ["claude"]);
    expect(await stalenessOf(root, "claude")).toContain("has no record");
    expect(await stalenessOf(root, "kiro")).toBeNull();
    const fresh = checkout();
    await forgetFor(fresh, ["claude"]);
    expect(existsSync(join(fresh, PACKAGE_SOURCES_FILE))).toBe(false);
  });
});

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
