#!/usr/bin/env bun
import { bindCopiedSource } from "../src/projection/domain/source-binding.ts";
import { z } from "zod";
import type { HostBuildRequest, HostModule } from "../src/cli/roots.ts";
import type { HostDistribution } from "../src/packaging/domain/payload.ts";
import { trustEntries } from "../src/hosts/codex/projection/settings-renderer.ts";
import { channelTokens } from "../src/packaging/domain/channel-tokens.ts";
import type { FileContent } from "../src/kernel/file-content.ts";
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
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  win32,
  relative,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HOSTS, HOST_BUILD_REFUSALS,
} from "../src/cli/host-table.ts";
import { sourcePath, type SourcePath } from "../src/kernel/values.ts";
import type {
  DistributionChannel, ProjectedFile,
} from "../src/projection/domain/projected-file.ts";
import { openPackageBuildRoot } from "../src/cli/main.ts";
import { createNodeFileSystem } from "../src/kernel/file-system.ts";
import { writePayloadTree } from "../src/packaging/adapters/payload-tree-writer.ts";
import { onboardingPathOf } from "../src/packaging/core-root.ts";
import { createNodeProcessRunner } from "../src/kernel/process-runner.ts";
import { createBunYamlParser } from "../src/kernel/yaml-parser.ts";
import { createBunContentDigester } from "../src/kernel/content-digester.ts";
import { createPackageBuildRoot } from "../src/cli/package-build-root.ts";
import { createMarkdownOutliner } from "../src/workflow-definition/adapters/markdown-outliner.ts";
import { markdownBlocks } from "../core/tools/aidlc-markdown.ts";
const nodeFileSystem = createNodeFileSystem();
const packageBuildRoot = openPackageBuildRoot({ createNodeFileSystem: () => nodeFileSystem, createNodeProcessRunner,
  createBunYamlParser, createBunContentDigester, createPackageBuildRoot, outliner: createMarkdownOutliner(markdownBlocks) });
import { pluginId as pluginBuildName } from "../src/workflow-definition/domain/identities.ts";
import { reviewerAgentSet }
  from "../src/workflow-definition/domain/method-participation.ts";
import { prepareHostSource } from "../src/projection/application/prepared-host-source.ts";
import type { AuthoredPluginBuild as PluginBuildCatalog, PluginBuildTarget }
  from "../src/workflow-definition/application/ports.ts";
