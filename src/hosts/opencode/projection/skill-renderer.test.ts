import { expect, mock, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { source, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import { sessionSkillFixture, skillRenderingInputsFixture } from "../../../projection/fixtures/skill-rendering.fixture.ts";
import { createOpenCodeSkillRenderer } from "./skill-renderer.ts";

const files: readonly AuthoredHostFile[] = [
  { source: source("skills/aidlc/SKILL.md"), content: { kind: "text", text: "Door\n" } },
  { source: source("skills/aidlc/question-rendering.md"), content: { kind: "text", text: "Question\n" } },
  { source: source("skills/aidlc/composer.md"), content: { kind: "text", text: "Composer\n" } },
  { source: source("skills/aidlc/tables.md"), content: { kind: "text", text: "Tables\r\n" } },
];
const tokens = { ["HARNESS_DIR"]: ".aidlc", ["INVOKE"]: "aidlc", ["SKILL_INVOKE"]: null,
  ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "trusted", ["OPTION_LETTERS"]: "A-D" } as const;
const prepare = (file: AuthoredHostFile) => accepted(file);

test("OpenCode places captured documents with authored provenance and the existing earlier-release tail", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => accepted("Unused"));
  const renderer = createOpenCodeSkillRenderer({ files, prepare, tokens, tables });
  expect(accept(renderer.renderOrchestratorSkill({ method: methodSliceFixture }))).toEqual([
    { path: path(".aidlc/skills/aidlc/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Door\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".aidlc/skills/aidlc/question-rendering.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Question\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".aidlc/skills/aidlc/composer.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Composer\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".aidlc/skills/aidlc/tables.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Tables\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
  ]);
  expect(tables.mock.calls).toEqual([["stage-table"], ["scope-table"]]);
});

test("a missing authored document names the actual source rather than another skill", () => {
  expect(createOpenCodeSkillRenderer({ files: [], prepare, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured.",
    }));
});

test("recursive session files preserve binary payloads and neutral provenance", () => {
  const renderer = createOpenCodeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") });
  expect(renderer.renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/nested/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
    { source: source("skills/example/run.ts"), content: { kind: "text",
      text: "{{INVOKE}}|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}" } },
    { source: source("skills/example/SKILL.md"), content: { kind: "text", text: "{{HARNESS_DIR}} {{OPTION_LETTERS}}" } },
  ] } })).toEqual(accepted([
    { path: path(".aidlc/skills/example/nested/icon.bin"), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
      origin: { kind: "neutral", source: source("skills/example/nested/icon.bin") } },
    { path: path(".aidlc/skills/example/run.ts"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("aidlc|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|aidlc |trusted") },
      origin: { kind: "neutral", source: source("skills/example/run.ts") } },
    { path: path(".aidlc/skills/example/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode(".aidlc A-D") },
      origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
  ]));
});

test("a source from another skill is refused rather than placed into this session skill", () => {
  expect(createOpenCodeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [
      { source: source("skills/other/SKILL.md"), content: { kind: "text", text: "Wrong skill" } },
    ] } })).toEqual(refused({ kind: "render-failed", concept: "session-skill", name: "example",
      reason: "The source is outside its session skill." }));
});

test("a whole formatter failure names tables.md rather than the first authored door", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => refused("Scope mapping unavailable"));
  expect(createOpenCodeSkillRenderer({ files, prepare, tokens, tables })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/tables.md",
      reason: "Scope mapping unavailable",
    }));
  expect(tables.mock.calls).toEqual([["stage-table"]]);
});

test("non-template text sidecars stay literal through the shared writer's byte path", () => {
  expect(createOpenCodeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [{
      source: source("skills/example/reference.txt"),
      content: { kind: "text", text: "{{INVOKE}}" },
    }] } })).toEqual(accepted([{
      path: path(".aidlc/skills/example/reference.txt"), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      origin: { kind: "neutral", source: source("skills/example/reference.txt") },
    }]));
});

test("OpenCode projects the shared recursive session fixture without changing opaque sidecars", () => {
  expect(createOpenCodeSkillRenderer(skillRenderingInputsFixture({ harnessDir: ".aidlc" }))
    .renderSessionSkill({ skill: sessionSkillFixture })).toEqual(accepted([
    { path: path(".aidlc/skills/aidlc-issue-report/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("---\nname: aidlc-issue-report\n---\n\nRun /aidlc-issue-report, then read `.aidlc/rules/aidlc.md` and `<record>/aidlc-state.md`.\n") },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/SKILL.md") } },
    { path: path(".aidlc/skills/aidlc-issue-report/scripts/collect.ts"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode('const invoke = "bun .aidlc/tools/aidlc.ts";\nconst harnessDir = "{{HARNESS_DIR}}";\n') },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/scripts/collect.ts") } },
    { path: path(".aidlc/skills/aidlc-issue-report/references/data.yaml"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("invoke: {{INVOKE}}\n") },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/references/data.yaml") } },
    { path: path(".aidlc/skills/aidlc-issue-report/assets/mark.png"), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([137, 80, 78, 71]) },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/assets/mark.png") } },
  ]));
});

test("OpenCode binds native tokens in JSON, TOML and hook files and preserves Markdown BOMs", () => {
  expect(createOpenCodeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [
      { source: source("skills/example/config.json"), content: { kind: "text", text: "{{HARNESS_DIR}} {{INVOKE}} {{OPTION_LETTERS}}" } },
      { source: source("skills/example/config.toml"), content: { kind: "text", text: "{{TOOL_PREFIX}} {{TRUSTED_NAMESPACE}}" } },
      { source: source("skills/example/check.hook"), content: { kind: "text", text: "{{INVOKE}}" } },
      { source: source("skills/example/SKILL.md"), content: { kind: "bytes", bytes: new Uint8Array([239, 187, 191, 47, 97, 105, 100, 108, 99]) } },
    ] } })).toEqual(accepted([
    { path: path(".aidlc/skills/example/config.json"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode(".aidlc aidlc A-D") },
      origin: { kind: "neutral", source: source("skills/example/config.json") } },
    { path: path(".aidlc/skills/example/config.toml"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("aidlc  trusted") },
      origin: { kind: "neutral", source: source("skills/example/config.toml") } },
    { path: path(".aidlc/skills/example/check.hook"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("aidlc") },
      origin: { kind: "neutral", source: source("skills/example/check.hook") } },
    { path: path(".aidlc/skills/example/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([239, 187, 191, 47, 97, 105, 100, 108, 99]) },
      origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
  ]));
});

test("OpenCode places the four authored documents with captured preparation, refreshed tables and the earlier-release tail", () => {
  expect(createOpenCodeSkillRenderer(skillRenderingInputsFixture({ harnessDir: ".aidlc" })).renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(accepted([
    { path: path(".aidlc/skills/aidlc/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("---\nname: aidlc\n---\n\nRun `{{INVOKE}} engine orchestrate next` and follow `{{HARNESS_DIR}}/aidlc-common/protocols/stage-protocol.md`.\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".aidlc/skills/aidlc/question-rendering.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Question rendering\n\nOffer the options {{OPTION_LETTERS}}.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".aidlc/skills/aidlc/composer.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Composer\n\nRead `{{HARNESS_DIR}}/rules/aidlc.md` before you run /aidlc-replay.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".aidlc/skills/aidlc/tables.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Tables\n\n| Scope | Stages |\n|---|---|\n| feature | 12 |\n\n| Stage | Phase |\n|---|---|\n| requirements-analysis | inception |\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
  ]));
});
