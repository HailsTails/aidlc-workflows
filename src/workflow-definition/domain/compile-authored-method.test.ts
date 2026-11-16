import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { authoredBody } from "../fixtures/authored-body.fixture.ts";
import { artifact, stage } from "../fixtures/identities.fixture.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import type { Contribution } from "./contribution.ts";
import { pluginId } from "./identities.ts";
import type { CoreContent } from "./method.ts";
import type { Stage } from "./stage.ts";
import { compileAuthoredMethod } from "./compile-authored-method.ts";

const instructions = authoredBody([{ level: 2, title: "Steps", prose: "\n" },
  { level: 3, title: "Step 1: Prepare", prose: "\nDo the work.\n" }]);
const coreStage: Stage = { slug: stage("prepare"),
  source: methodSource({ kind: "stage", within: "construction/prepare.md" }),
  displayName: "Prepare", phase: "construction", orderingHint: 1, owner: { kind: "core" },
  execution: { trigger: "always", condition: "A request" },
  participation: { mode: "inline", lead: { kind: "conductor" }, supports: [] },
  cardinality: { kind: "once" }, workspace: "read-only", produces: [{
    artifact: artifact("prepared"), obligation: "required", unitKinds: "all" }],
  consumes: [], requires: [], sensors: [], review: null, summaryConfirmation: "none",
  activation: { kind: "always" }, composerPrior: null, requiredSections: [],
  briefing: { inputs: "Request", outputs: "Prepared work", instructions } };
const core: CoreContent = { stages: [coreStage], agents: [], scopes: [], memberships: [],
  freeformDefaults: [], sensors: [], rules: [], knowledge: [], hooks: [] };
const plugin = accept(pluginId("extension"));
const pluginStage: Stage = { ...coreStage, slug: stage("extension-step"), orderingHint: 2,
  source: methodSource({ kind: "stage", within: "construction/extension-step.md" }),
  owner: { kind: "plugin", plugin }, produces: [{
    artifact: artifact("extended"), obligation: "required", unitKinds: "all" }],
  consumes: [{ artifact: artifact("prepared"), obligation: "required", when: "always", citation: "uncited" }],
  requires: [coreStage.slug] };
const contribution: Contribution = { plugin, version: "1", description: "An extension",
  dependsOn: [{ kind: "core" }], rulesLevel: "team", overlays: [],
  content: { stages: [pluginStage], agents: [], scopes: [], memberships: [],
    freeformDefaults: [], sensors: [], rules: [], knowledge: [] },
  tools: { scripts: [], doctorCheck: null, commands: [] } };
const outline = (text: string) => ({ text, headings: [] });

test("core and contributed stages use the same fresh numbering pipeline", () => {
  const compiled = accept(compileAuthoredMethod({ core, contributions: [contribution],
    selection: { kind: "every-installed" } }, outline));
  expect(compiled.installedPlugins).toEqual([plugin]);
  expect(compiled.graph.nodes).toMatchObject([
    { stage: "prepare", number: "3.1", availability: "enabled" },
    { stage: "extension-step", number: "3.2", availability: "enabled" },
  ]);
});

test("selection retains installed definitions while marking inactive stages", () => {
  const selection = { kind: "only" as const, core: "included" as const, plugins: [] };
  const compiled = accept(compileAuthoredMethod({ core, contributions: [contribution], selection }, outline));
  expect(compiled.installedPlugins).toEqual([plugin]);
  expect(compiled.selection).toEqual(selection);
  expect(compiled.graph.nodes).toMatchObject([
    { stage: "prepare", availability: "enabled" },
    { stage: "extension-step", availability: "disabled" },
  ]);
});

test("enabled required consumption refuses selection-disabled producers at the actual source", () => {
  expect(compileAuthoredMethod({ core, contributions: [contribution], selection: {
    kind: "only", core: "excluded", plugins: [plugin] } }, outline)).toEqual({ ok: false, refusal: [
    { kind: "invalid-file", location: { kind: "method-source", owner: pluginStage.owner,
      path: pluginStage.source }, issues: ["Required artifact prepared has only selection-disabled producers."] },
  ] });
});

test("the shared per-unit route invariant also refuses an invalid contributed stage", () => {
  const handoff: Stage = { ...coreStage, slug: stage("handoff"), orderingHint: 2,
    produces: [{ artifact: artifact("handoff-record"), obligation: "required", unitKinds: "all" }] };
  const invalid: Contribution = { ...contribution, content: { ...contribution.content, stages: [
    { ...pluginStage, orderingHint: 3, cardinality: { kind: "per-unit" }, requires: [handoff.slug] },
  ] } };
  expect(compileAuthoredMethod({ core: { ...core, stages: [
    { ...coreStage, cardinality: { kind: "per-unit" } }, handoff,
  ] }, contributions: [invalid], selection: { kind: "every-installed" } }, outline))
    .toEqual({ ok: false, refusal: [{ kind: "invalid-file", location: { kind: "method-source",
      owner: pluginStage.owner, path: pluginStage.source },
    issues: ["Stage extension-step requires a stage after its per-unit run block begins"] }] });
});

test("plugin admission rejects a contribution that claims a core definition", () => {
  const claimed = { ...contribution, content: { ...contribution.content,
    stages: [{ ...pluginStage, owner: { kind: "core" as const } }] } };
  expect(compileAuthoredMethod({ core, contributions: [claimed],
    selection: { kind: "every-installed" } }, outline)).toEqual({ ok: false, refusal: [
    { kind: "invalid-file", location: { kind: "method-source", owner: { kind: "plugin", plugin },
      path: pluginStage.source }, issues: ["A contribution may not claim another owner's definition."] },
  ] });
});

test("a contribution cannot repair an invalid standalone core reference", () => {
  const invalidCore = { ...core, stages: [{ ...coreStage, requires: [pluginStage.slug] }] };
  expect(compileAuthoredMethod({ core: invalidCore, contributions: [contribution],
    selection: { kind: "every-installed" } }, outline)).toEqual({
    ok: false, refusal: [{ kind: "unknown-reference", source: {
      owner: { kind: "core" }, path: coreStage.source },
    concept: "stage", name: pluginStage.slug }],
  });
});