import { forgetPackagedSources, packageInputsFingerprint, recordPackagedSources } from "./package-sources.ts";
import {
  buildPluginProjection as emitPluginProjection,
  writeFirstPartyCatalogues,
  type PluginTarget,
  type PluginTargetTable,
} from "../core/tools/aidlc-plugin-emit.ts";
import { readEnvCap, readMemoryCap } from "../core/tools/aidlc-tiers.ts";
import {
  scanNamespaceInvocations,
  TRUSTED_COMMAND_PREFIX,
  TRUSTED_ROUTE_NAMESPACE,
  trustedCommand,
} from "../core/tools/aidlc-command.ts";
import { copyChannelDispatcherCommands, ROUTES, TOOLS } from "../core/tools/aidlc.ts";
import { AIDLC_VERSION } from "../core/tools/aidlc-version.ts";
import { BUILD_VERSION_ENV, releaseBuildVersion } from "../core/tools/aidlc-channel.ts";
import { copyStartsWithout, harnessChoiceTextIsPlain, sha256Bytes, writtenRootIntegration } from "../src/packaging/adapters/legacy-distribution.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
// The `codex trust` subcommand performs NO projection (it prints trust
// entries for the installer), so it skips cap resolution entirely - a
// malformed cap must not break an installer command that never uses it.
const IS_CHECK_MODE = process.argv.includes("--check");
const IS_TRUST_MODE = process.argv[2] === "codex" && process.argv[3] === "trust";
const ENV_CAP = IS_CHECK_MODE || IS_TRUST_MODE ? null : readEnvCap();
const MEMORY_CAP = IS_TRUST_MODE ? null : readMemoryCap(join(CORE_ROOT, "memory"));
const TIER_CAP = ENV_CAP ?? MEMORY_CAP;
if (TIER_CAP) {
  // stderr, not stdout: the `codex trust` subcommand's stdout is pasted
  // verbatim into a config.toml and must stay clean.
  console.error(
    `[tier] pack-time tier cap active: ${TIER_CAP} ` +
      `(source: ${ENV_CAP ? "AIDLC_TIER_CAP env var" : "core/memory tier_cap:"})`,
  );
} else if (IS_CHECK_MODE && process.env.AIDLC_TIER_CAP) {
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
const INVOKE_TOKEN = /\{\{INVOKE\}\}/g;
const TOOL_PREFIX_TOKEN = /\{\{TOOL_PREFIX\}\}/g;
const TRUSTED_NAMESPACE_TOKEN = /\{\{TRUSTED_NAMESPACE\}\}/g;
// Harnesses the packager builds = every harness/<name>/ that carries a
// manifest.ts. DISCOVERED, not hardcoded: adding harness #N is one harness/<n>/
// dir + manifest row (+ optional emit.ts), with zero edits here — the
// one-core-many-harnesses promise. Sorted so the default build/--check order is
// stable (claude first by name).
function discoverHarnessNames(): string[] {
  return HOSTS
    .map((member) => member.host.distribution).sort();
}

// ---------------------------------------------------------------------------
// Transform: token substitution on authored prose and the
// TypeScript invocation seam; compiled JSON is regenerated per tree.
// ---------------------------------------------------------------------------
function substituteInvocationTokens(
  s: string,
  harnessDir: string,
  invoke = `bun ${harnessDir}/tools/aidlc.ts`,
): string {
  const bindings = channelTokens({ channel: invoke === "aidlc" ? "native" : "copy",
    directory: harnessDir, prefix: TRUSTED_COMMAND_PREFIX, namespace: TRUSTED_ROUTE_NAMESPACE });
  return s
    .replace(INVOKE_TOKEN, invoke)
    .replace(TOOL_PREFIX_TOKEN, bindings.TOOL_PREFIX)
    .replace(TRUSTED_NAMESPACE_TOKEN, bindings.TRUSTED_NAMESPACE);
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
const STAMP_DATA = "tools/data/aidlc-stamp.json";
const PROJECTION_DATA = "tools/data/aidlc-projection.json";
// The lines the plugin compose hook adds to a plugin's agent
// (the plugin agent frontmatter), in Markdown so the native
// release's agent rewrites reach them.
const PLUGIN_AGENT_DATA = "tools/data/plugin-agent.md";

// The plugin authoring validator must run from a copied distribution with no
// framework checkout. Ship the compose hook's source of truth beside the tool
// so a vendored hooks/compose.ts can be byte-compared offline.
const PLUGIN_HOOKS_TEMPLATE_SRC = join(
  REPO_ROOT,
  "scripts",
  "plugin-hooks-template",
);
const PLUGIN_HOOKS_TEMPLATE_DST = join(
  "tools",
  "data",
  "plugin-hooks-template",
);
const PLUGIN_TARGETS_DST = join("tools", "data", "plugin-targets.json");
const PLUGIN_AUTHORING_CONTEXT_DST = join(
  "tools",
  "data",
  "plugin-authoring-context.json",
);

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

type ReleaseView = ReturnType<typeof routedListing> & {
  readonly name: HostIdentity["distribution"];
  readonly harnessDir: HostIdentity["directory"];
  readonly productName: string;
  readonly configNextStep: string;
  readonly rootIntegrations: readonly DescriptorIntegration[];
  readonly copyOnly: HostDistribution["native"]["copyOnly"];
  readonly nativeReplacements: HostDistribution["native"]["replacements"];
  readonly onboarding: string | undefined;
};

function writeProjectionData(outRoot: string, treeRoot: string, m: ReleaseView): void {
  if (!harnessChoiceTextIsPlain(m)) {
    throw new Error(`[${m.name}] choiceName or choiceNote is not text the harness lists can show`);
  }
  const rootIntegrationPaths = new Set(m.rootIntegrations.map((item) => item.path));
  if (rootIntegrationPaths.size !== m.rootIntegrations.length) {
    throw new Error(`[${m.name}] duplicate root integration path`);
  }
  for (const integration of m.rootIntegrations) {
    if (!existsSync(join(outRoot, integration.path))) {
      throw new Error(`[${m.name}] root integration is not projected: ${integration.path}`);
    }
  }
  // A directory that holds only root integrations (.vscode/ for settings.json)
  // is the project's, not a managed engine directory.
  const onlyRootIntegrations = (entry: string): boolean => {
    const files: string[] = [];
    const visit = (dir: string): void => {
      for (const name of readdirSync(join(outRoot, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(join(outRoot, rel)).isDirectory()) visit(rel);
        else files.push(rel);
      }
    };
    visit(entry);
    return files.length > 0 && files.every((file) => rootIntegrationPaths.has(file));
  };
  const managedDirectories = readdirSync(outRoot)
    .filter((entry) => statSync(join(outRoot, entry)).isDirectory())
    .filter((entry) => !rootIntegrationPaths.has(entry) && !onlyRootIntegrations(entry))
    .sort();
  const allowedTopLevel = new Set([
    ...managedDirectories,
    ...m.rootIntegrations.map((item) => item.path.split("/")[0]),
  ]);
  const unclassified = readdirSync(outRoot)
    .filter((entry) => !allowedTopLevel.has(entry))
    .sort();
  if (unclassified.length > 0) {
    throw new Error(`[${m.name}] unclassified projection entries: ${unclassified.join(", ")}`);
  }
  const rootIntegrations = m.rootIntegrations.map((integration) => {
    if (copyStartsWithout(integration) || integration.policy === "json-entries") {
      // A copy starts without this file (or leaves the team's own in place);
      // its shipped part rides along so config and the engine can add it
      // without a download.
      const dst = join(treeRoot, "tools", "data", "root-blocks", basename(integration.path));
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, readFileSync(join(outRoot, integration.path)));
      return integration;
    }
    if (integration.policy !== "managed-block") return integration;
    const bytes = readFileSync(join(outRoot, integration.path));
    // Every managed block ships a copy inside the harness folder: siblings
    // read it to combine .gitignore lines, the copy runtime leaves the root
    // file out, and config and the engine add AI-DLC's part from it.
    const dst = join(
      treeRoot,
      "tools",
      "data",
      "root-blocks",
      integration.marker || basename(integration.path),
    );
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, bytes);
    const currentHash = sha256Bytes(bytes);
    return {
      ...integration,
      legacySignatures: {
        ...integration.legacySignatures,
        wholeFileHashes: [
          ...new Set([
            ...(integration.legacySignatures?.wholeFileHashes ?? []),
            currentHash,
          ]),
        ],
      },
    };
  });
  const projection = {
    schemaVersion: 1,
    distribution: m.name,
    productName: m.productName,
    ...(m.choiceName ? { choiceName: m.choiceName } : {}),
    ...(m.choiceNote ? { choiceNote: m.choiceNote } : {}),
    configNextStep: m.configNextStep,
    ...(m.firstRunSteps ? { firstRunSteps: m.firstRunSteps } : {}),
    ...(m.editorTerminalApp ? { editorTerminalApp: m.editorTerminalApp } : {}),
    ...(m.cliFirst ? { cliFirst: m.cliFirst } : {}),
    harnessDir: m.harnessDir,
    ...(m.onboarding ? { onboarding: m.onboarding } : {}),
    managedDirectories,
    rootIntegrations: rootIntegrations.map(writtenRootIntegration),
  };
  const stamp = {
    schemaVersion: 1,
    frameworkVersion: BUILD_VERSION,
    distribution: m.name,
    harnessDir: m.harnessDir,
  };
  mkdirSync(join(treeRoot, "tools", "data"), { recursive: true });
  writeFileSync(join(treeRoot, PROJECTION_DATA), `${JSON.stringify(projection, null, 2)}\n`);
  writeFileSync(join(treeRoot, STAMP_DATA), `${JSON.stringify(stamp, null, 2)}\n`);
}

function emitPluginAuthoringData(treeRoot: string): void {
  for (const file of walk(PLUGIN_HOOKS_TEMPLATE_SRC)) {
    const outPath = join(
      treeRoot,
      PLUGIN_HOOKS_TEMPLATE_DST,
      relative(PLUGIN_HOOKS_TEMPLATE_SRC, file),
    );
    mkdirSync(dirname(outPath), { recursive: true });
    cpSync(file, outPath);
  }
  const targetsPath = join(treeRoot, PLUGIN_TARGETS_DST);
  mkdirSync(dirname(targetsPath), { recursive: true });
  writeFileSync(
    targetsPath,
    `${JSON.stringify(pluginTargets(), null, 2)}\n`,
  );
  const contextPath = join(treeRoot, PLUGIN_AUTHORING_CONTEXT_DST);
  const agents = coreBuild.method.agents.filter((agent) => agent.owner.kind === "core")
    .map((agent) => agent.slug).toSorted();
  const stages = coreBuild.method.stages.filter((stage) => stage.owner.kind === "core")
    .map((stage) => stage.slug).toSorted();
  writeFileSync(
    contextPath,
    `${JSON.stringify({ agents, stages }, null, 2)}\n`,
  );
}

// ---------------------------------------------------------------------------
// Build one harness tree into `outRoot` (the dist/<name> dir). Returns the full
// generated-file inventory rooted there, including project-root files beside
// <harnessDir> (onboarding/config, workspace memory, emitted skills, and so on).
// ---------------------------------------------------------------------------

const hostContentBytes = (content: FileContent): Buffer => content.kind === "text"
  ? Buffer.from(content.text, "utf-8") : Buffer.from(content.bytes);

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The dispatcher commands every install pre-approves exactly as written
// (copyChannelDispatcherCommands), as the native release runs them: through
// the installed aidlc command, never a project path.
function nativeDispatcherCommands(): string[] {
  return copyChannelDispatcherCommands().map((command) => `aidlc ${command}`);
}

// A manifest's nativeReplacements, applied before the generic rewrite, which
// would otherwise turn their copy-channel text into retired or unresolvable
// engine spellings.
function applyNativeReplacements(outRoot: string, m: ReleaseView): void {
  for (const { from, to } of m.nativeReplacements) {
    let found = false;
    for (const file of walk(outRoot)) {
      if (!/\.(?:md|mdc|json|toml|hook|ts)$/.test(file)) continue;
      const value = readFileSync(file, "utf-8");
      if (!value.includes(from)) continue;
      found = true;
      writeFileSync(file, value.replaceAll(from, to));
    }
    if (!found) {
      throw new Error(`[${m.name}] nativeReplacements: text not found in the native projection:\n${from}`);
    }
  }
}

function rewriteKiroNativeAllowlists(outRoot: string, m: ReleaseView): void {
  if (m.name !== "kiro" && m.name !== "kiro-ide") return;
  const agentsDir = join(outRoot, m.harnessDir, "agents");
  const pluginAgentData = join(outRoot, m.harnessDir, PLUGIN_AGENT_DATA);
  for (const file of [...walk(agentsDir), ...(existsSync(pluginAgentData) ? [pluginAgentData] : [])]) {
    if (file.endsWith(".md")) {
      // Kiro IDE persona surfaces carry a YAML shell allowlist; the native
      // channel replaces the bun tool glob with the aidlc command prefix. The
      // copy channel's dispatcher line (`{{INVOKE}} engine *` on the conductor,
      // `bun <dir>/tools/aidlc.ts engine *` on a persona, which the tool
      // rewrite above turned into `aidlc engine engine *`) is that same
      // prefix, so the pair collapses to one entry. A persona's ask lines get
      // the same doubled prefix and lose it the same way. The asks on a risky
      // shell form after an AI-DLC command (`bun <dir>/tools/aidlc*<form>*`)
      // take the native command name as their prefix, as the persona deny does.
      const value = readFileSync(file, "utf-8");
      const trusted = `- "${trustedCommand("*")}"`;
      const rewritten = value
        .replaceAll(`- "bun ${m.harnessDir}/tools/aidlc-*"`, trusted)
        .replaceAll(`- "bun ${m.harnessDir}/tools/aidlc*`, `- "aidlc*`)
        .replaceAll(`- "${trustedCommand("engine ")}`, `- "${trustedCommand("")} `)
        .replaceAll(`${trusted}\n        ${trusted}`, trusted);
      if (rewritten !== value) writeFileSync(file, rewritten);
      continue;
    }
    if (!file.endsWith(".json")) continue;
    const value = JSON.parse(readFileSync(file, "utf-8")) as {
      toolsSettings?: {
        execute_bash?: {
          allowedCommands?: unknown;
        };
      };
    };
    const allowed = value.toolsSettings?.execute_bash?.allowedCommands;
    if (!Array.isArray(allowed)) continue;
    const rewritten = allowed.map((command) =>
      typeof command === "string" &&
        command.startsWith("bun ") &&
        command.includes(`${m.harnessDir.replace(".", "\\.")}/tools/`)
        ? trustedCommand(".*")
        : command
    );
    // An agent the copy channel let run AI-DLC's tool commands also runs the
    // exact read-only and turn-back-on commands natively, as anchored patterns.
    const trusted = trustedCommand(".*");
    value.toolsSettings!.execute_bash!.allowedCommands = [...new Set(rewritten)].flatMap((command) =>
      command === trusted ? [command, ...nativeDispatcherCommands().map(escapeRegExp)] : [command]
    );
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }
}

// The native Permissions line. A harness whose native allow list carries the
// exact read-only and turn-back-on commands names them; the others keep the
// engine prefix alone.
function nativePermissionsLine(exactReads: boolean): string {
  return exactReads
    ? `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${TRUSTED_COMMAND_PREFIX}\` command prefix, the read-only \`aidlc doctor\`, \`status\`, \`version\` and \`config <section> --show\` (with or without \`--json\`) and \`--help\` forms, turning a check back on (\`aidlc config flags --clear-bypass <switch> --yes\`), and its listed read-only tools; everything else prompts, including any other \`config\` change.`
    : `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${TRUSTED_COMMAND_PREFIX}\` command prefix and its listed read-only tools; everything else prompts.`;
}

function rewriteNativeOnboarding(value: string, exactReads = false): string {
  return value
    .replace(
      /^- \*\*bun\*\*:.*$/gm,
      "- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.",
    )
    .replace(
      /^- \*\*Hook permissions\*\*:.*$/gm,
      "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.",
    )
    .replace(/^- \*\*Permissions\*\*:.*$/gm, nativePermissionsLine(exactReads))
    .replace(
      /TypeScript, run via bun/g,
      "TypeScript sources invoked through the self-contained `aidlc` runtime",
    )
    .replace(
      /pre-approves ONLY `bun \.kiro\/tools\/\*` shell commands/g,
      `pre-approves only \`${TRUSTED_COMMAND_PREFIX}\` shell commands`,
    )
    .replace(
      /^\*\*CWD drift warning\*\*: If a stage runs `cd` in Bash.*$/gm,
      "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.",
    );
}

// A copyOnly harness file ships in the copy runtime alone. The native tree
// drops it and the root integration of the same path, so `aidlc config` never
// writes it into a project.
function dropCopyOnlyFiles(outRoot: string, m: ReleaseView): void {
  if (m.copyOnly.length === 0) return;
  for (const path of m.copyOnly) rmSync(join(outRoot, path), { force: true });
  const dropped = new Set<string>(m.copyOnly);
  const descriptorPath = join(outRoot, m.harnessDir, PROJECTION_DATA);
  const descriptor = JSON.parse(readFileSync(descriptorPath, "utf-8")) as {
    rootIntegrations: Array<Record<string, unknown>>;
  };
  descriptor.rootIntegrations = descriptor.rootIntegrations.filter((item) => !dropped.has(String(item.path)));
  writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
}

function projectedNamespaceInvocationViolations(
  file: string,
  value: string,
): string[] {
  return scanNamespaceInvocations(file, value, ROUTES)
    .filter((invocation) => invocation.source === "aidlc" && !invocation.resolves)
    .map((invocation) =>
      `${file}:${invocation.line}: unresolvable projected namespace invocation "${invocation.command}"`
    );
}

function rewriteNativeInvocations(
  outRoot: string,
  m: ReleaseView,
  copyRoot: string,
): void {
  dropCopyOnlyFiles(outRoot, m);
  applyNativeReplacements(outRoot, m);
  const harnessDir = escapeRegExp(m.harnessDir);
  // Deriving the delegate list from TOOLS keeps new delegates' bare bun aidlc-<name>.ts forms
  // covered by both the rewrite and bareToolCheck. The leftover checks below
  // still reject a rewrite to a non-route.
  const delegateNames = Object.values(TOOLS)
    .map((file) => escapeRegExp(file.slice("aidlc-".length, -".ts".length)))
    .join("|");
  // The authored subprocess adapters, each backed by an `aidlc engine adapter
  // <harness>` dispatcher route. Only these project onto that route; any other
  // hook file keeps the generic one-argument `engine hook <name>` rewrite.
  const adapterHookNames: Record<string, true> = {
    "kiro-adapter": true,
    "codex-adapter": true,
    "cursor-adapter": true,
    "copilot-adapter": true,
  };
  const projectPrefix = String.raw`(?:"?(?:\$\{?CLAUDE_PROJECT_DIR\}?/)?`;
  const suffix = `"?)`;
  const toolPattern = new RegExp(
    String.raw`\bbun\s+${projectPrefix}${harnessDir}/tools/aidlc(?:-([a-z0-9-]+))?\.ts${suffix}`,
    "gi",
  );
  const hookPattern = new RegExp(
    String.raw`\bbun\s+${projectPrefix}${harnessDir}/hooks/aidlc-([a-z0-9-]+)\.ts${suffix}`,
    "gi",
  );
  const bareToolPattern = new RegExp(
    String.raw`\bbun\s+aidlc-(${delegateNames})\.ts`,
    "gi",
  );
  const bareToolCheck = new RegExp(bareToolPattern.source, "i");
  for (const file of walk(outRoot)) {
    if (!/\.(?:md|mdc|json|toml|hook|ts)$/.test(file)) continue;
    let value = readFileSync(file, "utf-8");
    // Claude's source hook/statusline dispatcher is rooted at the project, so
    // it still loads after an application command changes cwd. JSON escapes
    // its shell quotes; strip the complete invocation for native releases.
    const escapedJsonDispatcher = new RegExp(
      String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${harnessDir}/tools/aidlc\.ts\\"`,
      "gi",
    );
    value = value.replace(escapedJsonDispatcher, "aidlc");
    const escapedJsonHook = new RegExp(
      String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${harnessDir}/hooks/aidlc-([a-z0-9-]+)\.ts\\"`,
      "gi",
    );
    value = value.replace(escapedJsonHook, (_match, hook: string) => {
      if (adapterHookNames[hook]) return trustedCommand(`adapter ${m.name}`);
      return hook === "statusline"
        ? trustedCommand("statusline")
        : trustedCommand(`hook ${hook}`);
    });
    // Direct utility verbs whose dispatcher route lives under the `workspace`
    // noun: rewrite verb-aware BEFORE the generic tool rewrite would emit the
    // retired `engine utility` alias.
    const workspaceUtilityPattern = new RegExp(
      String.raw`\bbun\s+${projectPrefix}${harnessDir}/tools/aidlc-utility\.ts${suffix}\s+(codekb-path|codekb-scope-diff|codekb-snapshot|codekb-publish|project-description|document-input)\b`,
      "gi",
    );
    value = value.replace(
      workspaceUtilityPattern,
      (_match, verb: string) =>
        `${trustedCommand("workspace")} ${verb === "codekb-path" ? "codekb" : verb}`,
    );
    // Settings share one utility transaction; project its first setting onto
    // the dispatcher's config noun and preserve all trailing flags/selectors.
    // The key list mirrors the dispatcher's `config set` verbs: guard-policy
    // (with its retired spelling change-control, accepted for one release) and
    // the four per-fence guard.<fence> switches. A key missing here falls
    // through to the generic tool rewrite, which emits the retired `engine
    // utility` alias that the leftover check below rejects.
    const configUtilityPattern = new RegExp(
      String.raw`\bbun\s+${projectPrefix}${harnessDir}/tools/aidlc-utility\.ts${suffix}\s+config-change\s+--(depth|test-strategy|review|guard-policy|change-control|sensors|learnings|summary-confirmation|guard\.(?:plan-approval|review-freeze|state-transition|reviewer-scope))\b`,
      "gi",
    );
    value = value.replace(
      configUtilityPattern,
      (_match, key: string) => trustedCommand(`config set ${key}`),
    );
    value = value.replace(toolPattern, (_match, delegate: string | undefined) =>
      delegate ? trustedCommand(delegate) : TRUSTED_COMMAND_PREFIX
    );
    value = value.replace(
      bareToolPattern,
      (_match, delegate: string) => trustedCommand(delegate),
    );
    value = value.replace(hookPattern, (_match, hook: string) => {
      if (adapterHookNames[hook]) return trustedCommand(`adapter ${m.name}`);
      if (hook === "statusline") return trustedCommand("statusline");
      return trustedCommand(`hook ${hook}`);
    });
    value = value.replaceAll(
      `"bun \\\\${m.harnessDir}/tools/.*"`,
      `"${trustedCommand(".*")}"`,
    );
    value = value.replaceAll(
      `"bun \\\\$\\\\{?KIRO_PROJECT_DIR\\\\}?/${m.harnessDir}/tools/.*"`,
      `"${trustedCommand(".*")}"`,
    );
    value = substituteInvocationTokens(value, m.harnessDir, "aidlc");
    value = rewriteNativeOnboarding(value, ["claude", "cursor", "kiro", "kiro-ide"].includes(m.name));
    writeFileSync(file, value);
  }
  rewriteKiroNativeAllowlists(outRoot, m);
  // Before the copy's hashes are recorded below, so a part that changed here
  // still has its copy bytes recognized, and --check builds it the same way.
  syncRootBlockParts(outRoot, m);
  const descriptorPath = join(outRoot, m.harnessDir, PROJECTION_DATA);
  const descriptor = JSON.parse(readFileSync(descriptorPath, "utf-8")) as {
    managedDirectories: string[];
    legacyManagedFileHashes?: Record<string, string[]>;
    retiredCopyFileHashes?: Record<string, string[]>;
  };
  const legacyManagedFileHashes: Record<string, string[]> = {};
  for (const directory of descriptor.managedDirectories) {
    const releaseDirectory = join(outRoot, directory);
    if (!existsSync(releaseDirectory)) continue;
    for (const file of walk(releaseDirectory)) {
      const rel = relative(outRoot, file).split(sep).join("/");
      const copy = join(copyRoot, rel);
      if (!existsSync(copy) || !lstatSync(copy).isFile()) continue;
      const releaseHash = sha256Bytes(readFileSync(file));
      const copyHash = sha256Bytes(readFileSync(copy));
      if (releaseHash !== copyHash) legacyManagedFileHashes[rel] = [copyHash];
    }
  }
  // What the copy-era releases put at each path (scripts/copy-era-files.ts):
  // they wrote no install record, so their unchanged files are told from the
  // person's by these bytes.
  // Read as data, not imported: a type for half a megabyte of JSON would weigh on the typecheck.
  const copyEra = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "copy-era-files.json"), "utf-8")) as Record<string, Record<string, string[]>>;
  const retiredCopyFileHashes: Record<string, string[]> = {};
  for (const [rel, hashes] of Object.entries(copyEra[m.name] ?? {})) {
    if (!descriptor.managedDirectories.some((directory) => rel.startsWith(`${directory}/`))) continue;
    // The workspace's seeds are the team's once written (config preserves them,
    // aidlc-init.ts workspaceSeed) and a copy runtime leaves them out
    // (copyChannelOmits), so no signature is owed for them.
    if (rel.startsWith("aidlc/")) continue;
    const release = join(outRoot, rel);
    if (!existsSync(release) || !lstatSync(release).isFile()) {
      retiredCopyFileHashes[rel] = [...hashes].sort();
      continue;
    }
    const releaseHash = sha256Bytes(readFileSync(release));
    const known = new Set(legacyManagedFileHashes[rel] ?? []);
    for (const hash of hashes) if (hash !== releaseHash) known.add(hash);
    if (known.size > 0) legacyManagedFileHashes[rel] = [...known].sort();
  }
  descriptor.retiredCopyFileHashes = retiredCopyFileHashes;
  const descriptorRel = `${m.harnessDir}/${PROJECTION_DATA}`.split(sep).join("/");
  const copyDescriptor = join(copyRoot, descriptorRel);
  if (existsSync(copyDescriptor)) {
    legacyManagedFileHashes[descriptorRel] = [
      sha256Bytes(readFileSync(copyDescriptor)),
    ];
  }
  if (Object.keys(legacyManagedFileHashes).length > 0) {
    descriptor.legacyManagedFileHashes = legacyManagedFileHashes;
  } else {
    delete descriptor.legacyManagedFileHashes;
  }
  writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);

  // A manifest's nativeReplacements text is generated from the route table
  // (permission globs, not invocations), so the prose check skips it; its
  // lines stay as blank lines so reported line numbers still match the file.
  const withoutNativeReplacements = (value: string): string =>
    m.nativeReplacements.reduce(
      (text, { to }) => text.replaceAll(to, to.replace(/[^\n]/g, "")),
      value,
    );
  const leftovers: string[] = [];
  for (const file of walk(outRoot)) {
    if (!/\.(?:md|mdc|json|toml|hook|ts)$/.test(file)) continue;
    const value = readFileSync(file, "utf-8");
    for (const token of ["{{INVOKE}}", "{{TOOL_PREFIX}}", "{{OPTION_LETTERS}}"]) {
      if (value.includes(token)) {
        leftovers.push(`${relative(outRoot, file)}: unexpanded ${token}`);
      }
    }
    if (new RegExp(String.raw`\bbun\s+[^\n]*${harnessDir}/(?:tools|hooks)/aidlc`).test(value)) {
      leftovers.push(`${relative(outRoot, file)}: bun invocation survived native projection`);
    }
    if (bareToolCheck.test(value)) {
      leftovers.push(`${relative(outRoot, file)}: bare bun invocation survived native projection`);
    }
    if (/\baidlc\s+engine\s+(?:utility|runner-gen)\b/.test(value)) {
      leftovers.push(`${relative(outRoot, file)}: retired engine alias survived native projection`);
    }
    leftovers.push(
      ...projectedNamespaceInvocationViolations(relative(outRoot, file), withoutNativeReplacements(value)),
    );
    if (
      relative(outRoot, file).split(sep).join("/").includes("/agents/") &&
      /"allowedCommands"\s*:\s*\[[\s\S]*?"bun [^"]*tools\//.test(value)
    ) {
      leftovers.push(`${relative(outRoot, file)}: bun allowlist survived native projection`);
    }
  }
  if (leftovers.length > 0) {
    throw new Error(`[${m.name}] native invocation projection failed:\n${leftovers.join("\n")}`);
  }
}

