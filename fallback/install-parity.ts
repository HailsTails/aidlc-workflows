#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = join(import.meta.dir, "..");
const CURRENT_DIST = join(REPO_ROOT, "dist");
const HARNESS_ROOT = join(REPO_ROOT, "dist-release");
const GOLDEN_DIRECTORY = join(REPO_ROOT, "tests", "golden", "install");
const PREVIOUS_ENV = "AIDLC_PREVIOUS_DIST";

const USAGE = [
  "usage: bun scripts/install-parity.ts (--record | --check) --previous <dist folder>",
  "  --record    install every harness through the copy-channel CLI and write tests/golden/install",
  "  --check     install every harness again and compare with tests/golden/install",
  `  --previous  the dist folder built from the previous release (or ${PREVIOUS_ENV})`,
  "Build both trees first:",
  "  bun scripts/package.ts",
  "  git worktree add ../aidlc-previous-release v2.11.2",
  "  bun install --cwd ../aidlc-previous-release",
  "  bun ../aidlc-previous-release/scripts/package.ts",
].join("\n");

const PERSON_FILES: Readonly<Record<string, string>> = {
  "README.md": "# greeter\n\nA tiny command-line greeter.\n",
  ".gitignore": "node_modules/\n",
  "AGENTS.md": "# Team notes\n\nRun the tests before you push.\n",
};

const COPY_OMITS = [
  "const { copyChannelOmits, projectionFiles } = await import(tool);",
  "console.log(JSON.stringify([...copyChannelOmits(projectionFiles(args[0]).descriptor)]));",
].join("\n");

const HARNESS_NAME = [
  "const { harnessNameFor } = await import(tool);",
  "console.log(JSON.stringify(harnessNameFor(args[0], args[1])));",
].join("\n");

const QUERY_PRELUDE = "const [tool, ...args] = JSON.parse(process.argv.at(-1));";

type Mode = "record" | "check";
type Runtime = "current" | "previous";
type FileTree = Readonly<Record<string, string>>;
type TreeChange = { readonly added: FileTree; readonly changed: FileTree; readonly removed: readonly string[] };
type StepResult = { readonly exitCode: number; readonly change: TreeChange };
type ConfigRun = { readonly exitCode: number; readonly output: string };
type ConfigRequest = { readonly runtime: Runtime; readonly force: boolean };

type Lifecycle = {
  readonly harness: string;
  readonly release: string;
  readonly previousRelease: string;
  readonly fresh: { readonly exitCode: number; readonly tree: FileTree };
  readonly refresh: StepResult;
  readonly localEdit: StepResult & { readonly file: string; readonly named: boolean };
  readonly force: StepResult;
  readonly upgrade: StepResult & { readonly previousExitCode: number };
};

type Request = { readonly mode: Mode; readonly previous: string };

type Lab = {
  readonly sandbox: string;
  readonly runtimes: Readonly<Record<Runtime, string>>;
};

type Sandbox = {
  readonly lab: Lab;
  readonly harness: string;
  readonly root: string;
  readonly environment: Readonly<Record<string, string>>;
};

type Project = {
  readonly copyIn: (runtime: Runtime) => void;
  readonly config: (request: ConfigRequest) => ConfigRun;
  readonly ownedSample: () => string;
  readonly append: (path: string) => void;
  readonly tree: () => FileTree;
};

type Comparison<T> = { readonly label: string; readonly expected: T; readonly actual: T };

const CURRENT: ConfigRequest = { runtime: "current", force: false };

const byPath = (left: string, right: string): number => left.localeCompare(right);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (value: unknown, field: string): string => {
  const read = isRecord(value) ? value[field] : undefined;
  if (typeof read !== "string") throw new Error(`expected a string ${field}`);
  return read;
};

const stringList = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("expected a list of strings");
  }
  return value;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const requestFrom = (argv: readonly string[]): Request | undefined => {
  const mode = (["record", "check"] as const).find((name) => argv.includes(`--${name}`));
  const flagged = argv.includes("--previous") ? argv[argv.indexOf("--previous") + 1] : undefined;
  const previous = flagged ?? process.env[PREVIOUS_ENV];
  return mode === undefined || previous === undefined ? undefined : { mode, previous: resolve(previous) };
};

