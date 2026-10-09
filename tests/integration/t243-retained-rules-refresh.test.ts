// covers: tool:aidlc-init, file:core/tools/aidlc-refresh-rules.ts
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { sha256File, walkFiles } from "../../core/tools/aidlc-distribution.ts";
import { hermeticGitEnvironment } from "../../plugins/rin/tools/hermetic-git/index.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ownedRoots = new Set<string>();
afterEach(() => {
  [...ownedRoots].forEach((root) => { rmSync(root, { recursive: true, force: true }); });
  ownedRoots.clear();
});
type Harness = { readonly distribution: "claude" | "codex"; readonly harnessDir: ".claude" | ".codex"; readonly skillsDir: ".claude/skills" | ".agents/skills" };
const harnesses: readonly Harness[] = [
  { distribution: "claude", harnessDir: ".claude", skillsDir: ".claude/skills" },
  { distribution: "codex", harnessDir: ".codex", skillsDir: ".agents/skills" },
];
const memory = "aidlc/spaces/default/memory";
const put = (args: { readonly root: string; readonly path: string; readonly text: string }): void => {
  mkdirSync(dirname(join(args.root, args.path)), { recursive: true });
  writeFileSync(join(args.root, args.path), args.text);
};
// biome-ignore lint/suspicious/noExportsInTest: CD-7a requires exported owned fixture types.
export type RetainedRuleFixture = Harness & {
  readonly root: string;
  readonly projectDir: string;
  readonly sourceRoot: string;
  readonly newerRoot: string;
  readonly payload: string;
  readonly original: string;
  readonly env: Readonly<Record<string, string | undefined>>;
};
const fixture = (harness: Harness): RetainedRuleFixture => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-retained-rules-"));
  ownedRoots.add(root);
  const projectDir = join(root, "project");
  const sourceRoot = join(root, "source");
  const newerRoot = join(root, "newer");
  const home = join(root, "home");
  mkdirSync(join(projectDir, ".git"), { recursive: true });
  mkdirSync(home);
  cpSync(join(repositoryRoot, "dist-release", harness.distribution), sourceRoot, { recursive: true });
  rmSync(join(sourceRoot, memory, "team.md"));
  rmSync(join(sourceRoot, memory, "project.md"));
  cpSync(sourceRoot, newerRoot, { recursive: true });
  const payload = `${harness.harnessDir}/tools/aidlc-command.ts`;
  const original = readFileSync(join(sourceRoot, payload), "utf8");
  put({ root: newerRoot, path: payload, text: `${original}\n// compatible payload update\n` });
  const env = {
    ...hermeticGitEnvironment({ configHome: home, ambient: { PATH: process.env.PATH } }),
    AIDLC_INSTALL_ROOT: join(root, "machine"), AIDLC_BIN_DIR: join(root, "bin"),
    XDG_CONFIG_HOME: join(home, "config"), XDG_CACHE_HOME: join(home, "cache"),
    AIDLC_PROJECT_DIR: projectDir, CLAUDE_PROJECT_DIR: projectDir,
    AIDLC_HARNESS_DIR: harness.harnessDir, AIDLC_HARNESS_NAME: harness.distribution,
  };
  return { ...harness, root, projectDir, sourceRoot, newerRoot, payload, original, env };
};
const config = (args: { readonly fixture: RetainedRuleFixture; readonly source: string; readonly flags?: readonly string[] }) => {
  const f = args.fixture;
  const result = spawnSync(process.execPath, [
    join(repositoryRoot, "core/tools/aidlc-init.ts"), "config", "--project-dir", f.projectDir,
    "--from", args.source, "--json", "--yes", ...(args.flags ?? []),
  ], { cwd: f.projectDir, env: f.env, encoding: "utf8", timeout: 60_000 });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr };
};
const addPrivateRulesAndWorkflows = (f: RetainedRuleFixture): void => {
  put({ root: f.projectDir, path: `${memory}/team.md`, text: "# Private team\r\n\nRetain this team practice.\r\n" });
  put({ root: f.projectDir, path: `${memory}/project.md`, text: "# Private project\n\nRetain this project practice.\n" });
  put({ root: f.projectDir, path: `${memory}/phases/construction.md`, text: "# Private construction\n\nRetain this phase practice.\n" });
  put({ root: f.projectDir, path: "aidlc/spaces/default/intents/open/aidlc-state.md",
    text: "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n" });
  put({ root: f.projectDir, path: "aidlc/spaces/default/intents/open/audit.md", text: "Existing open audit.\n" });
  put({ root: f.projectDir, path: "aidlc/spaces/other/intents/parked/aidlc-state.md",
    text: "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n- **Parked**: independent work\n" });
  put({ root: f.projectDir, path: "aidlc/spaces/other/intents/parked/audit.md", text: "Existing parked audit.\n" });
};
const workspaceBytes = (f: RetainedRuleFixture): Readonly<Record<string, string>> => {
  const root = join(f.projectDir, "aidlc");
  return Object.fromEntries(walkFiles(root).map((path) => [path, sha256File(join(root, path))]));
};
const stageSchema = z.array(z.object({
  slug: z.string(), phase: z.string(),
  rules_in_context: z.array(z.object({ path: z.string(), scope: z.string() })),
}));
const rulesFor = (args: { readonly fixture: RetainedRuleFixture; readonly slug: string }) =>
  stageSchema.parse(JSON.parse(readFileSync(join(args.fixture.projectDir, args.fixture.harnessDir, "tools/data/stage-graph.json"), "utf8")))
    .find((stage) => stage.slug === args.slug)?.rules_in_context;
