import { describe, expect, test } from "bun:test";
import { sha256Bytes } from "./aidlc-distribution.ts";
import {
  coreBaselinePaths,
  generatedSkillProseHash,
  type HostManifest,
  planSyncedHostManifest,
  type SyncedFile,
} from "./aidlc-host-manifest.ts";
import type { ProjectedPluginHookContributions } from "./aidlc-plugin-hook-registrations.ts";

const SKILL = ".claude/skills/aidlc/SKILL.md";
const STAGE = ".claude/aidlc-common/stages/inception/requirements.md";
const HOOKS = ".claude/settings.json";

function skillText(input: { readonly lead: string; readonly prose?: string }): string {
  return [
    "# AI-DLC",
    input.prose ?? "Orchestrate the workflow.",
    "<!-- BEGIN: compiled stage graph -->",
    `| gate | ${input.lead} |`,
    "<!-- END: compiled stage graph -->",
    "<!-- BEGIN: compiled scope grid -->",
    "| scope | full |",
    "<!-- END: compiled scope grid -->",
    "",
  ].join("\n");
}

function proseHash(content: string): string {
  const hash = generatedSkillProseHash({ content });
  if (hash === null) throw new Error("fixture skill has no compiled regions");
  return hash;
}

const recordedSkill = skillText({ lead: "rin-architect-agent" });
const syncedSkill = skillText({ lead: "aidlc-architect-agent" });
const recordedStage = "# Requirements\n";
const syncedStage = "# Requirements\n\n<!-- plugin contribution -->\n";

const manifest: HostManifest = {
  schemaVersion: 1,
  files: { [SKILL]: sha256Bytes(recordedSkill), [STAGE]: sha256Bytes(recordedStage), [HOOKS]: sha256Bytes("{}\n") },
  generatedSkillProseHashes: { [SKILL]: proseHash(recordedSkill) },
};

function synced(path: string, installed: string, staged: string): SyncedFile {
  return { path, installed: Buffer.from(installed), staged: Buffer.from(staged) };
}

describe("planSyncedHostManifest", () => {
  test.each([
    { name: "an owned skill whose tables sync rewrote", file: synced(SKILL, recordedSkill, syncedSkill) },
    { name: "a skill owned through its prose hash", file: synced(SKILL, skillText({ lead: "drifted-agent" }), syncedSkill) },
    { name: "an owned stage file sync contributed to", file: synced(STAGE, recordedStage, syncedStage) },
    { name: "an owned stage file checked out with CRLF", file: synced(STAGE, recordedStage.replaceAll("\n", "\r\n"), syncedStage) },
  ])("re-records $name", ({ file }) => {
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set([HOOKS]), files: [file] })).toEqual({
      kind: "planned",
      manifest: {
        ...manifest,
        files: { ...manifest.files, [file.path]: sha256Bytes(file.staged) },
        generatedSkillProseHashes: manifest.generatedSkillProseHashes,
      },
    });
  });

  test.each([
    { name: "a skill with a local prose edit", file: synced(SKILL, skillText({ lead: "rin-architect-agent", prose: "Local edit." }), syncedSkill) },
    { name: "a locally edited stage file", file: synced(STAGE, "# Local\n", syncedStage) },
    { name: "a core-baseline hook document", file: synced(HOOKS, "{}\n", "{\"hooks\":{}}\n") },
    { name: "a file sync left unchanged", file: synced(SKILL, recordedSkill, recordedSkill) },
  ])("keeps the record for $name", ({ file }) => {
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set([HOOKS]), files: [file] })).toEqual({ kind: "unchanged" });
  });

  test("a rewritten skill whose prose sync changed records the new prose hash", () => {
    const rewritten = skillText({ lead: "aidlc-architect-agent", prose: "Composed prose." });
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set(), files: [synced(SKILL, recordedSkill, rewritten)] }))
      .toMatchObject({ kind: "planned", manifest: { generatedSkillProseHashes: { [SKILL]: proseHash(rewritten) } } });
  });
});

function contributions(paths: readonly string[]): ProjectedPluginHookContributions {
  return {
    schemaVersion: 1,
    pluginName: "rin",
    harness: "codex",
    registrations: paths.map((path) => ({
      kind: "group",
      path,
      event: "PreToolUse",
      group: { matcher: "Bash", hooks: [{ type: "command", command: "bun .codex/tools/aidlc.ts engine adapter codex guard" }] },
    })),
  };
}

type BaselineCase = { readonly name: string; readonly registered: readonly string[]; readonly expected: string[] };

const baselineCases: BaselineCase[] = [
  { name: "a registered codex hooks document holds the trust seed", registered: [".codex/hooks.json"], expected: [".codex/hooks.json", ".codex/trust-seed.toml", ".codex/config.toml"] },
  { name: "without hook registrations only entries hold baselines", registered: [], expected: [".codex/config.toml"] },
];

describe("coreBaselinePaths", () => {
  test.each(baselineCases)("$name", ({ registered, expected }) => {
    const paths = coreBaselinePaths({
      harnessDir: ".codex",
      manifest: { ...manifest, entries: { ".codex/config.toml": {} } },
      hookContributions: registered.length > 0 ? [contributions(registered)] : [],
    });
    expect([...paths]).toEqual(expected);
  });
});
