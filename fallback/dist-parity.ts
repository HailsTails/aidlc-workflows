#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const OUTPUT_ROOTS = ["dist", "dist-release"] as const;
const HARNESS_ROOT = "dist-release";
const GOLDEN_DIRECTORY = join(REPO_ROOT, "tests", "golden");
const PLUGIN_MARKETPLACES = "plugin-marketplaces";
const SHA256 = /^[0-9a-f]{64}$/;

const USAGE = [
  "usage: bun scripts/dist-parity.ts (--record | --check)",
  "  --record  hash every generated file and write tests/golden/<group>.json",
  "  --check   hash every generated file and compare with tests/golden/<group>.json",
  "Build the trees first with: bun scripts/package.ts",
].join("\n");

type Mode = "record" | "check";
type Manifest = Readonly<Record<string, string>>;
type GoldenSet = Readonly<Record<string, Manifest>>;
type Change = "added" | "removed" | "changed";
type Drift = { readonly group: string; readonly path: string; readonly change: Change };
type GoldenFile = { readonly schemaVersion: 1; readonly group: string; readonly files: Manifest };

const byPath = (left: string, right: string): number => left.localeCompare(right);

const modeFrom = (argv: readonly string[]): Mode | undefined =>
  (["record", "check"] as const).find((mode) => argv.includes(`--${mode}`));

const directoryNames = (path: string): readonly string[] =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const generatedFiles = (outputRoot: string): readonly string[] => {
  const absolute = join(REPO_ROOT, outputRoot);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(REPO_ROOT.length + 1).replaceAll("\\", "/"));
};

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(join(REPO_ROOT, path))).digest("hex");

const groupOf = (path: string, harnesses: readonly string[]): string | undefined => {
  const [root, first, , third] = path.split("/");
  const isPluginTree = root === "dist" && first === "plugins";
  const candidate = isPluginTree ? third : first;
  if (candidate !== undefined && harnesses.includes(candidate)) return candidate;
  return isPluginTree ? PLUGIN_MARKETPLACES : undefined;
};

const sortedManifest = (entries: readonly (readonly [string, string])[]): Manifest =>
  Object.fromEntries([...entries].sort(([left], [right]) => byPath(left, right)));

const measured = (): GoldenSet => {
  const harnesses = directoryNames(join(REPO_ROOT, HARNESS_ROOT));
  const grouped = new Map<string, (readonly [string, string])[]>();
  for (const path of OUTPUT_ROOTS.flatMap(generatedFiles)) {
    const group = groupOf(path, harnesses);
    if (group !== undefined) grouped.set(group, [...(grouped.get(group) ?? []), [path, sha256(path)]]);
  }
  return Object.fromEntries([...grouped].map(([group, entries]) => [group, sortedManifest(entries)]));
};

const isManifest = (value: unknown): value is Manifest =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((digest) => typeof digest === "string" && SHA256.test(digest));

const isGoldenFile = (value: unknown): value is GoldenFile =>
  typeof value === "object" &&
  value !== null &&
  "schemaVersion" in value &&
  value.schemaVersion === 1 &&
  "group" in value &&
  typeof value.group === "string" &&
  "files" in value &&
  isManifest(value.files);

const goldenFile = (name: string): GoldenFile => {
  const parsed: unknown = JSON.parse(readFileSync(join(GOLDEN_DIRECTORY, name), "utf8"));
  if (!isGoldenFile(parsed)) throw new Error(`tests/golden/${name} is not a golden file`);
  return parsed;
};

const recorded = (): GoldenSet =>
  Object.fromEntries(
    readdirSync(GOLDEN_DIRECTORY)
      .filter((name) => name.endsWith(".json"))
      .map(goldenFile)
      .map((golden) => [golden.group, golden.files]),
  );

const changeOf = (expected: string | undefined, actual: string | undefined): Change => {
  if (expected === undefined) return "added";
  return actual === undefined ? "removed" : "changed";
};

const unionOf = (left: object, right: object): readonly string[] =>
  [...new Set([...Object.keys(left), ...Object.keys(right)])].sort(byPath);

const driftBetween = (expected: GoldenSet, actual: GoldenSet): readonly Drift[] =>
  unionOf(expected, actual).flatMap((group) => {
    const before = expected[group] ?? {};
    const after = actual[group] ?? {};
    return unionOf(before, after)
      .filter((path) => before[path] !== after[path])
      .map((path) => ({ group, path, change: changeOf(before[path], after[path]) }));
  });

const fileCount = (set: GoldenSet): number =>
  Object.values(set).reduce((total, manifest) => total + Object.keys(manifest).length, 0);

const record = (): number => {
  const actual = measured();
  mkdirSync(GOLDEN_DIRECTORY, { recursive: true });
  for (const [group, files] of Object.entries(actual)) {
    const content = `${JSON.stringify({ schemaVersion: 1, group, files }, null, 2)}\n`;
    writeFileSync(join(GOLDEN_DIRECTORY, `${group}.json`), content);
  }
  process.stdout.write(`dist parity: recorded ${fileCount(actual)} files in ${Object.keys(actual).length} groups\n`);
  return 0;
};

const check = (): number => {
  const actual = measured();
  const drift = driftBetween(recorded(), actual);
  for (const entry of drift) process.stderr.write(`${entry.change}: ${entry.group} · ${entry.path}\n`);
  const summary = `${fileCount(actual)} files in ${Object.keys(actual).length} groups`;
  process.stdout.write(`dist parity: ${summary}, ${drift.length} differences\n`);
  return drift.length === 0 ? 0 : 1;
};

const main = (): number => {
  const mode = modeFrom(Bun.argv.slice(2));
  if (mode === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  return mode === "record" ? record() : check();
};

process.exitCode = main();