const allStagesRetainPrivateLayers = (f: RetainedRuleFixture): boolean =>
  stageSchema.parse(JSON.parse(readFileSync(join(f.projectDir, f.harnessDir, "tools/data/stage-graph.json"), "utf8")))
    .every((stage) => stage.rules_in_context.some((rule) => rule.path === `${memory}/team.md` && rule.scope === "team")
      && stage.rules_in_context.some((rule) => rule.path === `${memory}/project.md` && rule.scope === "project"));
const runnerText = (f: RetainedRuleFixture): string =>
  readFileSync(join(f.projectDir, f.skillsDir, "aidlc-code-generation/SKILL.md"), "utf8");
const dryRunSchema = z.object({ data: z.object({ planToken: z.string().min(1) }) });

describe("each harness refresh compiles from its own retained private rules", () => {
  test.each([...harnesses])("$distribution preserves full chains, runners and workspace on refresh and restore", (harness) => {
    const f = fixture(harness);
    const installed = config({ fixture: f, source: f.sourceRoot });
    expect(installed.status, installed.output).toBe(0);
    addPrivateRulesAndWorkflows(f);
    const before = workspaceBytes(f);
    const refreshed = config({ fixture: f, source: f.newerRoot, flags: ["--refresh-open-workflows"] });
    expect(refreshed.status, refreshed.output).toBe(0);
    expect(allStagesRetainPrivateLayers(f)).toBe(true);
    expect(rulesFor({ fixture: f, slug: "workspace-scaffold" })).toEqual([
      { path: "aidlc/spaces/default/memory/org.md", scope: "org" },
      { path: "aidlc/spaces/default/memory/team.md", scope: "team" },
      { path: "aidlc/spaces/default/memory/project.md", scope: "project" },
    ]);
    expect(rulesFor({ fixture: f, slug: "code-generation" })).toEqual([
      { path: "aidlc/spaces/default/memory/org.md", scope: "org" },
      { path: "aidlc/spaces/default/memory/team.md", scope: "team" },
      { path: "aidlc/spaces/default/memory/project.md", scope: "project" },
      { path: "aidlc/spaces/default/memory/phases/construction.md", scope: "phase" },
    ]);
    expect(runnerText(f)).toContain("directive.rules_content");
    expect(runnerText(f)).toContain("load-steering");
    expect(readFileSync(join(f.projectDir, f.payload), "utf8")).toContain("compatible payload update");
    expect(workspaceBytes(f)).toEqual(before);
    const restored = config({ fixture: f, source: f.sourceRoot, flags: ["--refresh-open-workflows"] });
    expect(restored.status, restored.output).toBe(0);
    expect(allStagesRetainPrivateLayers(f)).toBe(true);
    expect(readFileSync(join(f.projectDir, f.payload), "utf8")).toBe(f.original);
    expect(workspaceBytes(f)).toEqual(before);
  }, 60_000);
  test.each([...harnesses])("$distribution plan token binds private rule bytes even when graph references stay identical", (harness) => {
    const f = fixture(harness);
    const installed = config({ fixture: f, source: f.sourceRoot });
    expect(installed.status, installed.output).toBe(0);
    addPrivateRulesAndWorkflows(f);
    const dryRun = config({ fixture: f, source: f.newerRoot, flags: ["--refresh-open-workflows", "--dry-run"] });
    expect(dryRun.status, dryRun.output).toBe(0);
    const plan = dryRunSchema.parse(JSON.parse(dryRun.stdout));
    put({ root: f.projectDir, path: `${memory}/team.md`, text: "# Edited team after approval\n" });
    const refused = config({ fixture: f, source: f.newerRoot,
      flags: ["--refresh-open-workflows", "--plan-token", plan.data.planToken] });
    expect(refused.status).toBe(4);
    expect(refused.output).toContain("plan");
    expect(readFileSync(join(f.projectDir, f.payload), "utf8")).toBe(f.original);
    expect(readFileSync(join(f.projectDir, memory, "team.md"), "utf8")).toBe("# Edited team after approval\n");
    expect(readFileSync(join(f.projectDir, "aidlc/spaces/default/intents/open/audit.md"), "utf8")).toBe("Existing open audit.\n");
    expect(readFileSync(join(f.projectDir, "aidlc/spaces/other/intents/parked/audit.md"), "utf8")).toBe("Existing parked audit.\n");
  }, 60_000);
});
