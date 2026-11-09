import { expect, mock, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { source, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import { sessionSkillFixture, skillRenderingInputsFixture } from "../../../projection/fixtures/skill-rendering.fixture.ts";
import { createCursorSkillRenderer } from "./skill-renderer.ts";

const files: readonly AuthoredHostFile[] = [
  { source: source("skills/aidlc/SKILL.md"), content: { kind: "text", text: "Door\n" } },
  { source: source("skills/aidlc/question-rendering.md"), content: { kind: "text", text: "Question\n" } },
  { source: source("skills/aidlc/composer.md"), content: { kind: "text", text: "Composer\n" } },
  { source: source("skills/aidlc/tables.md"), content: { kind: "text", text: "Tables\r\n" } },
];
const shortcutFiles: readonly AuthoredHostFile[] = [
  { source: source("skills/aidlc-status/SKILL.md"), content: { kind: "text", text: "Status\r\n" } },
  { source: source("skills/aidlc-jump/SKILL.md"), content: { kind: "text", text: "Jump\n" } },
  { source: source("skills/aidlc-scope/SKILL.md"), content: { kind: "text", text: "Scope\n" } },
];
const allFiles = [...files, ...shortcutFiles];
const tokens = { ["HARNESS_DIR"]: ".cursor", ["INVOKE"]: "aidlc", ["SKILL_INVOKE"]: null,
  ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "trusted", ["OPTION_LETTERS"]: "A-D" } as const;
const prepare = (file: AuthoredHostFile) => accepted(file);

test("Cursor places captured documents with authored provenance and the existing earlier-release tail", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => accepted("Unused"));
  const renderer = createCursorSkillRenderer({ files: allFiles, prepare, tokens, tables });
  expect(accept(renderer.renderOrchestratorSkill({ method: methodSliceFixture }))).toEqual([
    { path: path(".cursor/skills/aidlc/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Door\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".cursor/skills/aidlc/question-rendering.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Question\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".cursor/skills/aidlc/composer.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Composer\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".cursor/skills/aidlc/tables.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Tables\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
    { path: path(".cursor/skills/aidlc-status/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Status\r\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc-status/SKILL.md") } },
    { path: path(".cursor/skills/aidlc-jump/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Jump\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc-jump/SKILL.md") } },
    { path: path(".cursor/skills/aidlc-scope/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Scope\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc-scope/SKILL.md") } },
  ]);
  expect(tables.mock.calls).toEqual([["stage-table"], ["scope-table"]]);
});

test("a missing authored document names the actual source rather than another skill", () => {
  expect(createCursorSkillRenderer({ files: [], prepare, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured.",
    }));
});

test("recursive session files preserve binary payloads and neutral provenance", () => {
  const renderer = createCursorSkillRenderer({ files: allFiles, prepare, tokens, tables: () => accepted("") });
  expect(renderer.renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/nested/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
    { source: source("skills/example/run.ts"), content: { kind: "text",
      text: "{{INVOKE}}|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}" } },
    { source: source("skills/example/SKILL.md"), content: { kind: "text", text: "{{HARNESS_DIR}} {{OPTION_LETTERS}}" } },
  ] } })).toEqual(accepted([
    { path: path(".cursor/skills/example/nested/icon.bin"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
      origin: { kind: "neutral", source: source("skills/example/nested/icon.bin") } },
    { path: path(".cursor/skills/example/run.ts"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("aidlc|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|aidlc |trusted") },
      origin: { kind: "neutral", source: source("skills/example/run.ts") } },
    { path: path(".cursor/skills/example/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode(".cursor A-D") },
      origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
  ]));
});

test("a source from another skill is refused rather than placed into this session skill", () => {
  expect(createCursorSkillRenderer({ files: allFiles, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [
      { source: source("skills/other/SKILL.md"), content: { kind: "text", text: "Wrong skill" } },
    ] } })).toEqual(refused({ kind: "render-failed", concept: "session-skill", name: "example",
      reason: "The source is outside its session skill." }));
});

