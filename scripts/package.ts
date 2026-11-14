#!/usr/bin/env bun
import { bindCopiedSource } from "../src/projection/domain/source-binding.ts";
import type { HostModule } from "../src/cli/roots.ts";
import type { Payload, HostDistribution } from "../src/packaging/domain/payload.ts";
import { channelTokens } from "../src/packaging/domain/channel-tokens.ts";
import type { HostIdentity } from "../src/kernel/host.ts";
import type { AuthoredHostFile } from "../src/projection/domain/host-surface.ts";
// scripts/package.ts — THE build entry for the one-core-N-harnesses layout.
//
//   bun scripts/package.ts            regenerate dist/ and dist-release/ for every harness, plus plugins
//   bun scripts/package.ts --check     determinism guard (exit 1 on mismatch)
//   bun scripts/package.ts <name>      regenerate just one harness
//   bun scripts/package.ts <name> --check
//
// PIPELINE PER HARNESS:
//   1. COPY core/<src> → dist/<name>/<harnessDir>/<dst>, substituting
//      {{HARNESS_DIR}} -> harnessDir in .md prose (see transform()) and
//      applying the manifest's rules-dir rename.
//   2. COPY harness/<name>/<src> → dist/<name>/<harnessDir>/<dst> (authored
//      surfaces: orchestrator skill, settings/config), same token substitution
//      on .md; render neutral onboarding and native setup from their skeletons.
//   3. COMPILE the stage graph into the assembled tree (emits harness-correct
//      stage-graph.json + scope-grid.json — compiled data lives only in dist).
//   4. Every host builds through the composition root (HOSTS): its
//      agents, settings, documents and runners are projected, not emitted by
//      a per-host script.
//   5. Native skill projection owns the final table regions and earlier-release tail.
//
// THE TOKENS: core/ prose carries {{HARNESS_DIR}}, {{INVOKE}}, {{TOOL_PREFIX}},
// {{TRUSTED_NAMESPACE}} and {{OPTION_LETTERS}}; here they become the harness's
// own values (the dir is `.claude`/`.kiro`/`.codex`/`.aidlc`/`.cursor`; the
// letters are optionLetters()). Truthful carve-outs in core
// (workspace-detection's 3-dir list, the `$CLAUDE_PROJECT_DIR on Claude Code`
// note) never carried the token, so they pass through untouched.
//
// --check builds the complete copy-channel, native-release, and plugin
// projections twice in independent temp roots, then compares them byte for
// byte. It never reads dist/ or dist-release/, so it works from a fresh clone
// and fails CI only when the generator is nondeterministic.

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  relative,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HOSTS, HOST_BUILD_REFUSALS,
} from "../src/cli/host-table.ts";
import { sourcePath, type SourcePath } from "../src/kernel/values.ts";
import type {
  DistributionChannel,
} from "../src/projection/domain/projected-file.ts";
import { openPackageBuildRoot } from "../src/cli/main.ts";
import { createNodeFileSystem } from "../src/kernel/file-system.ts";
import { writePayloadTree } from "../src/packaging/adapters/payload-tree-writer.ts";
import { createNodeProcessRunner } from "../src/kernel/process-runner.ts";
import { createBunYamlParser } from "../src/kernel/yaml-parser.ts";
import { createBunContentDigester } from "../src/kernel/content-digester.ts";
import { createProcessTerminal } from "../src/kernel/terminal.ts";
import { createLegacyPluginProjector } from "../src/projection/adapters/legacy-plugin-emit.ts";
import { createPackageBuildRoot } from "../src/cli/package-build-root.ts";
import { createMarkdownOutliner } from "../src/workflow-definition/adapters/markdown-outliner.ts";
import { markdownBlocks } from "../core/tools/aidlc-markdown.ts";
const nodeFileSystem = createNodeFileSystem();
const contentDigester = createBunContentDigester();
const packageBuildRoot = openPackageBuildRoot({ createNodeFileSystem: () => nodeFileSystem, createNodeProcessRunner,
  createBunYamlParser, createBunContentDigester: () => contentDigester, createPluginProjector: createLegacyPluginProjector,
  createProcessTerminal: () => createProcessTerminal({ streams: {
    stdout: process.argv.includes("--check") ? { write: () => true } : process.stdout,
    stderr: process.stderr,
  } }), createPackageBuildRoot,
  outliner: createMarkdownOutliner(markdownBlocks), workingDirectory: pathToFileURL(`${process.cwd()}/`) });
