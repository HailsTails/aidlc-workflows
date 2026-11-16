import { expect, mock, test } from "bun:test";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { Scope } from "../../workflow-definition/domain/scope.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import { stageNumber, type ScopeColumn, type StageNode } from
  "../../workflow-definition/domain/stage-graph.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { stage as stageSlug, scope as scopeName } from
  "../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { createCommandRenderers } from "./command-renderers.ts";
import { nativeCommandName, commandFilePath, type CommandReading } from "../domain/native-command.ts";

const stage: Stage = {
  slug: stageSlug("requirements-analysis"),
  source: methodSource({ kind: "stage", within: accept(commandFilePath("inception/requirements-analysis.md")) }),
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
  source: methodSource({ kind: "scope", within: accept(commandFilePath("aidlc-feature.md")) }),
  owner: { kind: "core" }, description: "Feature work", keywords: [], depth: "standard",
  testStrategy: null, runner: "generated", skeleton: "none", codebase: "new", guardPolicy: "off",
  ceremony: {}, reviewCap: null, guidance: "" };
const column: ScopeColumn = { scope: scope.name, stages: [stage.slug] };

const exampleReading: CommandReading = { kind: "rendered", files: [
  { name: accept(nativeCommandName("aidlc-example")), within: accept(commandFilePath("SKILL.md")),
    mode: "regular", content: { kind: "text", text: "Command\n" } },
  { name: accept(nativeCommandName("aidlc-example")), within: accept(commandFilePath("agents/guard.yaml")),
    mode: "regular", content: { kind: "text", text: "Guard\n" } },
] };
const initReading: CommandReading = { kind: "rendered", files: [
  { name: accept(nativeCommandName("aidlc-init")), within: accept(commandFilePath("SKILL.md")),
    mode: "regular", content: { kind: "text", text: "Shortcut\n" } },
] };
const composeReading: CommandReading = { kind: "rendered", files: [
  { name: accept(nativeCommandName("aidlc-compose")), within: accept(commandFilePath("SKILL.md")),
    mode: "regular", content: { kind: "text", text: "Shortcut\n" } },
] };

test("shared command placement preserves companions and origin without a host rule copy", () => {
  const place = mock(() => accepted(path("unused")))
    .mockReturnValueOnce(accepted(path(".host/skills/aidlc-example/SKILL.md")))
    .mockReturnValueOnce(accepted(path(".host/skills/aidlc-example/agents/guard.yaml")));
  const renderer = createCommandRenderers({ place, source: { read: () => accepted(exampleReading) } });
  expect(renderer.renderStageCommand({ stage, node })).toEqual(accepted([
    { path: path(".host/skills/aidlc-example/SKILL.md"), mode: "regular", content: { kind: "text", text: "Command\n" },
      origin: { kind: "rendered", concept: "stage-command", name: "requirements-analysis" } },
    { path: path(".host/skills/aidlc-example/agents/guard.yaml"), mode: "regular", content: { kind: "text", text: "Guard\n" },
      origin: { kind: "rendered", concept: "stage-command", name: "requirements-analysis" } },
  ]));
});

test("a declined runner produces no files in the shared owner", () => {
  const renderer = createCommandRenderers({ place: () => accepted(path("unused")),
    source: { read: () => accepted<CommandReading>({ kind: "declined" }) } });
  expect(renderer.renderScopeCommand({ scope, column })).toEqual(accepted([]));
});

test("the shared fold retains a scope refusal without relabelling it as a stage", () => {
  const renderer = createCommandRenderers({ place: () => accepted(path("unused")), source: { read: () => refused({
    kind: "render-failed", concept: "scope-command", name: "feature", reason: "Missing scope input" }) } });
  expect(renderer.renderScopeCommand({ scope, column })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature", reason: "Missing scope input" } });
});

test("shared path admission names the actual scope", () => {
  const renderer = createCommandRenderers({ place: () => refused({ kind: "invalid-path", base: "project", raw: "../outside" }),
    source: { read: () => accepted(exampleReading) } });
  expect(renderer.renderScopeCommand({ scope, column })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature",
      reason: "The native command destination must be a project-relative path." } });
});

test("init and compose stay within the one orchestrator member with distinct subjects", () => {
  const read = mock(() => accepted(initReading)).mockReturnValueOnce(accepted(initReading))
    .mockReturnValueOnce(accepted(composeReading));
  const place = mock(() => accepted(path("unused")))
    .mockReturnValueOnce(accepted(path(".host/skills/aidlc-init/SKILL.md")))
    .mockReturnValueOnce(accepted(path(".host/skills/aidlc-compose/SKILL.md")));
  const renderer = createCommandRenderers({ place, source: { read } });
  expect(renderer.renderOrchestratorSkill({ method: methodSliceFixture })).toEqual(accepted([
    { path: path(".host/skills/aidlc-init/SKILL.md"), mode: "regular", content: { kind: "text", text: "Shortcut\n" },
      origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-init" } },
    { path: path(".host/skills/aidlc-compose/SKILL.md"), mode: "regular", content: { kind: "text", text: "Shortcut\n" },
      origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-compose" } },
  ]));
});

test("two shortcut destinations cannot silently overwrite each other", () => {
  const read = mock(() => accepted(initReading)).mockReturnValueOnce(accepted(initReading))
    .mockReturnValueOnce(accepted(composeReading));
  const renderer = createCommandRenderers({ place: () => accepted(path(".host/skills/collision/SKILL.md")), source: { read } });
  expect(renderer.renderOrchestratorSkill({ method: methodSliceFixture })).toEqual({ ok: false,
    refusal: { kind: "path-collision", path: path(".host/skills/collision/SKILL.md"), origins: [
      { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-init" },
      { kind: "rendered", concept: "orchestrator-skill", name: "aidlc-compose" },
    ] } });
});