test("a whole formatter failure names tables.md rather than the first authored door", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => refused("Scope mapping unavailable"));
  expect(createCursorSkillRenderer({ files: allFiles, prepare, tokens, tables })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/tables.md",
      reason: "Scope mapping unavailable",
    }));
  expect(tables.mock.calls).toEqual([["stage-table"]]);
});

test("non-template text sidecars stay literal through the shared writer's byte path", () => {
  expect(createCursorSkillRenderer({ files: allFiles, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [{
      source: source("skills/example/reference.txt"),
      content: { kind: "text", text: "{{INVOKE}}" },
    }] } })).toEqual(accepted([{
      path: path(".cursor/skills/example/reference.txt"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      origin: { kind: "neutral", source: source("skills/example/reference.txt") },
    }]));
});

test("the shared session fixture keeps exact Cursor payload bytes", () => {
  expect(createCursorSkillRenderer(skillRenderingInputsFixture({ harnessDir: ".cursor" }))
    .renderSessionSkill({ skill: sessionSkillFixture })).toEqual(accepted([
      { path: path(".cursor/skills/aidlc-issue-report/SKILL.md"), mode: "regular", availability: "always",
        content: { kind: "bytes", bytes: new TextEncoder().encode(
          "---\nname: aidlc-issue-report\n---\n\nRun /aidlc-issue-report, then read `.cursor/rules/aidlc.md` and `<record>/aidlc-state.md`.\n") },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/SKILL.md") } },
      { path: path(".cursor/skills/aidlc-issue-report/scripts/collect.ts"), mode: "regular", availability: "always",
        content: { kind: "bytes", bytes: new TextEncoder().encode(
          'const invoke = "bun .cursor/tools/aidlc.ts";\nconst harnessDir = "{{HARNESS_DIR}}";\n') },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/scripts/collect.ts") } },
      { path: path(".cursor/skills/aidlc-issue-report/references/data.yaml"), mode: "regular", availability: "always",
        content: { kind: "bytes", bytes: new TextEncoder().encode("invoke: {{INVOKE}}\n") },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/references/data.yaml") } },
      { path: path(".cursor/skills/aidlc-issue-report/assets/mark.png"), mode: "regular", availability: "always",
        content: { kind: "bytes", bytes: new Uint8Array([137, 80, 78, 71]) },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/assets/mark.png") } },
    ]));
});
test("authored preparation refusal survives the Cursor renderer unchanged", () => {
  const refusal = refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: "skills/aidlc/SKILL.md", reason: "Authored input is unavailable." } as const);
  expect(createCursorSkillRenderer({ files: allFiles, prepare: () => refusal, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refusal);
});
test("a missing Cursor shortcut refuses its actual captured source", () => {
  expect(createCursorSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc-status/SKILL.md",
      reason: "The authored orchestrator document was not captured.",
    }));
});

test("Cursor shortcuts keep generated-looking regions and carriage returns without table or release transforms", () => {
  const shortcut = { source: source("skills/aidlc-status/SKILL.md"), content: { kind: "text" as const,
    text: "<!-- BEGIN: compiled stage graph via x -->\r\nstale\r\n<!-- END: compiled stage graph -->\r\n" } };
  const tables = mock<(verb: string) => Result<string, string>>(() => accepted("Fresh"));
  const renderer = createCursorSkillRenderer({ files: [shortcut, ...allFiles], prepare, tokens, tables });
  expect(accept(renderer.renderOrchestratorSkill({ method: methodSliceFixture }))[4]).toEqual({
    path: path(".cursor/skills/aidlc-status/SKILL.md"), mode: "regular", availability: "always",
    content: { kind: "bytes", bytes: new TextEncoder().encode(
      "<!-- BEGIN: compiled stage graph via x -->\r\nstale\r\n<!-- END: compiled stage graph -->\r\n") },
    origin: { kind: "harness-authored", source: source("skills/aidlc-status/SKILL.md") },
  });
  expect(tables.mock.calls).toEqual([["stage-table"], ["scope-table"]]);
});
