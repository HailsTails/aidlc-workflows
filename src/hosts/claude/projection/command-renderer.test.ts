import { expect, test } from "bun:test";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Scope } from "../../../workflow-definition/domain/scope.ts";
import type { Stage } from "../../../workflow-definition/domain/stage.ts";
import { stageNumber, type ScopeColumn, type StageNode } from
  "../../../workflow-definition/domain/stage-graph.ts";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { stage as stageSlug, scope as scopeName } from
  "../../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { createClaudeCommandRenderers } from "./command-renderer.ts";

const stage: Stage = {
  slug: stageSlug("requirements-analysis"),
  source: methodSource({ kind: "stage", within: "inception/requirements-analysis.md" }),
  displayName: "Requirements Analysis", phase: "inception", orderingHint: null,
  owner: { kind: "core" }, execution: { trigger: "always", condition: "A feature request" },
  participation: { mode: "inline", lead: { kind: "conductor" }, supports: [] },
  cardinality: { kind: "once" }, workspace: "read-only", produces: [], consumes: [],
  requires: [], sensors: [], review: null, summaryConfirmation: "none",
  activation: { kind: "always" }, composerPrior: null, requiredSections: [],
  briefing: { inputs: "Intent", outputs: "Requirements", instructions: { text: "", headings: [] } },
};
const node: StageNode = { stage: stage.slug, number: accept(stageNumber("2.3")),
  availability: "enabled", rulesInContext: [], activeSensors: [] };
const scope: Scope = { name: scopeName("feature"),
  source: methodSource({ kind: "scope", within: "aidlc-feature.md" }),
  owner: { kind: "core" }, description: "Feature work", keywords: [], depth: "standard",
  testStrategy: null, runner: "generated", skeleton: "none", codebase: "new", guardPolicy: "off",
  ceremony: {}, reviewCap: null, guidance: "" };
const column: ScopeColumn = { scope: scope.name, stages: [stage.slug] };

test("Claude places the frozen stage command without copying its naming or text policy", () => {
  const renderer = createClaudeCommandRenderers({ orchestrator: () => accepted(null), stage: (request) => {
    expect(request).toEqual({ stage, node });
    return accepted([{ nativeName: "aidlc-requirements-analysis", within: "SKILL.md",
      content: { kind: "text", text: "Frozen stage command\n" }, mode: "regular" }]);
  }, scope: () => accepted(null) });
  expect(renderer.renderStageCommand({ stage, node })).toEqual(accepted([{
    path: path(".claude/skills/aidlc-requirements-analysis/SKILL.md"),
    content: { kind: "text", text: "Frozen stage command\n" }, mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "stage-command", name: "requirements-analysis" },
  }]));
});

test("Claude places the frozen scope command", () => {
  const renderer = createClaudeCommandRenderers({ orchestrator: () => accepted(null), stage: () => accepted(null), scope: (request) => {
    expect(request).toEqual({ scope, column });
    return accepted([{ nativeName: "aidlc-feature", within: "SKILL.md",
      content: { kind: "text", text: "Frozen scope command\n" }, mode: "regular" }]);
  } });
  expect(renderer.renderScopeCommand({ scope, column })).toEqual(accepted([{
    path: path(".claude/skills/aidlc-feature/SKILL.md"),
    content: { kind: "text", text: "Frozen scope command\n" }, mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "scope-command", name: "feature" },
  }]));
});

test("the legacy selector can decline a command without inventing a new runner", () => {
  const renderer = createClaudeCommandRenderers({ orchestrator: () => accepted(null), stage: () => accepted(null),
    scope: () => accepted(null) });
  expect(renderer.renderStageCommand({ stage, node })).toEqual(accepted([]));
});

test("a legacy formatting refusal reaches the caller unchanged", () => {
  const refusal: ProjectionRefusal = { kind: "render-failed", concept: "stage-command",
    name: "requirements-analysis", reason: "The captured command context is missing" };
  const renderer = createClaudeCommandRenderers({ orchestrator: () => accepted(null), stage: () => refused(refusal),
    scope: () => accepted(null) });
  expect(renderer.renderStageCommand({ stage, node })).toEqual(refused(refusal));
});

test("a native command name cannot escape its skills directory", () => {
  const renderer = createClaudeCommandRenderers({ orchestrator: () => accepted(null), stage: () => accepted([{
    nativeName: "../outside", within: "SKILL.md", content: { kind: "text", text: "Unused" },
    mode: "regular" }]), scope: () => accepted(null) });
  expect(renderer.renderStageCommand({ stage, node })).toMatchObject({ ok: false,
    refusal: { kind: "render-failed", concept: "stage-command", name: "requirements-analysis" } });
});


test("the host preserves companion files from the frozen command boundary", () => {
  const renderer = createClaudeCommandRenderers({ orchestrator: () => accepted(null), stage: () => accepted([
    { nativeName: "aidlc-example", within: "SKILL.md", mode: "regular",
      content: { kind: "text", text: "Command\n" } },
    { nativeName: "aidlc-example", within: "metadata.json", mode: "regular",
      content: { kind: "text", text: "Companion\n" } },
  ]), scope: () => accepted(null) });
  expect(renderer.renderStageCommand({ stage, node })).toEqual(accepted([
    { path: path(".claude/skills/aidlc-example/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "text", text: "Command\n" },
      origin: { kind: "rendered", concept: "stage-command", name: "requirements-analysis" } },
    { path: path(".claude/skills/aidlc-example/metadata.json"), mode: "regular", availability: "always",
      content: { kind: "text", text: "Companion\n" },
      origin: { kind: "rendered", concept: "stage-command", name: "requirements-analysis" } },
  ]));
});


test("the one orchestrator member places both fixed entry shortcuts with their own origins", () => {
  const renderer = createClaudeCommandRenderers({ stage: () => accepted(null),
    scope: () => accepted(null), orchestrator: (request) => {
      expect(request).toEqual({ method: methodSliceFixture });
      return accepted([
        { nativeName: "aidlc-init", within: "SKILL.md", mode: "regular",
          content: { kind: "text", text: "Frozen initialization shortcut\n" } },
        { nativeName: "aidlc-compose", within: "SKILL.md", mode: "regular",
          content: { kind: "text", text: "Frozen composition shortcut\n" } },
      ]);
    } });
  expect(renderer.renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(accepted([
    { path: path(".claude/skills/aidlc-init/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "text", text: "Frozen initialization shortcut\n" },
      origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-init" } },
    { path: path(".claude/skills/aidlc-compose/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "text", text: "Frozen composition shortcut\n" },
      origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-compose" } },
  ]));
});

test("an invalid shortcut path refuses as an orchestrator skill rather than an arbitrary stage", () => {
  const renderer = createClaudeCommandRenderers({ stage: () => accepted(null),
    scope: () => accepted(null), orchestrator: () => accepted([
      { nativeName: "aidlc-init", within: "../outside", mode: "regular",
        content: { kind: "text", text: "Unused" } },
    ]) });
  expect(renderer.renderOrchestratorSkill({ method: methodSliceFixture })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "orchestrator-skill", name: "aidlc-init",
      reason: "The native command destination must be a project-relative path." } });
});
