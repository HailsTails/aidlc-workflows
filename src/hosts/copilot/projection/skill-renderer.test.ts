import { expect, test } from "bun:test";
import { source, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { sessionSkillFixture, skillRenderingInputsFixture } from "../../../projection/fixtures/skill-rendering.fixture.ts";
import { createCopilotSkillRenderer } from "./skill-renderer.ts";

const inputs = skillRenderingInputsFixture({ harnessDir: ".aidlc" });

test("Copilot places the four authored documents with tokens and refreshed tables but no earlier-release tail", () => {
  expect(createCopilotSkillRenderer(inputs).renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(accepted([
    { path: path(".github/skills/aidlc/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("---\nname: aidlc\n---\n\nRun `bun .aidlc/tools/aidlc.ts engine orchestrate next` and follow `.aidlc/aidlc-common/protocols/stage-protocol.md`.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".github/skills/aidlc/question-rendering.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Question rendering\n\nOffer the options A-E.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".github/skills/aidlc/composer.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Composer\n\nRead `.aidlc/rules/aidlc.md` before you run /aidlc-replay.\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".github/skills/aidlc/tables.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("# Tables\n\n| Scope | Stages |\n|---|---|\n| feature | 12 |\n\n| Stage | Phase |\n|---|---|\n| requirements-analysis | inception |\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
  ]));
});

test("Copilot reads every session file as UTF-8, preserves slash invocations", () => {
  expect(createCopilotSkillRenderer(inputs).renderSessionSkill({ skill: sessionSkillFixture })).toEqual(accepted([
    { path: path(".github/skills/aidlc-issue-report/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("---\nname: aidlc-issue-report\n---\n\nRun /aidlc-issue-report, then read `.aidlc/rules/aidlc.md` and `<record>/aidlc-state.md`.\n") },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/SKILL.md") } },
    { path: path(".github/skills/aidlc-issue-report/scripts/collect.ts"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode('const invoke = "bun .aidlc/tools/aidlc.ts";\nconst harnessDir = ".aidlc";\n') },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/scripts/collect.ts") } },
    { path: path(".github/skills/aidlc-issue-report/references/data.yaml"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("invoke: bun .aidlc/tools/aidlc.ts\n") },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/references/data.yaml") } },
    { path: path(".github/skills/aidlc-issue-report/assets/mark.png"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([239, 191, 189, 80, 78, 71]) },
      origin: { kind: "neutral", source: source("skills/aidlc-issue-report/assets/mark.png") } },
  ]));
});


test("Copilot refuses a missing authored document with its source", () => {
  expect(createCopilotSkillRenderer({ ...inputs, files: [] }).renderOrchestratorSkill({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured." }));
});

test("Copilot refuses session sources outside their named skill", () => {
  expect(createCopilotSkillRenderer(inputs).renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/other/SKILL.md"), content: { kind: "text", text: "other" } },
  ] } })).toEqual(refused({ kind: "render-failed", concept: "session-skill", name: "example",
    reason: "The source is outside its session skill." }));
});

test("Copilot retains formatter refusals on the tables document", () => {
  expect(createCopilotSkillRenderer({ ...inputs, tables: () => refused("Unavailable") })
    .renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(refused({ kind: "render-failed",
      concept: "orchestrator-skill", name: "skills/aidlc/tables.md", reason: "Unavailable" }));
});


test("Copilot preserves BOMs, authored policy files and every token in arbitrary session extensions", () => {
  expect(createCopilotSkillRenderer(inputs).renderSessionSkill({ skill: { name: "example", files: [
    { source: source("skills/example/raw.dat"), content: { kind: "bytes",
      bytes: new TextEncoder().encode("\uFEFF/aidlc {{HARNESS_DIR}} {{INVOKE}} {{OPTION_LETTERS}} {{TOOL_PREFIX}} {{TRUSTED_NAMESPACE}}") } },
    { source: source("skills/example/agents/openai.yaml"), content: { kind: "text", text: "authored policy" } },
  ] } })).toEqual(accepted([
    { path: path(".github/skills/example/raw.dat"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("\uFEFF/aidlc .aidlc bun .aidlc/tools/aidlc.ts A-E bun .aidlc/tools/ aidlc") },
      origin: { kind: "neutral", source: source("skills/example/raw.dat") } },
    { path: path(".github/skills/example/agents/openai.yaml"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("authored policy") },
      origin: { kind: "neutral", source: source("skills/example/agents/openai.yaml") } },
  ]));
});

test("Copilot uses captured authored bytes instead of a generic preparation transform", () => {
  expect(createCopilotSkillRenderer({ ...inputs, prepare: () => refused({
    kind: "render-failed", concept: "orchestrator-skill", name: "unexpected", reason: "Not this host's transform",
  }) }).renderOrchestratorSkill({ method: methodSliceFixture }).ok).toBe(true);
});