const harnesses = (): readonly string[] =>
  readdirSync(HARNESS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const harnessDirOf = (root: string): string =>
  readdirSync(root).find((name) => existsSync(join(root, name, "tools", "data", "aidlc-stamp.json"))) ?? "";

const toolOf = (root: string, file: string): string => join(root, harnessDirOf(root), "tools", file);

const releaseOf = (lab: Lab, runtime: Runtime): string => {
  const root = join(lab.runtimes[runtime], "claude");
  return stringField(readJson(toolOf(root, join("data", "aidlc-stamp.json"))), "frameworkVersion");
};

const childEnvironment = (root: string): Readonly<Record<string, string>> => {
  const home = join(root, "home");
  const temp = join(root, "temp");
  const globalGit = join(root, "gitconfig");
  mkdirSync(temp, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(globalGit, "[user]\n\tname = Person\n\temail = person@example.com\n");
  return {
    PATH: process.env["PATH"] ?? "",
    SystemRoot: process.env["SystemRoot"] ?? "",
    HOME: home,
    USERPROFILE: home,
    APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    XDG_CONFIG_HOME: join(home, ".config"),
    AIDLC_INSTALL_ROOT: join(home, "aidlc-machine"),
    TEMP: temp,
    TMP: temp,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: globalGit,
  };
};

const askRuntime = (sandbox: Sandbox, tool: string, script: string, args: readonly string[]): unknown => {
  const payload = JSON.stringify([pathToFileURL(tool).href, ...args]);
  const run = spawnSync(process.execPath, ["--eval", `${QUERY_PRELUDE}\n${script}`, payload], {
    env: sandbox.environment,
    encoding: "utf8",
  });
  return JSON.parse(run.stdout);
};

const copyRuntimeOf = (sandbox: Sandbox, runtime: Runtime): string => {
  const target = join(sandbox.root, `runtime-${runtime}`, "runtime", sandbox.harness);
  if (existsSync(target)) return target;
  const shipped = join(sandbox.lab.runtimes[runtime], sandbox.harness);
  cpSync(shipped, target, { recursive: true });
  const omits = stringList(askRuntime(sandbox, toolOf(shipped, "aidlc-distribution.ts"), COPY_OMITS, [shipped]));
  for (const path of omits) rmSync(join(target, path), { force: true });
  return target;
};

const harnessNameFor = (sandbox: Sandbox, project: string): string => {
  const current = join(sandbox.lab.runtimes.current, sandbox.harness);
  const tool = toolOf(current, "aidlc-runtime-paths.ts");
  const name = askRuntime(sandbox, tool, HARNESS_NAME, [sandbox.harness, toolOf(project, "aidlc.ts")]);
  if (typeof name !== "string") throw new Error(`no harness name for ${sandbox.harness}`);
  return name;
};

const hashTree = (root: string): FileTree => {
  const files: Record<string, string> = {};
  const walk = (folder: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".git") walk(path);
        continue;
      }
      files[relative(root, path).replaceAll("\\", "/")] = createHash("sha256").update(readFileSync(path)).digest("hex");
    }
  };
  walk(root);
  return Object.fromEntries(Object.entries(files).toSorted(([left], [right]) => byPath(left, right)));
};

const seededProject = (sandbox: Sandbox): string => {
  const project = join(sandbox.root, "project");
  mkdirSync(project, { recursive: true });
  for (const [name, text] of Object.entries(PERSON_FILES)) writeFileSync(join(project, name), text);
  spawnSync("git", ["init", "-q"], { cwd: project, env: sandbox.environment });
  return project;
};

const ownedSampleIn = (project: string): string => {
  const manifest = readJson(toolOf(project, join("data", "aidlc-manifest.json")));
  const field = (name: string): Readonly<Record<string, unknown>> => {
    const value = isRecord(manifest) ? manifest[name] : undefined;
    return isRecord(value) ? value : {};
  };
  const shared = new Set([...Object.keys(field("entries")), ...Object.keys(field("rootContributions"))]);
  return (
    Object.keys(field("files"))
      .filter((file) => file.endsWith(".md") && !shared.has(file))
      .toSorted(byPath)[0] ?? ""
  );
};

