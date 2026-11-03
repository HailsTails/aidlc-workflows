import { describe, expect, test } from "bun:test";
import { sha256Bytes } from "./aidlc-distribution.ts";
import {
  coreBaselinePaths,
  generatedSkillOwned,
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
  return generatedSkillProseHash({ content }) ?? "";
}

const recordedSkill = skillText({ lead: "rin-architect-agent" });
const syncedSkill = skillText({ lead: "aidlc-architect-agent" });
const composedSkill = skillText({ lead: "aidlc-architect-agent", prose: "Composed prose." });
const recordedStage = "# Requirements\n";
const syncedStage = "# Requirements\n\n<!-- plugin contribution -->\n";
const syncedSkillHash = sha256Bytes(syncedSkill);
const syncedStageHash = sha256Bytes(syncedStage);

const manifest: HostManifest = {
  schemaVersion: 1,
  files: { [SKILL]: sha256Bytes(recordedSkill), [STAGE]: sha256Bytes(recordedStage), [HOOKS]: sha256Bytes("{}\n") },
  generatedSkillProseHashes: { [SKILL]: proseHash(recordedSkill) },
};

function synced(input: { readonly path: string; readonly installed: string; readonly staged: string }): SyncedFile {
  return { path: input.path, installed: Buffer.from(input.installed), staged: Buffer.from(input.staged) };
}

describe("planSyncedHostManifest", () => {
  test.each([
    { name: "an owned skill whose tables sync rewrote", file: synced({ path: SKILL, installed: recordedSkill, staged: syncedSkill }), stagedHash: syncedSkillHash },
    { name: "a skill owned through its prose hash", file: synced({ path: SKILL, installed: skillText({ lead: "drifted-agent" }), staged: syncedSkill }), stagedHash: syncedSkillHash },
    { name: "an owned stage file sync contributed to", file: synced({ path: STAGE, installed: recordedStage, staged: syncedStage }), stagedHash: syncedStageHash },
    { name: "an owned stage file checked out with CRLF", file: synced({ path: STAGE, installed: recordedStage.replaceAll("\n", "\r\n"), staged: syncedStage }), stagedHash: syncedStageHash },
  ])("re-records $name", ({ file, stagedHash }) => {
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set([HOOKS]), files: [file] })).toEqual({
      kind: "planned",
      manifest: {
        ...manifest,
        files: { ...manifest.files, [file.path]: stagedHash },
        generatedSkillProseHashes: manifest.generatedSkillProseHashes,
      },
    });
  });

  test.each([
    { name: "a skill with a local prose edit", file: synced({ path: SKILL, installed: skillText({ lead: "rin-architect-agent", prose: "Local edit." }), staged: syncedSkill }) },
    { name: "a locally edited stage file", file: synced({ path: STAGE, installed: "# Local\n", staged: syncedStage }) },
    { name: "a core-baseline hook document", file: synced({ path: HOOKS, installed: "{}\n", staged: "{\"hooks\":{}}\n" }) },
    { name: "a file sync left unchanged", file: synced({ path: SKILL, installed: recordedSkill, staged: recordedSkill }) },
  ])("keeps the record for $name", ({ file }) => {
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set([HOOKS]), files: [file] })).toEqual({ kind: "unchanged" });
  });

  test("a rewritten skill whose prose sync changed records the new prose hash", () => {
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set(), files: [synced({ path: SKILL, installed: recordedSkill, staged: composedSkill })] })).toEqual({
      kind: "planned",
      manifest: { ...manifest, files: { ...manifest.files, [SKILL]: sha256Bytes(composedSkill) }, generatedSkillProseHashes: { [SKILL]: proseHash(composedSkill) } },
    });
  });

  test("a rewritten skill without compiled regions drops its prose hash", () => {
    const flattened = "# AI-DLC\nOrchestrate the workflow.\n";
    expect(planSyncedHostManifest({ manifest, coreBaselinePaths: new Set(), files: [synced({ path: SKILL, installed: recordedSkill, staged: flattened })] })).toEqual({
      kind: "planned",
      manifest: { ...manifest, files: { ...manifest.files, [SKILL]: sha256Bytes(flattened) }, generatedSkillProseHashes: {} },
    });
  });
});

describe("generatedSkillOwned", () => {
  test.each([
    { name: "the installed bytes match the record", equivalents: [], recorded: { hash: syncedSkillHash, proseHash: undefined }, owned: true },
    { name: "an equivalent form matches the record", equivalents: [recordedSkill], recorded: { hash: sha256Bytes(recordedSkill), proseHash: undefined }, owned: true },
    { name: "only the prose hash matches", equivalents: [], recorded: { hash: sha256Bytes(recordedSkill), proseHash: proseHash(syncedSkill) }, owned: true },
    { name: "nothing matches", equivalents: [], recorded: { hash: sha256Bytes(recordedSkill), proseHash: proseHash(composedSkill) }, owned: false },
  ])("$name: owned $owned", ({ equivalents, recorded, owned }) => {
    expect(generatedSkillOwned({ installed: syncedSkill, equivalents, recorded })).toBe(owned);
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

type BaselineCase = {
  readonly name: string;
  readonly hookContributions: readonly ProjectedPluginHookContributions[];
  readonly expected: ReadonlySet<string>;
};

const baselineCases: BaselineCase[] = [
  {
    name: "a registered codex hooks document holds the trust seed",
    hookContributions: [contributions([".codex/hooks.json"])],
    expected: new Set([".codex/hooks.json", ".codex/trust-seed.toml", ".codex/config.toml"]),
  },
  { name: "without hook registrations only entries hold baselines", hookContributions: [], expected: new Set([".codex/config.toml"]) },
];

describe("coreBaselinePaths", () => {
  test.each(baselineCases)("$name", ({ hookContributions, expected }) => {
    expect(coreBaselinePaths({
      harnessDir: ".codex",
      manifest: { ...manifest, entries: { ".codex/config.toml": {} } },
      hookContributions,
    })).toEqual(expected);
  });
});