import { reviewerAgentSet }
  from "../src/workflow-definition/domain/method-participation.ts";
import { prepareHostSource } from "../src/projection/application/prepared-host-source.ts";
import type { AuthoredPluginBuild as PluginBuildCatalog }
  from "../src/workflow-definition/application/ports.ts";
import { createPackagedSourcesFile } from "../src/packaging/adapters/packaged-sources-file.ts";
import { distributionId } from "../src/kernel/values.ts";
import { readEnvCap, readMemoryCap } from "../core/tools/aidlc-tiers.ts";
import type { ResolveModelCap } from "../src/projection/domain/model-cap.ts";
import {
  TRUSTED_COMMAND_PREFIX,
  TRUSTED_ROUTE_NAMESPACE,
} from "../core/tools/aidlc-command.ts";
import { AIDLC_VERSION } from "../core/tools/aidlc-version.ts";
import { BUILD_VERSION_ENV, releaseBuildVersion } from "../core/tools/aidlc-channel.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagedSources = createPackagedSourcesFile({ repository: pathToFileURL(`${REPO_ROOT}/`),
  record: pathToFileURL(join(REPO_ROOT, "dist", ".package-sources.json")),
  fileSystem: nodeFileSystem, hasher: contentDigester });
const CORE_ROOT = join(REPO_ROOT, "core");
const HARNESS_ROOT = join(REPO_ROOT, "harness");

// The pack-time tier cap, resolved ONCE for the whole build: the
// AIDLC_TIER_CAP env var (per-invocation) beats the persistent space-memory
// `tier_cap:` frontmatter key (core/memory org.md -> team.md -> project.md,
// last writer wins). The env var applies to WRITE runs only - a one-shot
// build knob. Under --check it is IGNORED: the determinism guard measures the
// repository-defined projection, and a stray AIDLC_TIER_CAP in a CI or test
// runner's environment must not alter either build. The memory cap travels
// with the repo, so it applies in both modes and keeps write and check
// consistent. The diagnostic below names the active cap and mode.
const argv = process.argv.slice(2);
const resolveModelCap: ResolveModelCap = (mode) => {
  const environment = mode === "check" ? null : readEnvCap();
  const memory = readMemoryCap(join(CORE_ROOT, "memory"));
  return { cap: environment ?? memory, source: environment ? "environment" : memory ? "memory" : null,
    environment: environment ? "applied" : mode === "check" && process.env.AIDLC_TIER_CAP ? "ignored" : "unset" };
};
const command = packageBuildRoot.buildRoutes({ resolveModelCap }).find((route) =>
  route.verb.every((word, index) => word === argv[index]));
// Host utility commands do not project a tree; plugin builds keep the existing cap resolution.
const pluginCommand = command?.verb[0] === "plugin";
if (command && !pluginCommand) process.exit(await command.run(argv.slice(command.verb.length)));

const IS_CHECK_MODE = process.argv.includes("--check");
const CAP_READING = resolveModelCap(IS_CHECK_MODE ? "check" : "build");
const TIER_CAP = CAP_READING.cap;
if (TIER_CAP) {
  console.error(
    `[tier] pack-time tier cap active: ${TIER_CAP} ` +
      `(source: ${CAP_READING.source === "environment" ? "AIDLC_TIER_CAP env var" : "core/memory tier_cap:"})`,
  );
} else if (CAP_READING.environment === "ignored") {
  console.error(
    "[tier] AIDLC_TIER_CAP is set but IGNORED under --check " +
      "(the env cap is a one-shot write knob; persistent caps live in core/memory)",
  );
}