function writeProjectedFiles(request: {
  readonly files: readonly ProjectedFile[]; readonly projectRoot: string;
}): void {
  for (const file of request.files) {
    const destination = join(request.projectRoot, file.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, file.content.kind === "text"
      ? file.content.text : file.content.bytes);
    if (file.mode === "executable") chmodSync(destination, 0o755);
  }
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

function routedListing(distribution: HostDistribution) {
  const { listing } = distribution;
  return { ...listing,
    firstRunSteps: listing.firstRunSteps ? [...listing.firstRunSteps] : undefined,
    cliFirst: listing.cliFirst ? { ...listing.cliFirst, env: [...listing.cliFirst.env],
      firstRunSteps: [...listing.cliFirst.firstRunSteps] } : undefined };
}

function routedView(request: {
  members: HostModule; distribution: HostDistribution; files: readonly Pick<ProjectedFile, "path" | "content" | "origin">[];
}): ReleaseView {
  const { members, distribution, files } = request;
  const descriptorPath = `${members.host.directory}/tools/data/harness.json`;
  const descriptor = files.find((file) => file.path === descriptorPath);
  if (!descriptor) {
    throw new Error(`The full host omitted its descriptor: ${members.host.distribution}`);
  }
  const decoded: unknown = JSON.parse(hostContentBytes(descriptor.content).toString("utf-8"));
  const metadata = z.object({ productName: z.string(), configNextStep: z.string() })
    .safeParse(decoded);
  if (!metadata.success) {
    throw new Error(`The rendered host descriptor is invalid: ${members.host.distribution}`);
  }
  const onboarding = onboardingPathOf({ host: members.host, files });
  return { name: members.host.distribution, harnessDir: members.host.directory,
    ...metadata.data, ...routedListing(distribution),
    rootIntegrations: routedIntegrations(distribution),
    copyOnly: distribution.native.copyOnly,
    nativeReplacements: distribution.native.replacements,
    onboarding: onboarding?.startsWith(`${members.host.directory}/`) ? onboarding : undefined,
  };
}

async function buildHost({ name, outRoot, channel }: {
  readonly name: string; readonly outRoot: string; readonly channel: DistributionChannel;
}): Promise<ReleaseView> {
  const routed = routedHost(name);
  if (!routed) throw new Error(`The host is not routed through the composition root: ${name}`);
  const captured = hostBuildInputs.get(name);
  if (!captured) throw new Error(`Authored host sources were not captured for ${name}`);
  const { members } = routed;
  const tokens = { ...members.projection.tokens, HARNESS_DIR: members.host.directory,
    ...channelTokens({ channel, directory: members.host.directory,
      prefix: TRUSTED_COMMAND_PREFIX, namespace: TRUSTED_ROUTE_NAMESPACE }) };
  const request = { host: captured.host, core: coreBuild,
    files: captured.files, prepare: (file: AuthoredHostFile) => prepareHostSource({ host: captured.host, file,
      steps: [(content) => bindCopiedSource({ source: file.source, content, tokens })] }),
    tokens, channel, modelCap: TIER_CAP, entrypoints: shippedSettingsEntrypoints(CORE_ROOT),
    projectRoot: pathToFileURL(outRoot), reviewerAgents };
  if (channel === "copy") return buildCopyHost({ routed, request, outRoot });
  const rendered = await packageBuildRoot.projectHost(request);
  if (!rendered.ok) throw new Error(JSON.stringify(rendered.refusal));
  writeProjectedFiles({ files: rendered.value.projection.files, projectRoot: outRoot });
  const treeRoot = join(outRoot, members.host.directory);
  emitPluginAuthoringData(treeRoot);
  const view = routedView({ ...routed, files: rendered.value.projection.files });
  writeProjectionData(outRoot, treeRoot, view);
  return view;
}

async function buildCopyHost({ routed, request, outRoot }: {
  readonly routed: RoutedHost; readonly request: HostBuildRequest; readonly outRoot: string;
}): Promise<ReleaseView> {
  const built = await packageBuildRoot.buildPayload(request);
  if (!built.ok) throw new Error(JSON.stringify(built.refusal));
  const written = await writePayloadTree({ root: pathToFileURL(`${outRoot}/`), payload: built.value,
    fileSystem: nodeFileSystem });
  if (!written.ok) throw new Error(JSON.stringify(written.refusal));
  emitPluginAuthoringData(join(outRoot, routed.members.host.directory));
  return routedView({ ...routed, files: built.value.files.flatMap((file) =>
    file.origin.kind === "projected" ? [{ path: file.path, content: file.content, origin: file.origin.origin }] : []) });
}

// ---------------------------------------------------------------------------
// write mode: regenerate dist/<name> in place (clean-sweep).
// ---------------------------------------------------------------------------
async function writeCopyHarness(name: string): Promise<void> {
  const distDir = join(REPO_ROOT, "dist", name);
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  const view = await buildHost({ name, outRoot: distDir, channel: "copy" });
  console.log(`[${name}] regenerated dist/${name}/${view.harnessDir}`);
}

async function writeReleaseHarness(name: string): Promise<void> {
  const releaseDir = join(REPO_ROOT, "dist-release", name);
  const copyRoot = join(REPO_ROOT, "dist", name);
  if (existsSync(releaseDir)) rmSync(releaseDir, { recursive: true, force: true });
  const m = await buildHost({ name, outRoot: releaseDir, channel: "native" });
  rewriteNativeInvocations(releaseDir, m, copyRoot);
  console.log(`[${name}] regenerated dist-release/${name}/${m.harnessDir}`);
}

// A root file's part under tools/data/root-blocks/ is that file's text, as
// buildTree writes it. The native rewrite changes the root file (AGENTS.md's
// native wording) and skips the part, which has no extension, so the part
// takes the rewritten text again: config and the engine merge AI-DLC's text
// from it, and a native install must never be told it needs bun.
function syncRootBlockParts(outRoot: string, m: ReleaseView): void {
  for (const integration of m.rootIntegrations) {
    const part = integration.policy === "managed-block"
      ? integration.marker || basename(integration.path)
      : copyStartsWithout(integration) || integration.policy === "json-entries"
      ? basename(integration.path)
      : undefined;
    const file = join(outRoot, integration.path);
    const dst = part === undefined ? undefined : join(outRoot, m.harnessDir, "tools", "data", "root-blocks", part);
    if (dst !== undefined && existsSync(file) && existsSync(dst)) writeFileSync(dst, readFileSync(file));
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);

// `package.ts codex trust --project <abs-dir> [--hooks-json <abs-path>]` —
// print the codex hook-trust entries with <PROJECT_DIR> substituted, for the
// installer to paste into $CODEX_HOME/config.toml (the trust-seed.toml recipe).
if (argv[0] === "codex" && argv[1] === "trust") {
  const usage =
    "usage: package.ts codex trust --project <abs-dir> [--hooks-json <abs-path>]";
  const failTrustArgs = (reason: string): never => {
    console.error(`codex trust: ${reason}`);
    console.error(usage);
    process.exit(1);
  };
  const fullyQualifiedOnEitherPlatform = (path: string): boolean => {
    const startsAsUnc = path.startsWith("\\\\") || path.startsWith("//");
    if (startsAsUnc) {
      return /^[\\/]{2}[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(path);
    }
    return posix.isAbsolute(path) || /^[A-Za-z]:[\\/]/.test(path);
  };
  let project: string | null = null;
  let hooksJson: string | null = null;
  const trustArgs = argv.slice(2);
  for (let i = 0; i < trustArgs.length; i += 2) {
    const flag = trustArgs[i];
    const value = trustArgs[i + 1];
    if (flag !== "--project" && flag !== "--hooks-json") {
      failTrustArgs(`unknown argument "${flag}"`);
    }
    if (!value || value.startsWith("--")) {
      failTrustArgs(`${flag} requires an absolute path`);
    }
    if (!fullyQualifiedOnEitherPlatform(value)) {
      failTrustArgs(`${flag} must be a fully qualified absolute path`);
    }
    if (flag === "--project") {
      if (project !== null) failTrustArgs("--project may be specified only once");
      project = value;
    } else {
      if (hooksJson !== null) failTrustArgs("--hooks-json may be specified only once");
      hooksJson = value;
    }
  }
  const resolvedProject = project ?? failTrustArgs("--project is required");
  const projectPath = win32.isAbsolute(resolvedProject) &&
    (!posix.isAbsolute(resolvedProject) || resolvedProject.startsWith("//")) ? win32 : posix;
  const trusted = trustEntries({
    hooksJsonPath: hooksJson ?? projectPath.join(resolvedProject, ".codex", "hooks.json"),
    harnessName: "codex",
    invoke: substituteInvocationTokens("{{INVOKE}}", ".codex"),
    trustedNamespace: TRUSTED_ROUTE_NAMESPACE,
  }, packageBuildRoot.settingsCapabilities);
  if (!trusted.ok) {
    console.error(trusted.refusal.reason);
    process.exit(1);
  }
  console.log(trusted.value);
  process.exit(0);
}

const PLUGINS_ROOT = join(REPO_ROOT, "plugins");

// Per-harness plugin projection descriptors are derived from manifests once,
// consumed directly by the checkout emitter, and emitted into every tools/data
// bundle for the standalone builder. Native placements supplement legacy rows.
let pluginTargetCache: PluginTargetTable | null = null;
function routedPluginTarget(name: string, routed: RoutedHost): PluginTarget {
  const plugin = routed.distribution.plugin;
  const kind = z.enum(["store", "kiro", "kiro-ide", "cursor"]).safeParse(plugin.format);
  if (!kind.success) {
    throw new Error(`The legacy plugin emitter does not support format ${plugin.format}`);
  }
  return { harnessName: name, manifestDir: plugin.manifestDir,
    marketplaceDir: plugin.marketplaceDir, hostCatalogue: plugin.catalogue === "written",
    harnessLeaf: routed.members.host.directory, kind: kind.data,
    installRoots: [...plugin.installRoots] };
}

function pluginTargets(): PluginTargetTable {
  if (pluginTargetCache) return pluginTargetCache;
  pluginTargetCache = {};
  for (const harnessName of discoverHarnessNames()) {
    const routed = routedHost(harnessName);
    if (!routed) throw new Error(`The host is not routed through the composition root: ${harnessName}`);
    pluginTargetCache[harnessName] = routedPluginTarget(harnessName, routed);
  }
  return pluginTargetCache;
}

function pluginTargetFor(harnessName: string): PluginTarget | null {
  return pluginTargets()[harnessName] ?? null;
}

function buildRepositoryPluginProjection(request: {
  plugin: PluginBuildTarget; harnessName: string; outDir: string;
  reviewerAgents: ReadonlySet<string>; outputBoundary?: string;
}): void {
  const { plugin, harnessName, outDir, reviewerAgents, outputBoundary = REPO_ROOT } = request;
  const target = pluginTargetFor(harnessName);
  if (!target) {
    throw new Error(
      `no plugin target for harness "${harnessName}" (missing manifest)`,
    );
  }
  emitPluginProjection({
    pluginRoot: join(PLUGINS_ROOT, plugin.directory),
    target,
    outDir,
    outputBoundary,
    templateHooksDir: PLUGIN_HOOKS_TEMPLATE_SRC,
    reviewerAgents,
    // This repository's own plugins/ are AI-DLC's: aidlc-<name> in aidlc-plugins.
    firstParty: true,
  });
}

// Which harnesses get a projection = every built harness with a manifest (each
// derives a plugin target). Derived, so a new harness is covered automatically.
function pluginHarnessesFor(harnesses: string[]): string[] {
  return harnesses.filter((h) => pluginTargetFor(h) !== null);
}

function emitPlugins(request: { harnesses: string[]; plugins: PluginBuildCatalog;
  distRoot?: string; output?: "verbose" | "silent" }): void {
  const { harnesses, plugins, distRoot = join(REPO_ROOT, "dist"), output = "verbose" } = request;
  const reviewerAgents = reviewerAgentSet(plugins.method);
  for (const plugin of plugins.plugins) {
    for (const harnessName of pluginHarnessesFor(harnesses)) {
      buildRepositoryPluginProjection({ plugin, harnessName, reviewerAgents,
        outDir: join(distRoot, "plugins", plugin.directory, harnessName), outputBoundary: distRoot });
      if (output === "verbose") {
        console.log(`[plugin:${plugin.directory}] emitted dist/plugins/${plugin.directory}/${harnessName}/`);
      }
    }
  }
  const built = pluginHarnessesFor(harnesses).map((name) => pluginTargetFor(name) as PluginTarget);
  for (const file of writeFirstPartyCatalogues(join(distRoot, "plugins"), built)) {
    if (output === "verbose") console.log(`[plugins] emitted dist/plugins/${file}`);
  }
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
    for (const harnessName of pluginHarnessesFor(harnesses)) {
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
    await buildHost({ name, outRoot: copyRoot, channel: "copy" });
    const view = await buildHost({ name, outRoot: nativeRoot, channel: "native" });
    rewriteNativeInvocations(nativeRoot, view, copyRoot);
  }
  assertIdenticalRootIntegrations(distRoot, harnesses);
  assertIdenticalRootIntegrations(releaseRoot, harnesses);
  emitPlugins({ harnesses, plugins, distRoot, output: "silent" });
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

// `package.ts plugin build <plugin> <harness> <outDir>` — render ONE plugin
// projection into an arbitrary dir. The target-dir seam that lets t188 (and any
// caller) exercise the real emitter WITHOUT touching the local dist/plugins/
// trees — writeCopyHarness/emitPlugins rmSync + rewrite dist, which a parallel test
// tier must never do (it races sibling tests). Pure builder call.
if (argv[0] === "plugin" && argv[1] === "build") {
  const [pluginName, harnessName, outDir, ...extra] = argv.slice(2);
  if (
    !pluginName ||
    !harnessName ||
    !outDir ||
    extra.length > 0 ||
    [pluginName, harnessName, outDir].some((arg) => arg.startsWith("-"))
  ) {
    console.error("usage: package.ts plugin build <plugin> <harness> <outDir>");
    process.exit(1);
  }
  const identity = pluginBuildName(pluginName);
  if (!identity.ok) {
    console.error(identity.refusal.kind === "reserved-plugin-name"
      ? `plugin name "${identity.refusal.raw}" is reserved; choose a non-reserved plugin name.`
      : `invalid plugin name "${identity.refusal.raw}"; use a lowercase kebab-case name.`);
    process.exit(1);
  }
  const core = await packageBuildRoot.loadCore();
  if (!core.ok) {
    console.error(JSON.stringify(core.refusal));
    process.exit(1);
  }
  const catalog = await packageBuildRoot.loadPlugins({ core: core.value });
  if (!catalog.ok) {
    console.error(JSON.stringify(catalog.refusal));
    process.exit(1);
  }
  const plugin = catalog.value.plugins.find((entry) => entry.directory === pluginName);
  if (!plugin) {
    console.error(`unknown plugin "${pluginName}" (have: ${catalog.value.plugins
      .map((entry) => entry.directory).join(", ") || "none"})`);
    process.exit(1);
  }
  const target = pluginTargetFor(harnessName);
  if (!target) {
    console.error(`unknown plugin harness "${harnessName}" (have: ${discoverHarnessNames().join(", ")})`);
    process.exit(1);
  }
  const outArg = outDir.replace(/[/\\]+$/, "") || outDir;
  const resolvedOut = isAbsolute(outArg) ? outArg : join(process.cwd(), outArg);
  try {
    buildRepositoryPluginProjection({ plugin, harnessName, outDir: resolvedOut,
      outputBoundary: resolvedOut, reviewerAgents: reviewerAgentSet(catalog.value.method) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}

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

const builtFrom = packageInputsFingerprint(REPO_ROOT);
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
  const required = [...routed.members.projection.agents.inputs, ...routed.members.projection.skills.inputs,
    ...routed.members.projection.settings.inputs, ...routed.members.projection.documents.inputs,
    ...routed.members.projection.placements.map((placement) => placement.source)];
  const captured = await packageBuildRoot.readHostSources({ name, directory: routed.members.host.directory,
    root: pathToFileURL(join(HARNESS_ROOT, name)), copied: [], required });
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
  if (packageInputsFingerprint(REPO_ROOT) !== builtFrom) {
    throw new Error("A packaging input changed during the determinism check; run it again.");
  }
  console.log(
    `package --check: deterministic across two independent build(s) ` +
      `for ${targets.join(", ")}.`,
  );
} else {
  forgetPackagedSources(REPO_ROOT, targets);
  cleanWriteOutputs({ harnesses: targets, kind: named === undefined ? "full" : "named",
    plugins: pluginBuilds });
  for (const n of targets) {
    await writeCopyHarness(n);
    await writeReleaseHarness(n);
  }
  assertIdenticalRootIntegrations(join(REPO_ROOT, "dist"), targets);
  assertIdenticalRootIntegrations(join(REPO_ROOT, "dist-release"), targets);
  emitPlugins({ harnesses: targets, plugins: pluginBuilds });
  // Last, so only a finished build from unchanged sources is recorded as current.
  if (!recordPackagedSources(REPO_ROOT, targets, builtFrom)) {
    console.error(
      "[sources] a packaging input changed while packaging, so the generated trees may mix old and new files: run `bun scripts/package.ts` again.",
    );
    process.exit(1);
  }
}
