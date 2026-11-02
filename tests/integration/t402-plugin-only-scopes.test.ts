// covers: function:deselectedCoreScopeFiles, function:selectionDefaultScope, function:projectSelectionIntoClaudeSettings, function:scopeEnabledBySelection

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { buildPluginProjection, composePluginFixture } from "../harness/plugin-kit.ts";
import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_RUNTIME_CASE_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const BUN = process.execPath;
const PLUGIN = "test-pro";
const PLUGIN_SCOPE = "test-pro-validation";
const RELEASE = join(REPO_ROOT, "dist", "claude");

interface ClaudeSettings {
  companyAnnouncements: string[];
  env: Record<string, string>;
}

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

const temporary: string[] = [];
let pluginBuilt: string;

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-scopes-"));
  temporary.push(root);
  pluginBuilt = buildPluginProjection(PLUGIN, "claude", join(root, "plugin", "claude"));
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

afterAll(() => {
  for (const path of temporary) rmSync(path, { recursive: true, force: true });
});

function installedProject(): string {
  const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-project-"));
  temporary.push(root);
  const projectDir = composePluginFixture({
    plugin: PLUGIN,
    harness: "claude",
    projectDir: join(root, "project"),
    pluginBuilt,
  }).projectDir;
  const recorded = aidlc(projectDir, ["config", "--from", RELEASE, "--force", "--yes"]);
  expect(recorded.status, recorded.stdout + recorded.stderr).toBe(0);
  return projectDir;
}