// The version stamped into every projected aidlc-version.ts copy and projection
// stamp. Unset means the source version. A release build sets AIDLC_BUILD_VERSION
// to a next-patch preview id derived from the current source version; the source
// tree is never edited. Honoured in --check mode too, so the two-build
// determinism guard measures the same stamped projection the release will ship.
const BUILD_VERSION = releaseBuildVersion();
if (BUILD_VERSION !== AIDLC_VERSION) {
  console.error(`[version] stamping projections with ${BUILD_VERSION_ENV}=${BUILD_VERSION}`);
}
// Harnesses the packager builds = every harness/<name>/ that carries a
// manifest.ts. DISCOVERED, not hardcoded: adding harness #N is one harness/<n>/
// dir + manifest row (+ optional emit.ts), with zero edits here — the
// one-core-many-harnesses promise. Sorted so the default build/--check order is
// stable (claude first by name).
function discoverHarnessNames(): string[] {
  return HOSTS
    .map((member) => member.host.distribution).sort();
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// Byte-diff two independently built trees. The caller supplies a stable
// projection prefix so diagnostics never expose temp-directory names.
function diffTrees(
  first: string,
  second: string,
  relPrefix: string,
): string[] {
  const problems: string[] = [];
  const firstFiles = new Set<string>();
  const files = existsSync(first) ? [...walk(first)] : [];
  for (const f of files) {
    const rel = relative(first, f);
    firstFiles.add(rel);
    const counterpart = join(second, rel);
    if (!existsSync(counterpart)) {
      problems.push(`MISSING in second build: ${relPrefix}/${rel}`);
    } else if (!readFileSync(f).equals(readFileSync(counterpart))) {
      problems.push(`DIFFERS between builds: ${relPrefix}/${rel}`);
    }
  }
  if (existsSync(second)) {
    for (const f of walk(second)) {
      const rel = relative(second, f);
      if (firstFiles.has(rel)) continue;
      problems.push(`ONLY in second build: ${relPrefix}/${rel}`);
    }
  }
  return problems;
}

// The packager-emitted harness descriptor (vision T1 open-set seam): the
// runtime reads tools/data/harness.json to learn this harness's rules-subdir
// without a hardcoded map. Derived from the manifest, written into every tree.

type DescriptorIntegration = {
  readonly path: string;
  readonly policy: "managed-block" | "json-map" | "json-array" | "whole-file" | "jsonc-settings" | "json-entries";
  readonly marker?: string;
  readonly shared?: "union" | "identical";
  readonly jsonKey?: string;
  readonly optional?: boolean;
  readonly legacySignatures?: {
    readonly wholeFileHashes?: string[];
    readonly jsonEntryHashes?: Record<string, string[]>;
  };
};

// ---------------------------------------------------------------------------
// Build one harness tree into `outRoot` (the dist/<name> dir). Returns the full
// generated-file inventory rooted there, including project-root files beside
// <harnessDir> (onboarding/config, workspace memory, emitted skills, and so on).
// ---------------------------------------------------------------------------

function shippedSettingsEntrypoints(treeRoot: string): readonly SourcePath[] {
  return ["hooks", "tools"].flatMap((folder) =>
    readdirSync(join(treeRoot, folder), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => `${folder}/${entry.name}`),
  ).sort().map((raw) => {
    const path = sourcePath(raw);
    if (!path.ok) throw new Error(`The built settings entrypoint is not portable: ${raw}`);
    return path.value;
  });
}

type RoutedHost = { members: HostModule; distribution: HostDistribution };

function routedHost(name: string): RoutedHost | null {
  const members = HOSTS.find((candidate) =>
    candidate.host.distribution === name);
  if (!members) return null;
  const distribution = packageBuildRoot.readHostDistribution({ host: members.host });
  if (!distribution.ok) throw new Error(JSON.stringify(distribution.refusal));
  return { members, distribution: distribution.value };
}

function routedHistory(distribution: HostDistribution, path: string) {
  const prior = distribution.priorIntegrations.find((candidate) => candidate.integration === path);
  if (!prior) return undefined;
  const wholeFileHashes = [...prior.wholeFileHashes];
  const jsonEntryHashes = Object.fromEntries(Object.entries(prior.entryHashes)
    .map(([key, hashes]) => [key, [...hashes]]));
  return { ...(wholeFileHashes.length ? { wholeFileHashes } : {}),
    ...(Object.keys(jsonEntryHashes).length ? { jsonEntryHashes } : {}) };
}

function routedIntegrations(distribution: HostDistribution): DescriptorIntegration[] {
  return distribution.layout.rootIntegrations.map((integration) => {
    const legacySignatures = routedHistory(distribution, integration.path);
    return { path: integration.path, policy: integration.policy,
      ...("marker" in integration ? { marker: integration.marker } : {}),
      ...("sharing" in integration && integration.sharing !== "exclusive"
        ? { shared: integration.sharing } : {}),
      ...("key" in integration ? { jsonKey: integration.key } : {}),
      ...(integration.presence === "optional" ? { optional: true } : {}),
      ...(legacySignatures ? { legacySignatures } : {}),
    };
  });
}

async function buildHost({ name, outRoot, channel, copy }: {
  readonly name: string; readonly outRoot: string; readonly channel: DistributionChannel;
  readonly copy: Payload | null;
}): Promise<Payload> {
  const routed = routedHost(name);
  if (!routed) throw new Error(`The host is not routed through the composition root: ${name}`);
  const captured = hostBuildInputs.get(name);
  if (!captured) throw new Error(`Authored host sources were not captured for ${name}`);
  const { members } = routed;
  const tokens = { ...members.projection.tokens, HARNESS_DIR: members.host.directory,
    ...channelTokens({ channel, directory: members.host.directory,
      prefix: TRUSTED_COMMAND_PREFIX, namespace: TRUSTED_ROUTE_NAMESPACE }) };
  const built = await packageBuildRoot.buildPayload({ host: captured.host, core: coreBuild,
    files: captured.files, prepare: (file: AuthoredHostFile) => prepareHostSource({ host: captured.host, file,
      steps: [(content) => bindCopiedSource({ source: file.source, content, tokens })] }),
    tokens, channel, modelCap: TIER_CAP, entrypoints: shippedSettingsEntrypoints(CORE_ROOT),
    projectRoot: pathToFileURL(outRoot), reviewerAgents, copy });
  if (!built.ok) throw new Error(JSON.stringify(built.refusal));
  const written = await writePayloadTree({ root: pathToFileURL(`${outRoot}/`), payload: built.value,
    fileSystem: nodeFileSystem });
  if (!written.ok) throw new Error(JSON.stringify(written.refusal));
  return built.value;
}

async function writeHostPair(name: string): Promise<void> {
  const distDir = join(REPO_ROOT, "dist", name);
  const releaseDir = join(REPO_ROOT, "dist-release", name);
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  if (existsSync(releaseDir)) rmSync(releaseDir, { recursive: true, force: true });
  const copy = await buildHost({ name, outRoot: distDir, channel: "copy", copy: null });
  console.log(`[${name}] regenerated dist/${name}/${copy.descriptor.host.directory}`);
  const native = await buildHost({ name, outRoot: releaseDir, channel: "native", copy });
  console.log(`[${name}] regenerated dist-release/${name}/${native.descriptor.host.directory}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function buildPluginsFromRoot(request: { harnesses: string[]; plugins: PluginBuildCatalog; distRoot: string }): void {
  const hosts = request.harnesses.map((name) => {
    const member = HOSTS.find((candidate) => candidate.host.distribution === name);
    if (!member) throw new Error(`The host is not routed through the composition root: ${name}`);
    return member.host;
  });
  const output = pathToFileURL(`${request.distRoot}/`);
  const built = packageBuildRoot.buildPlugins({ plugins: request.plugins.plugins, hosts, output, boundary: output });
  if (!built.ok) throw new Error(JSON.stringify(built.refusal));
}

function removeUnexpectedGeneratedEntries(
  root: string,
  expected: ReadonlySet<string>,
): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    if (!expected.has(name)) {
      rmSync(join(root, name), { recursive: true, force: true });
    }
  }
}

function cleanWriteOutputs(request: { harnesses: string[]; kind: "full" | "named";
  plugins: PluginBuildCatalog }): void {
  const { harnesses, kind, plugins } = request;
  const distRoot = join(REPO_ROOT, "dist");
  const releaseRoot = join(REPO_ROOT, "dist-release");
  if (kind === "full") {
    removeUnexpectedGeneratedEntries(
      distRoot,
      new Set([...harnesses, "plugins"]),
    );
    removeUnexpectedGeneratedEntries(releaseRoot, new Set(harnesses));
    rmSync(join(distRoot, "plugins"), { recursive: true, force: true });
    return;
  }

  for (const plugin of plugins.plugins) {
    for (const harnessName of harnesses) {
      rmSync(
        join(distRoot, "plugins", plugin.directory, harnessName),
        { recursive: true, force: true },
      );
    }
  }
}

function assertIdenticalRootIntegrations(root: string, harnesses: string[]): void {
  const owners = new Map<string, { harness: string; bytes: Buffer }>();
  for (const name of harnesses) {
    const routed = routedHost(name);
    if (!routed) throw new Error(`The host is not routed through the composition root: ${name}`);
    for (const integration of routedIntegrations(routed.distribution)) {
      if (integration.shared !== "identical") continue;
      const bytes = readFileSync(join(root, name, integration.path));
      const previous = owners.get(integration.path);
      if (previous && !previous.bytes.equals(bytes)) {
        throw new Error(
          `shared identical root integration ${integration.path} differs between ${previous.harness} and ${name}`,
        );
      }
      if (!previous) owners.set(integration.path, { harness: name, bytes });
    }
  }
}

async function buildCheckPass(request: {
  root: string; harnesses: string[]; plugins: PluginBuildCatalog;
}): Promise<void> {
  const { root, harnesses, plugins } = request;
  const distRoot = join(root, "dist");
  const releaseRoot = join(root, "dist-release");
  for (const name of harnesses) {
    const copyRoot = join(distRoot, name);
    const nativeRoot = join(releaseRoot, name);
    const copy = await buildHost({ name, outRoot: copyRoot, channel: "copy", copy: null });
    await buildHost({ name, outRoot: nativeRoot, channel: "native", copy });
  }
  assertIdenticalRootIntegrations(distRoot, harnesses);
  assertIdenticalRootIntegrations(releaseRoot, harnesses);
  buildPluginsFromRoot({ harnesses, plugins, distRoot });
}

async function checkPackageDeterminism(
  harnesses: string[], plugins: PluginBuildCatalog,
): Promise<string[]> {
  const first = mkdtempSync(join(tmpdir(), "aidlc-package-check-a-"));
  const second = mkdtempSync(join(tmpdir(), "aidlc-package-check-b-"));
  try {
    await buildCheckPass({ root: first, harnesses, plugins });
    await buildCheckPass({ root: second, harnesses, plugins });
    return [
      ...diffTrees(join(first, "dist"), join(second, "dist"), "dist"),
      ...diffTrees(
        join(first, "dist-release"),
        join(second, "dist-release"),
        "dist-release",
      ),
    ];
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
}

if (command) process.exit(await command.run(argv.slice(command.verb.length)));

if (HOST_BUILD_REFUSALS.length > 0) {
  for (const refusal of HOST_BUILD_REFUSALS) console.error(JSON.stringify(refusal));
  console.error("A host in the host table cannot be built. Fix the member each line names in src/cli/host-table.ts.");
  process.exit(1);
}

const check = argv.includes("--check");
const named = argv.find((a) => !a.startsWith("--"));
// Default targets are DISCOVERED from harness/ (one manifest = one harness); a
// named target builds just that one.
const targets = named ? [named] : discoverHarnessNames();

if (named && !discoverHarnessNames().includes(named)) {
  console.error(
    `unknown harness "${named}" (have: ${discoverHarnessNames().join(", ") || "none"})`,
  );
  process.exit(1);
}

const targetHosts = targets.map((name) => {
  const identity = distributionId(name);
  if (!identity.ok) throw new Error(JSON.stringify(identity.refusal));
  return identity.value;
});
const fingerprintReading = await packagedSources.fingerprint();
if (!fingerprintReading.ok) throw new Error(JSON.stringify(fingerprintReading.refusal));
const builtFrom = fingerprintReading.value;
const loadedBuild = await packageBuildRoot.loadCore();
if (!loadedBuild.ok) {
  throw new Error(`Cannot load the fresh Method: ${JSON.stringify(loadedBuild.refusal)}`);
}
const coreBuild = loadedBuild.value;
const loadedPlugins = await packageBuildRoot.loadPlugins({ core: coreBuild });
if (!loadedPlugins.ok) {
  throw new Error(`Cannot load the plugin Method: ${JSON.stringify(loadedPlugins.refusal)}`);
}
const pluginBuilds = loadedPlugins.value;
const reviewerAgents = reviewerAgentSet(pluginBuilds.method);

const hostBuildInputs = new Map<string, {
  readonly host: HostIdentity; readonly files: readonly AuthoredHostFile[];
}>();
for (const name of targets) {
  const routed = routedHost(name);
  if (!routed) throw new Error(`The host is not routed through the composition root: ${name}`);
  const captured = await packageBuildRoot.readHostSources({ name, directory: routed.members.host.directory,
    root: pathToFileURL(join(HARNESS_ROOT, name)), copied: [], required: [] });
  if (!captured.ok) {
    console.error(JSON.stringify(captured.refusal));
    process.exit(1);
  }
  hostBuildInputs.set(name, captured.value);
}
if (check) {
  const problems = await checkPackageDeterminism(targets, pluginBuilds);
  if (problems.length > 0) {
    console.error(`\npackage --check FAILED (${problems.length} problem(s)):`);
    for (const p of problems.slice(0, 40)) console.error("  " + p);
    process.exit(1);
  }
  const checkedFingerprint = await packagedSources.fingerprint();
  if (!checkedFingerprint.ok) throw new Error(JSON.stringify(checkedFingerprint.refusal));
  if (checkedFingerprint.value !== builtFrom) {
    throw new Error("A packaging input changed during the determinism check; run it again.");
  }
  console.log(
    `package --check: deterministic across two independent build(s) ` +
      `for ${targets.join(", ")}.`,
  );
} else {
  const forgotten = await packagedSources.forget(targetHosts);
  if (!forgotten.ok) throw new Error(JSON.stringify(forgotten.refusal));
  cleanWriteOutputs({ harnesses: targets, kind: named === undefined ? "full" : "named",
    plugins: pluginBuilds });
  for (const n of targets) {
    await writeHostPair(n);
  }
  assertIdenticalRootIntegrations(join(REPO_ROOT, "dist"), targets);
  assertIdenticalRootIntegrations(join(REPO_ROOT, "dist-release"), targets);
  buildPluginsFromRoot({ harnesses: targets, plugins: pluginBuilds, distRoot: join(REPO_ROOT, "dist") });
  // Last, so only a finished build from unchanged sources is recorded as current.
  const recorded = await packagedSources.record({ hosts: targetHosts, builtFrom });
  if (!recorded.ok) throw new Error(JSON.stringify(recorded.refusal));
  if (recorded.value === "inputs-changed") {
    console.error(
      "[sources] a packaging input changed while packaging, so the generated trees may mix old and new files: run `bun scripts/package.ts` again.",
    );
    process.exit(1);
  }
}
