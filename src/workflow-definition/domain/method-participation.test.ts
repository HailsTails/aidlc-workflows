import { expect, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { agent, artifact, stage } from "../fixtures/identities.fixture.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { methodSliceFixture } from "../fixtures/method.fixture.ts";
import { pluginId } from "./identities.ts";
import type { Method } from "./method.ts";
import type { Stage } from "./stage.ts";
import { inlineAgentSet, reviewerAgentSet } from "./method-participation.ts";

const mob: Stage = {
  slug: stage("review"), source: methodSource({ kind: "stage", within: "operation/review.md" }),
  displayName: "Review", phase: "operation", orderingHint: null, owner: { kind: "core" },
  execution: { trigger: "always", condition: "Review" },
  participation: { mode: "mob", lead: { kind: "agent", agent: agent("aidlc-architect-agent") },
    supports: [agent("aidlc-developer-agent")] },
  cardinality: { kind: "once" }, workspace: "read-only", produces: [],
  consumes: [], requires: [], sensors: [], review: null, summaryConfirmation: "none",
  activation: { kind: "always" }, composerPrior: null, requiredSections: [],
  briefing: { inputs: "", outputs: "", instructions: { text: "", headings: [] } },
};
const plugin = accept(pluginId("metrics"));
const pluginStage: Stage = { ...mob, slug: stage("metrics-review"),
  owner: { kind: "plugin", plugin }, participation: { mode: "inline",
    lead: { kind: "agent", agent: agent("aidlc-developer-agent") }, supports: [] },
  review: { reviewer: agent("aidlc-architecture-reviewer-agent"),
    artifact: artifact("reviewed"), maxIterations: 2, reviewClass: "adversarial" } };
const combined = brand<Method>({ ...methodSliceFixture, stages: [mob, pluginStage] });
const conductor = brand<Method>({ ...methodSliceFixture, stages: [{ ...mob,
  participation: { mode: "inline", lead: { kind: "conductor" },
    supports: [agent("aidlc-delivery-agent")] } }] });

test("reviewer facts include all admitted stages and deduplicate shared reviewers", () => {
  expect([...reviewerAgentSet(methodSliceFixture)]).toEqual<readonly string[]>([
    "aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent",
  ]);
  expect([...reviewerAgentSet(combined)]).toEqual<readonly string[]>(["aidlc-architecture-reviewer-agent"]);
});

test("core inline participation includes lead and supports but excludes dispatched stages", () => {
  expect([...inlineAgentSet(methodSliceFixture)]).toEqual<readonly string[]>([
    "aidlc-product-agent", "aidlc-architect-agent", "aidlc-delivery-agent",
  ]);
});

test("a mob lead reads inline while supports and plugin stages remain dispatched", () => {
  expect([...inlineAgentSet(combined)]).toEqual<readonly string[]>(["aidlc-architect-agent"]);
});

test("the conductor is not an agent and inline supports still receive their persona", () => {
  expect([...inlineAgentSet(conductor)]).toEqual<readonly string[]>(["aidlc-delivery-agent"]);
});