function aidlc(projectDir: string, args: readonly string[]): CommandResult {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectDir,
    AIDLC_HARNESS_DIR: ".claude",
  };
  delete environment.AWS_AIDLC_DEFAULT_SCOPE;
  const result = spawnSync(BUN, [join(projectDir, ".claude", "tools", "aidlc.ts"), ...args], {
    cwd: projectDir,
    encoding: "utf-8",
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
    env: environment,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function selectPlugins(projectDir: string, plugins: string): CommandResult {
  const result = aidlc(projectDir, ["config", "project", "--plugins", plugins, "--yes"]);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return result;
}

function settingsPath(projectDir: string): string {
  return join(projectDir, ".claude", "settings.json");
}

function settings(projectDir: string): ClaudeSettings {
  return JSON.parse(readFileSync(settingsPath(projectDir), "utf-8")) as ClaudeSettings;
}

function shippedSettings(): ClaudeSettings {
  return JSON.parse(readFileSync(join(RELEASE, ".claude", "settings.json"), "utf-8")) as ClaudeSettings;
}

function setDefaultScope(projectDir: string, scope: string): void {
  const current = settings(projectDir);
  writeFileSync(
    settingsPath(projectDir),
    `${JSON.stringify({ ...current, env: { ...current.env, AWS_AIDLC_DEFAULT_SCOPE: scope } }, null, 2)}\n`,
  );
}

function installedScopeFiles(projectDir: string): string[] {
  return readdirSync(join(projectDir, ".claude", "scopes")).filter((name) => name.endsWith(".md")).sort();
}

function shippedCoreScopeFiles(): string[] {
  return readdirSync(join(RELEASE, ".claude", "scopes")).filter((name) => name.startsWith("aidlc-")).sort();
}

function resolvedDefaultScope(projectDir: string): CommandResult {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    AIDLC_HARNESS_DIR: ".claude",
    AIDLC_RUNTIME_HARNESS_ROOT: join(projectDir, ".claude"),
    AIDLC_RUNTIME_PROJECT_DIR: projectDir,
    AWS_AIDLC_DEFAULT_SCOPE: settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE,
  };
  const result = spawnSync(
    BUN,
    [join(projectDir, ".claude", "tools", "aidlc-utility.ts"), "resolve-env-scope", "--project-dir", projectDir],
    {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
      env: environment,
    },
  );
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function helpText(projectDir: string): string {
  const result = spawnSync(BUN, [join(projectDir, ".claude", "tools", "aidlc-utility.ts"), "help"], {
    cwd: projectDir,
    encoding: "utf-8",
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: ".claude", AWS_AIDLC_DEFAULT_SCOPE: settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE },
  });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  return result.stdout;
}

function saveComposedScope(projectDir: string): string {
  const fixture = join(REPO_ROOT, "tests", "fixtures", "composed-scope-live");
  const identity = readFileSync(join(fixture, "scope.md"), "utf-8");
  const name = (/^name:\s*(.+)$/m.exec(identity)?.[1] ?? "").trim();
  writeFileSync(join(projectDir, ".claude", "scopes", `aidlc-${name}.md`), identity);
  const gridPath = join(projectDir, ".claude", "tools", "data", "scope-grid.json");
  const grid = JSON.parse(readFileSync(gridPath, "utf-8")) as Record<string, { stages: Record<string, string> }>;
  grid[name] = { stages: JSON.parse(readFileSync(join(fixture, "stages.json"), "utf-8")) as Record<string, string> };
  writeFileSync(gridPath, JSON.stringify(grid, null, 2));
  const compiled = spawnSync(BUN, [join(projectDir, ".claude", "tools", "aidlc-graph.ts"), "compile"], {
    cwd: projectDir,
    encoding: "utf-8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: ".claude" },
  });
  expect(compiled.status, `${compiled.stdout}${compiled.stderr}`).toBe(0);
  expect(existsSync(join(projectDir, "aidlc", "scopes", `${name}.md`))).toBe(true);
  return name;
}

describe("a selection without the core plugin installs only the selected plugins' scopes", () => {
  test("removes core's scope files and points the default scope and banner at the plugin's scopes", () => {
    const projectDir = installedProject();
    expect(installedScopeFiles(projectDir)).toEqual([...shippedCoreScopeFiles(), `${PLUGIN_SCOPE}.md`].sort());

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(installedScopeFiles(projectDir)).toEqual([`${PLUGIN_SCOPE}.md`]);
    expect(existsSync(join(projectDir, ".claude", "skills", "aidlc-bugfix", "SKILL.md"))).toBe(false);
    expect(selected.stdout).toContain("that the plugin selection leaves out:");
    expect(selected.stdout).toContain(".claude/skills/aidlc-bugfix/SKILL.md");
    expect(selected.stdout).not.toContain("no longer part of AI-DLC");
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    const resolved = resolvedDefaultScope(projectDir);
    expect(resolved.status, resolved.stdout + resolved.stderr).toBe(0);
    expect(resolved.stdout).toBe(`scope=${PLUGIN_SCOPE}\n`);
    expect(resolved.stderr).toBe("");
    const banner = settings(projectDir).companyAnnouncements.join("\n");
    expect(banner).toContain(`| ${PLUGIN_SCOPE}`);
    expect(banner).not.toContain("| classic");
    expect(banner).not.toContain("**Phases**");
    expect(banner).toContain("**Workflow**");

    const refreshed = aidlc(projectDir, ["config", "--from", RELEASE, "--yes"]);
    expect(refreshed.status, refreshed.stdout + refreshed.stderr).toBe(0);
    expect(installedScopeFiles(projectDir)).toEqual([`${PLUGIN_SCOPE}.md`]);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    expect(settings(projectDir).companyAnnouncements.join("\n")).toBe(banner);
    expect(refreshed.stdout).not.toContain("kept your companyAnnouncements");
  });

  test("keeps a core scope file someone changed, switched off, and still applies the selection", () => {
    const projectDir = installedProject();
    const classic = join(projectDir, ".claude", "scopes", "aidlc-classic.md");
    writeFileSync(classic, `${readFileSync(classic, "utf-8")}\nOur own note.\n`);

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(installedScopeFiles(projectDir)).toEqual(["aidlc-classic.md", `${PLUGIN_SCOPE}.md`]);
    expect(selected.stdout).toContain("because they were changed after AI-DLC installed them; they stay switched off.");
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    expect(helpText(projectDir)).not.toMatch(/\bclassic\b/);
  });

  test("re-selecting the core plugin restores its scope files, classic and the shipped banner", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, PLUGIN);

    const withoutRelease = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--yes"]);
    expect(withoutRelease.status).not.toBe(0);
    expect(withoutRelease.stdout + withoutRelease.stderr).toContain(
      "no longer has core's scope files for",
    );
    expect(installedScopeFiles(projectDir)).toEqual([`${PLUGIN_SCOPE}.md`]);

    const restored = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", RELEASE, "--yes"]);
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);

    expect(installedScopeFiles(projectDir)).toEqual([...shippedCoreScopeFiles(), `${PLUGIN_SCOPE}.md`].sort());
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
    expect(settings(projectDir).companyAnnouncements).toEqual(shippedSettings().companyAnnouncements);
    expect(restored.stdout).not.toContain("kept your companyAnnouncements");
  });

  test("keeps a person's own default scope while the selection still enables it", () => {
    const projectDir = installedProject();
    setDefaultScope(projectDir, PLUGIN_SCOPE);
    selectPlugins(projectDir, `aidlc,${PLUGIN}`);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    expect(selected.stdout).not.toContain("AWS_AIDLC_DEFAULT_SCOPE");
  });

  test("keeps a person's own default scope the selection no longer enables, and says where workflows start", () => {
    const projectDir = installedProject();
    setDefaultScope(projectDir, "feature");

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe("feature");
    expect(selected.stdout).toContain(
      `AWS_AIDLC_DEFAULT_SCOPE in .claude/settings.json names "feature", which this plugin selection does not enable, so workflows start on "${PLUGIN_SCOPE}". To choose the default, run \`bun .claude/tools/aidlc.ts config flags --default-scope <scope> --yes\` with one of: ${PLUGIN_SCOPE}.`,
    );
    const resolved = resolvedDefaultScope(projectDir);
    expect(resolved.stdout).toBe(`scope=${PLUGIN_SCOPE}\n`);
  });

  test("keeps a scope the project saved, switched off with the rest of core", () => {
    const projectDir = installedProject();
    const savedScope = saveComposedScope(projectDir);

    selectPlugins(projectDir, PLUGIN);

    expect(installedScopeFiles(projectDir)).toEqual([`aidlc-${savedScope}.md`, `${PLUGIN_SCOPE}.md`].sort());
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    expect(helpText(projectDir)).not.toContain(`  ${savedScope} `);
  });

  test("help lists and exemplifies only the selection's scopes", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, PLUGIN);

    const help = helpText(projectDir);

    expect(help).toContain(`  ${PLUGIN_SCOPE}`);
    expect(help).toContain(`--scope ${PLUGIN_SCOPE} --depth comprehensive`);
    expect(help).toContain(`--phase construction --scope ${PLUGIN_SCOPE} Jump to construction`);
    expect(help).not.toMatch(/\b(classic|feature|bugfix)\b/);
  });

  test("a copied project with no release record keeps core's scope files it cannot prove are the release's", () => {
    const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-copy-"));
    temporary.push(root);
    const projectDir = composePluginFixture({
      plugin: PLUGIN,
      harness: "claude",
      projectDir: join(root, "project"),
      pluginBuilt,
    }).projectDir;
    const current = settings(projectDir) as Partial<ClaudeSettings>;
    delete current.companyAnnouncements;
    writeFileSync(settingsPath(projectDir), `${JSON.stringify(current, null, 2)}\n`);

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(installedScopeFiles(projectDir)).toEqual([...shippedCoreScopeFiles(), `${PLUGIN_SCOPE}.md`].sort());
    expect(selected.stdout).toContain("because no release record shows AI-DLC shipped them; they stay switched off.");
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
  });

  test("a copied project with no release record names the banner it keeps, and gives classic back when core is selected again", () => {
    const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-copy-banner-"));
    temporary.push(root);
    const projectDir = composePluginFixture({
      plugin: PLUGIN,
      harness: "claude",
      projectDir: join(root, "project"),
      pluginBuilt,
    }).projectDir;
    const banner = settings(projectDir).companyAnnouncements;

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    expect(settings(projectDir).companyAnnouncements).toEqual(banner);
    expect(selected.stdout).toContain(
      "companyAnnouncements in .claude/settings.json has no release record showing AI-DLC wrote it, so it was kept and may list scopes this plugin selection leaves out.",
    );

    const reselected = selectPlugins(projectDir, `aidlc,${PLUGIN}`);

    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
    expect(reselected.stdout).not.toContain("AWS_AIDLC_DEFAULT_SCOPE");
  });

  test("applies a selection after the person deletes the banner key from a recorded install", () => {
    const projectDir = installedProject();
    const current = settings(projectDir) as Partial<ClaudeSettings>;
    delete current.companyAnnouncements;
    writeFileSync(settingsPath(projectDir), `${JSON.stringify(current, null, 2)}\n`);

    selectPlugins(projectDir, PLUGIN);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);

    const restored = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", RELEASE, "--yes"]);
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
  });

  test("names a personal default that is no scope of this install, and the step that fixes it", () => {
    const projectDir = installedProject();
    setDefaultScope(projectDir, "featrue");

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe("featrue");
    expect(selected.stdout).toContain(
      `AWS_AIDLC_DEFAULT_SCOPE in .claude/settings.json names "featrue", which is not a scope in this install, so a workflow needs --scope.`,
    );
  });

  test("offers only the selection's scopes as the recorded default", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, PLUGIN);

    const refused = aidlc(projectDir, ["config", "flags", "--project", "--default-scope", "classic", "--yes"]);

    expect(refused.status).toBe(2);
    expect(refused.stdout).toContain(`--default-scope must be one of the enabled scopes: ${PLUGIN_SCOPE}`);
    expect(existsSync(join(projectDir, ".claude", "scopes", "aidlc-classic.md"))).toBe(false);
  });
});
