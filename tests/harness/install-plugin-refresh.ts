import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { REPO_ROOT } from "./fixtures.ts";
import { createInstallFixture, fileHash, type InstallFixture } from "./install-adoption.ts";
import { NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "./test-budget.ts";

export const TEST_PRO_CONTENT = [
  ".claude/aidlc-common/stages/construction/test-pro-integration.md",
  ".claude/sensors/aidlc-coverage-threshold.md",
  ".claude/tools/aidlc-sensor-coverage-threshold.ts",
  ".claude/scopes/test-pro-validation.md",
  ".claude/agents/test-pro-metrics-agent.md",
  ".claude/knowledge/test-pro-metrics-agent/methodology.md",
  ".claude/tools/data/plugin-owned-test-pro.json",
  ".claude/tools/data/plugin-owned-rin.json",
];
export const RIN_HOOK = ".claude/hooks/guard-navigation.mjs";
export const TEST_PRO_RUNNER = ".claude/skills/test-pro-integration/SKILL.md";
export const CORE_STAGE = ".claude/aidlc-common/stages/construction/build-and-test.md";
const HARNESS = ".claude/tools/data/harness.json";
const GRAPH = ".claude/tools/data/stage-graph.json";

export function writeJson(request: { path: string; value: unknown }): void {
  mkdirSync(dirname(request.path), { recursive: true });
  writeFileSync(request.path, `${JSON.stringify(request.value, null, 2)}\n`);
}

export function createPluginRefreshFixture(): InstallFixture {
  const fixture = createInstallFixture();
  const home = join(fixture.root, "home");
  const pluginRoot = join(fixture.root, "plugins");
  const testPro = join(pluginRoot, "test-pro");
  const rin = join(pluginRoot, "rin");
  cpSync(join(REPO_ROOT, "dist/plugins/test-pro/claude"), testPro, { recursive: true });
  cpSync(join(REPO_ROOT, "dist/plugins/rin/claude"), rin, { recursive: true });
  const registry = join(home, "installed_plugins.json");
  const settings = join(home, "host-settings.json");
  writeJson({ path: registry, value: { version: 2, plugins: {
    "aidlc-test-pro@fixture": [{ scope: "user", installPath: testPro, version: "0.1.0" }],
    "aidlc-rin@fixture": [{ scope: "user", installPath: rin, version: "0.1.0" }],
  } } });
  writeJson({ path: settings, value: { enabledPlugins: { "aidlc-test-pro@fixture": true, "aidlc-rin@fixture": true } } });
  Object.assign(fixture.env, { AIDLC_CLAUDE_PLUGIN_REGISTRY: registry, AIDLC_CLAUDE_SETTINGS: settings,
    AIDLC_PROJECT_DIR: fixture.project, CLAUDE_PROJECT_DIR: fixture.project,
    AIDLC_HARNESS_DIR: ".claude", AIDLC_HARNESS_NAME: "claude",
  });
  delete fixture.env.AIDLC_PLUGIN_ROOT;
  delete fixture.env.CLAUDE_PLUGIN_ROOT;
  delete fixture.env.PLUGIN_ROOT;
  delete fixture.env.AIDLC_RUNTIME_ROOT;
  delete fixture.env.AIDLC_DEV_SOURCE;
  return fixture;
}

export function installedCommand(request: { fixture: InstallFixture; command: "sync" | "select" | "list"; selection?: string }) {
  const args = request.command !== "select"
    ? [request.fixture.installedRunner, "engine", "plugin", request.command, "--json"]
    : [join(request.fixture.project, ".claude/tools/aidlc-utility.ts"), "select-plugins", request.selection ?? "aidlc"];
  const result = spawnSync(process.execPath, args, { cwd: request.fixture.project, env: request.fixture.env,
    encoding: "utf8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}


export function pluginState(project: string) {
  const config = z.object({ plugins: z.array(z.string()) }).parse(JSON.parse(readFileSync(join(project, HARNESS), "utf8")));
  const graph = z.array(z.object({ slug: z.string(), enabled: z.boolean().optional() }).passthrough())
    .parse(JSON.parse(readFileSync(join(project, GRAPH), "utf8")));
  const settings = readFileSync(join(project, ".claude/settings.json"), "utf8");
  const manifest = z.object({ files: z.record(z.string(), z.unknown()) })
    .parse(JSON.parse(readFileSync(join(project, ".claude/tools/data/aidlc-manifest.json"), "utf8")));
  return {
    selection: config.plugins, hookBody: existsSync(join(project, RIN_HOOK)),
    hookRegistration: settings.includes("guard-navigation.mjs"), runner: existsSync(join(project, TEST_PRO_RUNNER)),
    contribution: readFileSync(join(project, CORE_STAGE), "utf8").includes("Step 8a (test-pro)"),
    graphPresent: graph.some((stage) => stage.slug === "test-pro-integration"),
    graphEnabled: graph.find((stage) => stage.slug === "test-pro-integration")?.enabled,
    coreClaimsPlugin: TEST_PRO_CONTENT.some((path) => Object.hasOwn(manifest.files, path)),
  };
}
const ownerSchema = z.object({ name: z.string(), files: z.array(z.object({ path: z.string(), sha256: z.string() })) });
const registrationSchema = z.object({ kind: z.literal("group"), path: z.literal(".claude/settings.json"), event: z.string(), group: z.record(z.string(), z.unknown()) });
const contributionSchema = z.object({ $hooks: z.object({ hook_registrations: z.object({
  pluginName: z.literal("rin"), harness: z.literal("claude"), registrations: z.array(registrationSchema),
}) }) });
export type PluginEvidence = {
  retainedPaths: string[];
  hookPaths: string[];
  registrations: z.infer<typeof registrationSchema>[];
};

export function capturePluginEvidence(project: string): PluginEvidence {
  const ownership = ["rin", "test-pro"].flatMap((name) => {
    const value = ownerSchema.parse(JSON.parse(readFileSync(join(project, `.claude/tools/data/plugin-owned-${name}.json`), "utf8")));
    if (value.name !== name) throw new Error(`Fixture ownership identity mismatch: ${name}`);
    return value.files.map((file) => file.path);
  });
  const contributions = contributionSchema.parse(JSON.parse(readFileSync(join(project, ".claude/tools/data/plugin-contrib-rin.json"), "utf8")));
  return {
    retainedPaths: [...new Set([...ownership.filter((path) => !path.startsWith(".claude/hooks/")), ...TEST_PRO_CONTENT])].sort(),
    hookPaths: ownership.filter((path) => path.startsWith(".claude/hooks/")).sort(),
    registrations: contributions.$hooks.hook_registrations.registrations,
  };
}

export function allRetainedContent(request: { project: string; evidence: PluginEvidence }): Record<string, string> {
  return Object.fromEntries(request.evidence.retainedPaths.map((path) => [path, fileHash(join(request.project, path))]));
}

export function recordedExecution(request: { project: string; evidence: PluginEvidence }) {
  const settings = z.object({ hooks: z.record(z.string(), z.array(z.unknown())) })
    .parse(JSON.parse(readFileSync(join(request.project, ".claude/settings.json"), "utf8")));
  return {
    bodies: Object.fromEntries(request.evidence.hookPaths.filter((path) => existsSync(join(request.project, path)))
      .map((path) => [path, fileHash(join(request.project, path))])),
    registrations: request.evidence.registrations.filter((registration) =>
      (settings.hooks[registration.event] ?? []).some((group) => isDeepStrictEqual(group, registration.group))),
  };
}

export function hostInventory(fixture: InstallFixture) {
  const response = installedCommand({ fixture, command: "list" });
  const value = z.object({ data: z.object({ inventory: z.object({ capability: z.string() }),
    statuses: z.array(z.object({ key: z.string() }).passthrough()),
  }) }).parse(JSON.parse(response.stdout));
  return { status: response.status, capability: value.data.inventory.capability,
    keys: value.data.statuses.map((entry) => entry.key).sort() };
}