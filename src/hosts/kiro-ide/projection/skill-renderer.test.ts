import { expect, mock, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { source, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import { sessionSkillFixture, skillRenderingInputsFixture } from "../../../projection/fixtures/skill-rendering.fixture.ts";
import { createKiroIdeSkillRenderer } from "./skill-renderer.ts";

const files: readonly AuthoredHostFile[] = [
  { source: source("skills/aidlc/SKILL.md"), content: { kind: "text", text: "Door\n" } },
  { source: source("skills/aidlc/question-rendering.md"), content: { kind: "text", text: "Question\n" } },
  { source: source("skills/aidlc/composer.md"), content: { kind: "text", text: "Composer\n" } },
  { source: source("skills/aidlc/tables.md"), content: { kind: "text", text: "Tables\r\n" } },
];
const tokens = { ["HARNESS_DIR"]: ".kiro", ["INVOKE"]: "aidlc", ["SKILL_INVOKE"]: null,
  ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "trusted", ["OPTION_LETTERS"]: "A-D" } as const;
const prepare = (file: AuthoredHostFile) => accepted(file);

test("Kiro IDE places captured documents with authored provenance and the existing earlier-release tail", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => accepted("Unused"));
  const renderer = createKiroIdeSkillRenderer({ files, prepare, tokens, tables });
  expect(accept(renderer.renderOrchestratorSkill({ method: methodSliceFixture }))).toEqual([
    { path: path(".kiro/skills/aidlc/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Door\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".kiro/skills/aidlc/question-rendering.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Question\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".kiro/skills/aidlc/composer.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Composer\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".kiro/skills/aidlc/tables.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Tables\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
  ]);
  expect(tables.mock.calls).toEqual([["stage-table"], ["scope-table"]]);
});

test("a missing authored document names the actual source rather than another skill", () => {
  expect(createKiroIdeSkillRenderer({ files: [], prepare, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured.",
    }));
});

test("recursive session files preserve binary payloads and neutral provenance", () => {
  const renderer = createKiroIdeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") });
  expect(renderer.renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/nested/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
    { source: source("skills/example/run.ts"), content: { kind: "text",
      text: "{{INVOKE}}|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}" } },
    { source: source("skills/example/SKILL.md"), content: { kind: "text", text: "{{HARNESS_DIR}} {{OPTION_LETTERS}}" } },
  ] } })).toEqual(accepted([
    { path: path(".kiro/skills/example/nested/icon.bin"), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
      origin: { kind: "neutral", source: source("skills/example/nested/icon.bin") } },
    { path: path(".kiro/skills/example/run.ts"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode("aidlc|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|aidlc |trusted") },
      origin: { kind: "neutral", source: source("skills/example/run.ts") } },
    { path: path(".kiro/skills/example/SKILL.md"), mode: "regular",
      content: { kind: "bytes", bytes: new TextEncoder().encode(".kiro A-D") },
      origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
  ]));
});

test("a source from another skill is refused rather than placed into this session skill", () => {
  expect(createKiroIdeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [
      { source: source("skills/other/SKILL.md"), content: { kind: "text", text: "Wrong skill" } },
    ] } })).toEqual(refused({ kind: "render-failed", concept: "session-skill", name: "example",
      reason: "The source is outside its session skill." }));
});

test("a whole formatter failure names tables.md rather than the first authored door", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => refused("Scope mapping unavailable"));
  expect(createKiroIdeSkillRenderer({ files, prepare, tokens, tables })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/tables.md",
      reason: "Scope mapping unavailable",
    }));
  expect(tables.mock.calls).toEqual([["stage-table"]]);
});

test("non-template text sidecars stay literal through the shared writer's byte path", () => {
  expect(createKiroIdeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [{
      source: source("skills/example/reference.txt"),
      content: { kind: "text", text: "{{INVOKE}}" },
    }] } })).toEqual(accepted([{
      path: path(".kiro/skills/example/reference.txt"), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      origin: { kind: "neutral", source: source("skills/example/reference.txt") },
    }]));
});

test("Kiro IDE markdown rewrites rule paths without changing native permissions or other formats", () => {
  expect(createKiroIdeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [
      { source: source("skills/example/SKILL.md"), content: { kind: "text",
        text: "{{HARNESS_DIR}}/rules/aidlc.md .kiro/rules/default.rules .kiro/rules/default.rules.old" } },
      { source: source("skills/example/data.json"), content: { kind: "text",
        text: "{{HARNESS_DIR}}/rules/aidlc.md {{OPTION_LETTERS}}" } },
    ] } })).toEqual(accepted([
      { path: path(".kiro/skills/example/SKILL.md"), mode: "regular",
        content: { kind: "bytes", bytes: new TextEncoder().encode(
          ".kiro/steering/aidlc.md .kiro/rules/default.rules .kiro/rules/default.rules.old") },
        origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
      { path: path(".kiro/skills/example/data.json"), mode: "regular",
        content: { kind: "bytes", bytes: new TextEncoder().encode(".kiro/rules/aidlc.md A-D") },
        origin: { kind: "neutral", source: source("skills/example/data.json") } },
    ]));
});
test("the shared session fixture keeps exact Kiro IDE payload bytes", () => {
  expect(createKiroIdeSkillRenderer(skillRenderingInputsFixture({ harnessDir: ".kiro" }))
    .renderSessionSkill({ skill: sessionSkillFixture })).toEqual(accepted([
      { path: path(".kiro/skills/aidlc-issue-report/SKILL.md"), mode: "regular",
        content: { kind: "bytes", bytes: new TextEncoder().encode(
          "---\nname: aidlc-issue-report\n---\n\nRun /aidlc-issue-report, then read `.kiro/steering/aidlc.md` and `<record>/aidlc-state.md`.\n") },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/SKILL.md") } },
      { path: path(".kiro/skills/aidlc-issue-report/scripts/collect.ts"), mode: "regular",
        content: { kind: "bytes", bytes: new TextEncoder().encode(
          'const invoke = "bun .kiro/tools/aidlc.ts";\nconst harnessDir = "{{HARNESS_DIR}}";\n') },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/scripts/collect.ts") } },
      { path: path(".kiro/skills/aidlc-issue-report/references/data.yaml"), mode: "regular",
        content: { kind: "bytes", bytes: new TextEncoder().encode("invoke: {{INVOKE}}\n") },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/references/data.yaml") } },
      { path: path(".kiro/skills/aidlc-issue-report/assets/mark.png"), mode: "regular",
        content: { kind: "bytes", bytes: new Uint8Array([137, 80, 78, 71]) },
        origin: { kind: "neutral", source: source("skills/aidlc-issue-report/assets/mark.png") } },
    ]));
});
test("authored preparation refusal survives the Kiro IDE renderer unchanged", () => {
  const refusal = refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: "skills/aidlc/SKILL.md", reason: "Authored input is unavailable." } as const);
  expect(createKiroIdeSkillRenderer({ files, prepare: () => refusal, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refusal);
});