import { expect, test } from "bun:test";
import { source, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { sessionSkillFixture, skillRenderingInputsFixture } from "../../../projection/fixtures/skill-rendering.fixture.ts";
import { createCodexSkillRenderer } from "./skill-renderer.ts";

const inputs = skillRenderingInputsFixture({ harnessDir: ".codex" });

test("Codex places the four authored documents with tokens only, refreshed tables and the earlier-release tail", () => {
  expect(createCodexSkillRenderer(inputs).renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(accepted([
    { path: path(".agents/skills/aidlc/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("---\nname: aidlc\n---\n\nRun `bun .codex/tools/aidlc.ts engine orchestrate next` and follow `.codex/aidlc-common/protocols/stage-protocol.md`.\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".agents/skills/aidlc/question-rendering.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Question rendering\n\nOffer the options A-E.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".agents/skills/aidlc/composer.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Composer\n\nRead `.codex/rules/aidlc.md` before you run /aidlc-replay.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".agents/skills/aidlc/tables.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Tables\n\n| Scope | Stages |\n|---|---|\n| feature | 12 |\n\n| Stage | Phase |\n|---|---|\n| requirements-analysis | inception |\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
  ]));
});

test("Codex reads every session file as UTF-8, rewrites prose and emits its implicit invocation policy", () => {
  expect(createCodexSkillRenderer(inputs).renderSessionSkill({ skill: sessionSkillFixture })).toEqual(accepted([
    { path: path(".agents/skills/aidlc-issue-report/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("---\nname: aidlc-issue-report\n---\n\nRun $aidlc-issue-report, then read `.codex/aidlc-rules/aidlc.md` and `<record>/aidlc-state.md`.\n") },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/SKILL.md") } },
    { path: path(".agents/skills/aidlc-issue-report/scripts/collect.ts"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode('const invoke = "bun .codex/tools/aidlc.ts";\nconst harnessDir = ".codex";\n') },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/scripts/collect.ts") } },
    { path: path(".agents/skills/aidlc-issue-report/references/data.yaml"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("invoke: bun .codex/tools/aidlc.ts\n") },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/references/data.yaml") } },
    { path: path(".agents/skills/aidlc-issue-report/assets/mark.png"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([239, 191, 189, 80, 78, 71]) },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/assets/mark.png") } },
    { path: path(".agents/skills/aidlc-issue-report/agents/openai.yaml"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("policy:\n  allow_implicit_invocation: false\n") },
      origin: { kind: "rendered", concept: "session-skill", name: "aidlc-issue-report" } },
  ]));
});

test("Codex replaces an authored policy rather than emitting duplicate paths", () => {
  expect(createCodexSkillRenderer(inputs).renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/agents/openai.yaml"), content: { kind: "text", text: "authored policy" } },
  ] } })).toEqual(accepted([
    { path: path(".agents/skills/example/agents/openai.yaml"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("policy:\n  allow_implicit_invocation: false\n") },
      origin: { kind: "rendered", concept: "session-skill", name: "example" } },
  ]));
});

test("Codex refuses a missing authored document with its source", () => {
  expect(createCodexSkillRenderer({ ...inputs, files: [] }).renderOrchestratorSkill({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured." }));
});

test("Codex refuses session sources outside their named skill", () => {
  expect(createCodexSkillRenderer(inputs).renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/other/SKILL.md"), content: { kind: "text", text: "other" } },
  ] } })).toEqual(refused({ kind: "render-failed", concept: "session-skill", name: "example",
    reason: "The source is outside its session skill." }));
});

test("Codex retains formatter refusals on the tables document", () => {
  expect(createCodexSkillRenderer({ ...inputs, tables: () => refused("Unavailable") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({ kind: "render-failed",
      concept: "orchestrator-skill", name: "skills/aidlc/tables.md", reason: "Unavailable" }));
});

test("Codex rewrites slash invocations only in Markdown and preserves BOMs and path references", () => {
  expect(createCodexSkillRenderer(inputs).renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/SKILL.md"), content: { kind: "text",
      text: '\uFEFF/aidlc /aidlc-replay /aidlc-state.md <record>/aidlc-state.md .codex/tools/aidlc.ts\n(/aidlc) `/aidlc-knowledge` "/aidlc-issue-report"\n' } },
    { source: source("skills/example/raw.txt"), content: { kind: "text",
      text: "/aidlc {{OPTION_LETTERS}} {{TOOL_PREFIX}} {{TRUSTED_NAMESPACE}} .codex/rules/default.rules" } },
  ] } })).toEqual(accepted([
    { path: path(".agents/skills/example/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode('\uFEFF$aidlc $aidlc-replay /aidlc-state.md <record>/aidlc-state.md .codex/tools/aidlc.ts\n($aidlc) `$aidlc-knowledge` "$aidlc-issue-report"\n') },
      origin: { kind: "neutral", source: source("skills/example/SKILL.md") } },
    { path: path(".agents/skills/example/raw.txt"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("/aidlc A-E bun .codex/tools/ aidlc .codex/aidlc-rules/default.rules") },
      origin: { kind: "neutral", source: source("skills/example/raw.txt") } },
    { path: path(".agents/skills/example/agents/openai.yaml"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("policy:\n  allow_implicit_invocation: false\n") },
      origin: { kind: "rendered", concept: "session-skill", name: "example" } },
  ]));
});
