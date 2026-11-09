import { expect, mock, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { source, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import { createClaudeSkillRenderer } from "./skill-renderer.ts";

const files: readonly AuthoredHostFile[] = [
  { source: source("skills/aidlc/SKILL.md"), content: { kind: "text", text: "Door\n" } },
  { source: source("skills/aidlc/question-rendering.md"), content: { kind: "text", text: "Question\n" } },
  { source: source("skills/aidlc/composer.md"), content: { kind: "text", text: "Composer\n" } },
  { source: source("skills/aidlc/tables.md"), content: { kind: "text", text: "Tables\r\n" } },
];
const tokens = { ["HARNESS_DIR"]: ".claude", ["INVOKE"]: "aidlc", ["SKILL_INVOKE"]: null,
  ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "trusted", ["OPTION_LETTERS"]: "A-D" } as const;
const prepare = (file: AuthoredHostFile) => accepted(file);

test("Claude places captured documents with authored provenance and the existing earlier-release tail", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => accepted("Unused"));
  const renderer = createClaudeSkillRenderer({ files, prepare, tokens, tables });
  expect(accept(renderer.renderOrchestratorSkill({ method: methodSliceFixture }))).toEqual([
    { path: path(".claude/skills/aidlc/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Door\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".claude/skills/aidlc/question-rendering.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Question\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".claude/skills/aidlc/composer.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Composer\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".claude/skills/aidlc/tables.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Tables\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
  ]);
  expect(tables.mock.calls).toEqual([["stage-table"], ["scope-table"]]);
});

test("a missing authored document names the actual source rather than another skill", () => {
  expect(createClaudeSkillRenderer({ files: [], prepare, tokens, tables: () => accepted("") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured.",
    }));
});

test("recursive session files preserve binary payloads and neutral provenance", () => {
  const renderer = createClaudeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") });
  expect(renderer.renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/nested/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
    { source: source("skills/example/run.ts"), content: { kind: "text",
      text: "{{INVOKE}}|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}" } },
    { source: source("skills/example/SKILL.md"), content: { kind: "text", text: "{{HARNESS_DIR}} {{OPTION_LETTERS}}" } },
  ] } })).toEqual(accepted([
    { path: path(".claude/skills/example/nested/icon.bin"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
      origin: { kind: "neutral", source: source("skills/example/nested/icon.bin") } },
    { path: path(".claude/skills/example/run.ts"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("aidlc|{{HARNESS_DIR}}|{{OPTION_LETTERS}}|aidlc |trusted") },
      origin: { kind: "neutral", source: source("skills/example/run.ts") } },
    { path: path(".claude/skills/example/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode(".claude A-D") },
      origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
  ]));
});

test("a source from another skill is refused rather than placed into this session skill", () => {
  expect(createClaudeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [
      { source: source("skills/other/SKILL.md"), content: { kind: "text", text: "Wrong skill" } },
    ] } })).toEqual(refused({ kind: "render-failed", concept: "session-skill", name: "example",
      reason: "The source is outside its session skill." }));
});

test("a whole formatter failure names tables.md rather than the first authored door", () => {
  const tables = mock<(verb: string) => Result<string, string>>(() => refused("Scope mapping unavailable"));
  expect(createClaudeSkillRenderer({ files, prepare, tokens, tables })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/tables.md",
      reason: "Scope mapping unavailable",
    }));
  expect(tables.mock.calls).toEqual([["stage-table"]]);
});

test("non-template text sidecars stay literal through the shared writer's byte path", () => {
  expect(createClaudeSkillRenderer({ files, prepare, tokens, tables: () => accepted("") })
    .renderSessionSkill({ skill: { name: "example", files: [{
      source: source("skills/example/reference.txt"),
      content: { kind: "text", text: "{{INVOKE}}" },
    }] } })).toEqual(accepted([{
      path: path(".claude/skills/example/reference.txt"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      origin: { kind: "neutral", source: source("skills/example/reference.txt") },
    }]));
});
