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
let codexPluginBuilt: string;

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-scopes-"));
  temporary.push(root);
  pluginBuilt = buildPluginProjection(PLUGIN, "claude", join(root, "plugin", "claude"));
  codexPluginBuilt = buildPluginProjection(PLUGIN, "codex", join(root, "plugin", "codex"));
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

function codexAidlc(projectDir: string, args: readonly string[]): CommandResult {
  const environment: NodeJS.ProcessEnv = { ...process.env, AIDLC_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: ".codex" };
  delete environment.AWS_AIDLC_DEFAULT_SCOPE;
  const result = spawnSync(BUN, [join(projectDir, ".codex", "tools", "aidlc.ts"), ...args], {
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

function leftOutScopeRecord(projectDir: string): readonly string[] | undefined {
  const manifest = JSON.parse(readFileSync(join(projectDir, ".claude", "tools", "data", "aidlc-manifest.json"), "utf-8")) as { leftOutScopeFiles?: string[] };
  return manifest.leftOutScopeFiles;
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

function utility(projectDir: string, args: readonly string[]): CommandResult {
  const result = spawnSync(BUN, [join(projectDir, ".claude", "tools", "aidlc-utility.ts"), ...args], {
    cwd: projectDir,
    encoding: "utf-8",
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: ".claude" },
  });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
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
    expect(selected.stdout).toContain(
      "config project --plugins all --download --yes` puts them back. With the release files at hand, pass --from <release> instead of --download.",
    );
    const leftOut = shippedCoreScopeFiles().map((file) => `.claude/scopes/${file}`);
    expect(leftOutScopeRecord(projectDir)).toEqual(leftOut);
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
    expect(leftOutScopeRecord(projectDir)).toEqual(leftOut);
    const unchanged = aidlc(projectDir, ["config", "project", "--plugins", PLUGIN, "--yes"]);
    expect(unchanged.stdout).toContain("project configuration unchanged");
    const flagged = aidlc(projectDir, ["config", "flags", "--project", "--default-scope", PLUGIN_SCOPE, "--yes"]);
    expect(flagged.status, flagged.stdout + flagged.stderr).toBe(0);
    expect(leftOutScopeRecord(projectDir)).toEqual(leftOut);
  });

  test("keeps a core scope file someone changed, switched off, and still applies the selection", () => {
    const projectDir = installedProject();
    const classic = join(projectDir, ".claude", "scopes", "aidlc-classic.md");
    writeFileSync(classic, `${readFileSync(classic, "utf-8")}\nOur own note.\n`);
    const bugfixRunner = join(projectDir, ".claude", "skills", "aidlc-bugfix", "SKILL.md");
    writeFileSync(bugfixRunner, readFileSync(bugfixRunner, "utf-8").replace("generated-by: aidlc-runner-gen", "generated-by: our-team"));
    const featureRunner = join(projectDir, ".claude", "skills", "aidlc-feature", "SKILL.md");
    writeFileSync(featureRunner, `${readFileSync(featureRunner, "utf-8")}\nOur own note.\n`);

    const selected = selectPlugins(projectDir, PLUGIN);

    expect(installedScopeFiles(projectDir)).toEqual(["aidlc-classic.md", `${PLUGIN_SCOPE}.md`]);
    expect(existsSync(bugfixRunner)).toBe(true);
    expect(existsSync(featureRunner)).toBe(false);
    expect(selected.stdout).toContain(
      "Kept 2 files that the plugin selection leaves out, because they were changed after AI-DLC installed them.",
    );
    const again = aidlc(projectDir, ["config", "project", "--plugins", PLUGIN, "--yes"]);
    expect(again.status, again.stdout + again.stderr).toBe(0);
    expect(again.stdout).toContain("because they were changed after AI-DLC installed them.");
    expect(again.stdout).not.toContain("no release record shows AI-DLC shipped");
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);
    expect(helpText(projectDir)).not.toMatch(/\bclassic\b/);

    const forced = aidlc(projectDir, ["config", "--from", RELEASE, "--force", "--yes"]);
    expect(forced.status, forced.stdout + forced.stderr).toBe(0);
    expect(existsSync(classic)).toBe(true);

    const withoutRelease = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--yes"]);
    expect(withoutRelease.status).not.toBe(0);
    expect(withoutRelease.stdout + withoutRelease.stderr).toContain("can only get back what its plugin selection left out from the release files for");

    const fromRelease = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", RELEASE, "--yes"]);
    expect(fromRelease.status).toBe(4);
    expect(fromRelease.stdout + fromRelease.stderr).toContain("config conflict(s): .claude/scopes/aidlc-classic.md (locally modified or unowned)");
    expect(readFileSync(classic, "utf-8")).toContain("Our own note.");
  });

  test("keeps a file the person added inside a runner skill folder the selection leaves out", () => {
    const recorded = installedProject();
    const copiedRoot = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-copy-notes-"));
    temporary.push(copiedRoot);
    const copied = composePluginFixture({ plugin: PLUGIN, harness: "claude", projectDir: join(copiedRoot, "project"), pluginBuilt }).projectDir;

    for (const projectDir of [recorded, copied]) {
      const notes = join(projectDir, ".claude", "skills", "aidlc-bugfix", "our-triage-notes.md");
      writeFileSync(notes, "# Our team's bugfix triage notes\n");

      const selected = selectPlugins(projectDir, PLUGIN);

      expect(existsSync(join(projectDir, ".claude", "skills", "aidlc-bugfix", "SKILL.md"))).toBe(false);
      expect(readFileSync(notes, "utf-8")).toBe("# Our team's bugfix triage notes\n");
      expect(selected.stdout).not.toContain("our-triage-notes.md");
    }
  });

  test("re-selecting core clears the record of left-out scope files, so later choices never need the release", () => {
    const projectDir = installedProject();
    const own = join(projectDir, ".claude", "scopes", "team-hotfix.md");
    writeFileSync(own, readFileSync(join(projectDir, ".claude", "scopes", "aidlc-bugfix.md"), "utf-8").replace("name: bugfix", "name: team-hotfix").replace(/keywords:[\s\S]*?description:/, "keywords:\n  - teamhot\ndescription:"));
    selectPlugins(projectDir, PLUGIN);
    rmSync(own);

    const restored = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", RELEASE, "--yes"]);
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(join(projectDir, ".claude", "tools", "data", "aidlc-manifest.json"), "utf-8")) as { leftOutScopeFiles?: string[] };
    expect(manifest.leftOutScopeFiles).toBeUndefined();

    const unrelated = aidlc(projectDir, ["config", "project", "--completions", "bash", "--yes"]);
    expect(unrelated.status, unrelated.stdout + unrelated.stderr).toBe(0);
    const again = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--yes"]);
    expect(again.status, again.stdout + again.stderr).toBe(0);
  });

  test("on Codex a runner folder goes whole with its sidecars, an edited sidecar never blocks, and re-selecting core restores them", () => {
    const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-codex-"));
    temporary.push(root);
    const projectDir = composePluginFixture({ plugin: PLUGIN, harness: "codex", projectDir: join(root, "project"), pluginBuilt: codexPluginBuilt }).projectDir;
    const codexRelease = join(REPO_ROOT, "dist", "codex");
    const recorded = codexAidlc(projectDir, ["config", "--from", codexRelease, "--force", "--yes"]);
    expect(recorded.status, recorded.stdout + recorded.stderr).toBe(0);
    const runner = join(projectDir, ".agents", "skills", "aidlc-bugfix");
    const sidecar = join(runner, "agents", "openai.yaml");
    writeFileSync(sidecar, `${readFileSync(sidecar, "utf-8")}# team note\n`);

    const selected = codexAidlc(projectDir, ["config", "project", "--plugins", PLUGIN, "--yes"]);

    expect(selected.status, selected.stdout + selected.stderr).toBe(0);
    expect(existsSync(join(runner, "SKILL.md"))).toBe(false);
    expect(existsSync(sidecar)).toBe(false);
    expect(selected.stdout).toContain(".agents/skills/aidlc-bugfix/agents/openai.yaml");
    expect(readdirSync(join(projectDir, ".codex", "scopes")).filter((name) => name.endsWith(".md"))).toEqual([`${PLUGIN_SCOPE}.md`]);

    const restored = codexAidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", codexRelease, "--yes"]);
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
    expect(existsSync(join(runner, "SKILL.md"))).toBe(true);
    expect(existsSync(sidecar)).toBe(true);
    expect(readdirSync(join(projectDir, ".codex", "scopes")).filter((name) => name.startsWith("aidlc-")).sort()).toEqual(shippedCoreScopeFiles());
  });

  test("the step plugin select prints settles the default and record even when every left-out file was kept", () => {
    const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-copy-finish-"));
    temporary.push(root);
    const projectDir = composePluginFixture({ plugin: PLUGIN, harness: "claude", projectDir: join(root, "project"), pluginBuilt }).projectDir;
    selectPlugins(projectDir, PLUGIN);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);

    const on = utility(projectDir, ["select-plugins", `aidlc,${PLUGIN}`]);
    expect(on.stdout).toContain(`config project --plugins aidlc,${PLUGIN} --yes\` to finish: it sets the default scope and start-up banner for this selection.`);
    const finished = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--yes"]);

    expect(finished.status, finished.stdout + finished.stderr).toBe(0);
    expect(finished.stdout).not.toContain("project configuration unchanged");
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
    expect(leftOutScopeRecord(projectDir)).toBeUndefined();
  });

  test("re-selecting core on a copied project whose banner the selection rewrote takes the stock banner from the release", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, PLUGIN);
    for (const file of shippedCoreScopeFiles()) {
      writeFileSync(join(projectDir, ".claude", "scopes", file), readFileSync(join(RELEASE, ".claude", "scopes", file)));
    }

    const withoutRelease = aidlc(projectDir, ["config", "project", "--plugins", "all", "--yes"]);
    expect(withoutRelease.status).not.toBe(0);
    expect(withoutRelease.stdout + withoutRelease.stderr).toContain("can only get back what its plugin selection left out from the release files for");

    const restored = aidlc(projectDir, ["config", "project", "--plugins", "all", "--from", RELEASE, "--yes"]);
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
    expect(settings(projectDir).companyAnnouncements).toEqual(shippedSettings().companyAnnouncements);
    const again = aidlc(projectDir, ["config", "project", "--plugins", "all", "--yes"]);
    expect(again.stdout).toContain("project configuration unchanged");
  });

  test("a scope file the person deleted while core is on never makes a project choice need the release", () => {
    const projectDir = installedProject();
    rmSync(join(projectDir, ".claude", "scopes", "aidlc-security-patch.md"));

    const chosen = aidlc(projectDir, ["config", "project", "--completions", "bash", "--yes"]);

    expect(chosen.status, chosen.stdout + chosen.stderr).toBe(0);
    expect(chosen.stdout + chosen.stderr).not.toContain("needs the release files");
    const unchanged = aidlc(projectDir, ["config", "project", "--completions", "bash", "--yes"]);
    expect(unchanged.stdout).toContain("project configuration unchanged");
  });

  test("the step plugin select prints finishes the change after a recorded selection", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, `aidlc,${PLUGIN}`);

    const off = utility(projectDir, ["select-plugins", PLUGIN]);
    expect(off.stdout).toContain(`config project --plugins ${PLUGIN} --yes\` to finish: it removes core's scope files`);
    selectPlugins(projectDir, PLUGIN);
    expect(installedScopeFiles(projectDir)).toEqual([`${PLUGIN_SCOPE}.md`]);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);

    const on = utility(projectDir, ["select-plugins", `aidlc,${PLUGIN}`]);
    expect(on.stdout).toContain(`config project --plugins aidlc,${PLUGIN} --download --yes\` to finish: what your plugin selection left out can only come back from the release`);
    expect(on.stdout).toContain("pass --from <release> instead of --download.");
    const finishedOn = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", RELEASE, "--yes"]);
    expect(finishedOn.status, finishedOn.stdout + finishedOn.stderr).toBe(0);
    expect(installedScopeFiles(projectDir)).toEqual([...shippedCoreScopeFiles(), `${PLUGIN_SCOPE}.md`].sort());
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
  });

  test("refuses a scope the selection leaves out when a workflow names it", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, PLUGIN);

    const graph = (scope: string): CommandResult => {
      const result = spawnSync(BUN, [join(projectDir, ".claude", "tools", "aidlc-graph.ts"), "scope", scope], {
        cwd: projectDir,
        encoding: "utf-8",
        timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: ".claude" },
      });
      return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    };

    const refused = graph("bugfix");
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain(`Unknown scope: "bugfix". Valid scopes: ${PLUGIN_SCOPE}`);
    expect(graph(PLUGIN_SCOPE).status).toBe(0);
  });

  test("leaving a plugin out while core stays removes the plugin's runner skills as left out by the selection", () => {
    const projectDir = installedProject();
    const pluginRunner = join(projectDir, ".claude", "skills", PLUGIN_SCOPE, "SKILL.md");
    expect(existsSync(pluginRunner)).toBe(true);

    const selected = aidlc(projectDir, ["config", "project", "--plugins", "aidlc", "--from", RELEASE, "--yes"]);

    expect(selected.status, selected.stdout + selected.stderr).toBe(0);
    expect(existsSync(pluginRunner)).toBe(false);
    expect(selected.stdout).toContain("that the plugin selection leaves out:");
    expect(selected.stdout).toContain(
      "config project --plugins all --yes` puts them back.",
    );
    expect(selected.stdout).not.toContain("no release record shows AI-DLC shipped");
    expect(installedScopeFiles(projectDir)).toContain("aidlc-classic.md");
  });

  test("re-selecting the core plugin restores its scope files, classic and the shipped banner", () => {
    const projectDir = installedProject();
    selectPlugins(projectDir, PLUGIN);

    const withoutRelease = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--yes"]);
    expect(withoutRelease.status).not.toBe(0);
    expect(withoutRelease.stdout + withoutRelease.stderr).toContain(
      "can only get back what its plugin selection left out from the release files for",
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
      `AWS_AIDLC_DEFAULT_SCOPE in .claude/settings.json names "feature", which this plugin selection does not enable, so workflows start on "${PLUGIN_SCOPE}". To choose the default, run \`bun .claude/tools/aidlc.ts config flags --project --default-scope <scope> --yes\` with one of: ${PLUGIN_SCOPE}.`,
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
    expect(selected.stdout).toContain(
      `Kept ${shippedCoreScopeFiles().length} files that the plugin selection leaves out, because no release record shows AI-DLC shipped them.`,
    );
    expect(existsSync(join(projectDir, ".claude", "skills", "aidlc-bugfix", "SKILL.md"))).toBe(false);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(PLUGIN_SCOPE);

    selectPlugins(projectDir, `aidlc,${PLUGIN}`);

    expect(existsSync(join(projectDir, ".claude", "skills", "aidlc-bugfix", "SKILL.md"))).toBe(true);
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
  });

  test("a copied project whose kept core scope files the person deleted fetches the release to restore them", () => {
    const root = mkdtempSync(join(tmpdir(), "aidlc-plugin-only-copy-deleted-"));
    temporary.push(root);
    const projectDir = composePluginFixture({ plugin: PLUGIN, harness: "claude", projectDir: join(root, "project"), pluginBuilt }).projectDir;
    selectPlugins(projectDir, PLUGIN);
    for (const file of shippedCoreScopeFiles()) rmSync(join(projectDir, ".claude", "scopes", file));

    const withoutRelease = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--yes"]);
    expect(withoutRelease.status).not.toBe(0);
    expect(withoutRelease.stdout + withoutRelease.stderr).toContain("can only get back what its plugin selection left out from the release files for");

    const restored = aidlc(projectDir, ["config", "project", "--plugins", `aidlc,${PLUGIN}`, "--from", RELEASE, "--yes"]);
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
    expect(installedScopeFiles(projectDir)).toEqual([...shippedCoreScopeFiles(), `${PLUGIN_SCOPE}.md`].sort());
    expect(settings(projectDir).env.AWS_AIDLC_DEFAULT_SCOPE).toBe(shippedSettings().env.AWS_AIDLC_DEFAULT_SCOPE);
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