const projectIn = (sandbox: Sandbox): Project => {
  const project = seededProject(sandbox);
  return {
    copyIn: (runtime) => cpSync(copyRuntimeOf(sandbox, runtime), project, { recursive: true }),
    config: (request) => {
      const from = copyRuntimeOf(sandbox, request.runtime);
      const name = harnessNameFor(sandbox, project);
      const force = request.force ? ["--force"] : [];
      const argv = [toolOf(project, "aidlc.ts"), "config", "--from", from, "--harness", name, ...force, "--yes"];
      const run = spawnSync(process.execPath, argv, { cwd: project, env: sandbox.environment, encoding: "utf8" });
      return { exitCode: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
    },
    ownedSample: () => ownedSampleIn(project),
    append: (path) => appendFileSync(join(project, path), "\nA note of my own.\n"),
    tree: () => hashTree(project),
  };
};

const newProject = (lab: Lab, harness: string): Project => {
  const root = mkdtempSync(join(lab.sandbox, `${harness}-`));
  return projectIn({ lab, harness, root, environment: childEnvironment(root) });
};

const pick = (tree: FileTree, keep: (path: string) => boolean): FileTree =>
  Object.fromEntries(Object.entries(tree).filter(([path]) => keep(path)));

const changeBetween = (before: FileTree, after: FileTree): TreeChange => ({
  added: pick(after, (path) => before[path] === undefined),
  changed: pick(after, (path) => before[path] !== undefined && before[path] !== after[path]),
  removed: Object.keys(before).filter((path) => after[path] === undefined),
});

const stepAfter = (project: Project, request: ConfigRequest, before: FileTree): StepResult => {
  const run = project.config(request);
  return { exitCode: run.exitCode, change: changeBetween(before, project.tree()) };
};

const upgradeOver = (lab: Lab, harness: string, freshTree: FileTree): Lifecycle["upgrade"] => {
  const project = newProject(lab, harness);
  project.copyIn("previous");
  const previous = project.config({ runtime: "previous", force: false });
  const upgraded = project.config(CURRENT);
  return { exitCode: upgraded.exitCode, change: changeBetween(freshTree, project.tree()), previousExitCode: previous.exitCode };
};

const lifecycleOf = (lab: Lab, harness: string): Lifecycle => {
  const project = newProject(lab, harness);
  project.copyIn("current");
  const fresh = project.config(CURRENT);
  const freshTree = project.tree();
  const refresh = stepAfter(project, CURRENT, freshTree);
  const file = project.ownedSample();
  project.append(file);
  const editedTree = project.tree();
  const refused = project.config(CURRENT);
  const localEdit = {
    exitCode: refused.exitCode,
    change: changeBetween(editedTree, project.tree()),
    file,
    named: refused.output.includes(file),
  };
  const force = stepAfter(project, { ...CURRENT, force: true }, freshTree);
  return {
    harness,
    release: releaseOf(lab, "current"),
    previousRelease: releaseOf(lab, "previous"),
    fresh: { exitCode: fresh.exitCode, tree: freshTree },
    refresh,
    localEdit,
    force,
    upgrade: upgradeOver(lab, harness, freshTree),
  };
};

const goldenPath = (harness: string): string => join(GOLDEN_DIRECTORY, `${harness}.json`);

const isTree = (value: unknown): value is FileTree =>
  isRecord(value) && Object.values(value).every((digest) => typeof digest === "string");

const isChange = (value: unknown): value is TreeChange =>
  isRecord(value) &&
  isTree(value["added"]) &&
  isTree(value["changed"]) &&
  Array.isArray(value["removed"]) &&
  value["removed"].every((path) => typeof path === "string");

const isStep = (value: unknown): value is StepResult =>
  isRecord(value) && typeof value["exitCode"] === "number" && isChange(value["change"]);

const isFresh = (value: unknown): value is Lifecycle["fresh"] =>
  isRecord(value) && typeof value["exitCode"] === "number" && isTree(value["tree"]);

const isLocalEdit = (value: unknown): value is Lifecycle["localEdit"] =>
  isRecord(value) && typeof value["file"] === "string" && typeof value["named"] === "boolean" && isStep(value);

const isUpgrade = (value: unknown): value is Lifecycle["upgrade"] =>
  isRecord(value) && typeof value["previousExitCode"] === "number" && isStep(value);

const isLifecycle = (value: unknown): value is Lifecycle =>
  isRecord(value) &&
  ["harness", "release", "previousRelease"].every((field) => typeof value[field] === "string") &&
  isFresh(value["fresh"]) &&
  isStep(value["refresh"]) &&
  isLocalEdit(value["localEdit"]) &&
  isStep(value["force"]) &&
  isUpgrade(value["upgrade"]);

const recordedLifecycle = (harness: string): Lifecycle | undefined => {
  const path = goldenPath(harness);
  if (!existsSync(path)) return undefined;
  const parsed = readJson(path);
  const lifecycle = isRecord(parsed) && parsed["schemaVersion"] === 1 ? parsed["lifecycle"] : undefined;
  if (!isLifecycle(lifecycle)) throw new Error(`${path} is not a recorded install lifecycle`);
  return lifecycle;
};

const differingPaths = (expected: FileTree, actual: FileTree): readonly string[] =>
  [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .filter((path) => expected[path] !== actual[path])
    .toSorted(byPath);

const treeDrift = (comparison: Comparison<FileTree>): readonly string[] =>
  differingPaths(comparison.expected, comparison.actual).map(
    (path) => `${comparison.label} · ${path}: differs from the recorded install`,
  );

const valueDrift = (comparison: Comparison<number | string | boolean>): readonly string[] =>
  comparison.expected === comparison.actual
    ? []
    : [`${comparison.label}: is ${String(comparison.actual)}, recorded ${String(comparison.expected)}`];

const changeAsTree = (change: TreeChange): FileTree => ({
  ...change.added,
  ...Object.fromEntries(Object.entries(change.changed).map(([path, hash]) => [path, `~${hash}`])),
  ...Object.fromEntries(change.removed.map((path) => [path, "removed"])),
});

const stepDrift = (comparison: Comparison<StepResult>): readonly string[] => [
  ...valueDrift({ label: `${comparison.label} exit code`, expected: comparison.expected.exitCode, actual: comparison.actual.exitCode }),
  ...treeDrift({ label: comparison.label, expected: changeAsTree(comparison.expected.change), actual: changeAsTree(comparison.actual.change) }),
];

const lifecycleDrift = (expected: Lifecycle, actual: Lifecycle): readonly string[] => {
  const label = actual.harness;
  const sides = <T>(read: (lifecycle: Lifecycle) => T): { readonly expected: T; readonly actual: T } => ({
    expected: read(expected),
    actual: read(actual),
  });
  return [
    ...valueDrift({ label: `${label} release`, ...sides((record) => record.release) }),
    ...valueDrift({ label: `${label} previous release`, ...sides((record) => record.previousRelease) }),
    ...valueDrift({ label: `${label} fresh exit code`, ...sides((record) => record.fresh.exitCode) }),
    ...treeDrift({ label: `${label} fresh`, ...sides((record) => record.fresh.tree) }),
    ...stepDrift({ label: `${label} refresh`, ...sides((record) => record.refresh) }),
    ...stepDrift({ label: `${label} local edit`, ...sides((record) => record.localEdit) }),
    ...valueDrift({ label: `${label} local edit names the file`, ...sides((record) => record.localEdit.named) }),
    ...stepDrift({ label: `${label} force`, ...sides((record) => record.force) }),
    ...stepDrift({ label: `${label} upgrade`, ...sides((record) => record.upgrade) }),
    ...valueDrift({ label: `${label} previous install exit code`, ...sides((record) => record.upgrade.previousExitCode) }),
  ];
};

const record = (lab: Lab): number => {
  mkdirSync(GOLDEN_DIRECTORY, { recursive: true });
  for (const harness of harnesses()) {
    const lifecycle = lifecycleOf(lab, harness);
    writeFileSync(goldenPath(harness), `${JSON.stringify({ schemaVersion: 1, lifecycle }, null, 2)}\n`);
    process.stdout.write(`install parity: recorded ${harness}\n`);
  }
  return 0;
};

const check = (lab: Lab): number => {
  const drift = harnesses().flatMap((harness) => {
    const expected = recordedLifecycle(harness);
    if (expected === undefined) return [`${harness}: has no recorded install lifecycle`];
    return lifecycleDrift(expected, lifecycleOf(lab, harness));
  });
  for (const line of drift) process.stderr.write(`- ${line}\n`);
  process.stdout.write(`install parity: ${harnesses().length} harnesses, ${drift.length} differences\n`);
  return drift.length === 0 ? 0 : 1;
};

const main = (): number => {
  const request = requestFrom(Bun.argv.slice(2));
  if (request === undefined || !existsSync(request.previous)) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const lab: Lab = {
    sandbox: mkdtempSync(join(tmpdir(), "aidlc-install-parity-")),
    runtimes: { current: CURRENT_DIST, previous: request.previous },
  };
  try {
    return request.mode === "record" ? record(lab) : check(lab);
  } finally {
    rmSync(lab.sandbox, { recursive: true, force: true });
  }
};

process.exitCode = main();
