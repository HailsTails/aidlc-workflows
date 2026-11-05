import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { z } from "zod";
import { cleanupTestProject, createTestProject, REPO_ROOT } from "./fixtures.ts";
import { testGuardEnvironment } from "./runner-profile.ts";
import { NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "./test-budget.ts";

export const MANAGED_FILE = ".claude/sensors/aidlc-linter.md";
export const OTHER_FILE = ".claude/sensors/aidlc-type-check.md";
export const RETIRED_FILE = ".claude/knowledge/ordinary-retired.txt";
export const OVERLAY_FILE = ".claude/knowledge/project-local.md";
export const LEDGER_FILE = "aidlc/user-session-ledger.jsonl";
const DESCRIPTOR_FILE = ".claude/tools/data/aidlc-projection.json";

export type InstallFixture = {
  root: string;
  project: string;
  artifact: string;
  packagedRunner: string;
  installedRunner: string;
  env: NodeJS.ProcessEnv;
};
export type ConfigResult = { status: number | null; stdout: string; stderr: string; envelope: ConfigEnvelope | null };
export type ConfigAction = { path: string; action: string; detail?: string };
const configEnvelopeSchema = z.object({
  message: z.string().optional(),
  data: z.object({ actions: z.array(z.object({ path: z.string(), action: z.string(), detail: z.string().optional() })).optional() }).optional(),
});
type ConfigEnvelope = z.infer<typeof configEnvelopeSchema>;
const editableDescriptorSchema = z.object({
  managedDirectories: z.array(z.string()),
  rootIntegrations: z.array(z.object({ path: z.string(), policy: z.string() }).passthrough()),
}).passthrough();
type EditableDescriptor = z.infer<typeof editableDescriptorSchema>;
const userSettingsSchema = z.object({ model: z.string(), env: z.record(z.string(), z.unknown()),
  permissions: z.object({ allow: z.array(z.string()), deny: z.array(z.string()) }),
});
const manifestSchema = z.object({ files: z.record(z.string(), z.unknown()) });

function parseConfigEnvelope(text: string): ConfigEnvelope | null {
  try { return configEnvelopeSchema.parse(JSON.parse(text)); }
  catch { return null; }
}

export function appendFixtureFile(request: { root: string; path: string; text: string }): void {
  const target = join(request.root, request.path);
  writeFileSync(target, `${readFileSync(target, "utf8")}\n${request.text}`);
}

export function writeFixtureFile(request: { root: string; path: string; text: string }): void {
  const target = join(request.root, request.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, request.text);
}

export function createInstallFixture(): InstallFixture {
  const root = createTestProject();
  const project = join(root, "project");
  const artifact = join(root, "artifact");
  const home = join(root, "home");
  const temp = join(root, "temp");
  mkdirSync(home, { recursive: true });
  mkdirSync(temp, { recursive: true });
  cpSync(join(REPO_ROOT, "dist", "claude"), artifact, { recursive: true });
  writeFixtureFile({ root: artifact, path: RETIRED_FILE, text: "Ordinary owned retirement specimen.\n" });
  writeFixtureFile({ root: project, path: OVERLAY_FILE, text: "project overlay bytes" });
  writeFixtureFile({ root: project, path: LEDGER_FILE, text: "untouched ledger bytes" });
  writeFixtureFile({ root: project, path: ".claude/settings.json", text: JSON.stringify({
    model: "personal-model", env: { INSTALL_TEST_SETTING: "keep-me" },
    permissions: { allow: ["Read(my-files/**)"], deny: ["Bash(rm:*)"] },
  }) });
  const env = testGuardEnvironment(process.env, "production");
  Object.assign(env, {
    HOME: home, USERPROFILE: home, AIDLC_HOME: join(home, ".aidlc"),
    AIDLC_INSTALL_ROOT: join(home, "installation"), AIDLC_BIN_DIR: join(home, "bin"),
    APPDATA: join(home, "AppData", "Roaming"), LOCALAPPDATA: join(home, "AppData", "Local"),
    TEMP: temp, TMP: temp, TMPDIR: temp, CLAUDE_CONFIG_DIR: join(home, ".claude"),
    CODEX_HOME: join(home, ".codex"), CI: "1", NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(home, "no-global-config"),
  });
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_COMMON_DIR;
  delete env.GIT_INDEX_FILE;
  return { root, project, artifact, env,
    packagedRunner: join(artifact, ".claude/tools/aidlc.ts"),
    installedRunner: join(project, ".claude/tools/aidlc.ts"),
  };
}

export function cleanInstallFixture(fixture: InstallFixture | undefined): void {
  cleanupTestProject(fixture?.root);
}

export function runConfig(request: {
  fixture: InstallFixture; options: string[]; runner?: string; artifact?: string;
}): ConfigResult {
  const result = spawnSync(process.execPath, [
    request.runner ?? request.fixture.installedRunner, "config", "--from",
    request.artifact ?? request.fixture.artifact, "--harness", "claude", "--project-dir",
    request.fixture.project, "--json", ...request.options,
  ], { cwd: request.fixture.project, env: request.fixture.env, encoding: "utf8",
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, envelope: parseConfigEnvelope(result.stdout) };
}

export function actionFor(request: { result: ConfigResult; path: string }): ConfigAction[] {
  return (request.result.envelope?.data?.actions ?? []).filter((action) => action.path.replaceAll("\\", "/") === request.path);
}

export function descriptorOf(artifact: string): EditableDescriptor {
  return editableDescriptorSchema.parse(JSON.parse(readFileSync(join(artifact, DESCRIPTOR_FILE), "utf8")));
}

export function writeDescriptor(request: { artifact: string; descriptor: EditableDescriptor }): void {
  writeFileSync(join(request.artifact, DESCRIPTOR_FILE), `${JSON.stringify(request.descriptor, null, 2)}\n`);
}

export function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function snapshotEntries(request: { root: string; directory: string }): string[] {
  return readdirSync(request.directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(request.directory, entry.name);
    const name = relative(request.root, path).replaceAll("\\", "/");
    if (entry.isDirectory()) return [`directory:${name}`, ...snapshotEntries({ ...request, directory: path })];
    return [`${name}:${statSync(path).mode}:${fileHash(path)}`];
  });
}

export function projectSnapshot(project: string): string[] {
  return snapshotEntries({ root: project, directory: project }).sort();
}

export function preservedUserState(project: string): unknown {
  const settings = userSettingsSchema.parse(JSON.parse(readFileSync(join(project, ".claude/settings.json"), "utf8")));
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(project, ".claude/tools/data/aidlc-manifest.json"), "utf8")));
  return {
    model: settings.model, customEnv: settings.env.INSTALL_TEST_SETTING,
    allow: settings.permissions.allow.includes("Read(my-files/**)"),
    deny: settings.permissions.deny.includes("Bash(rm:*)"),
    overlay: readFileSync(join(project, OVERLAY_FILE), "utf8"),
    ledger: readFileSync(join(project, LEDGER_FILE), "utf8"),
    overlayOwned: Object.hasOwn(manifest.files, OVERLAY_FILE),
    ledgerOwned: Object.hasOwn(manifest.files, LEDGER_FILE),
  };
}