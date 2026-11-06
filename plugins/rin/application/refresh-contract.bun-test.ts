import { describe, expect, test } from "bun:test";
import { rinStageRefreshComparison as stageRefreshComparison } from "./refresh-contract.ts";
const stage = { slug: "work", approval_mode: "explicit", produces: ["facts"] };

const requiredSections = {
  id: "required-sections", path: ".claude/sensors/aidlc-required-sections.md",
  fire_on: "gate", default_severity: "advisory", category: "document-shape",
  matches: "**/{aidlc-docs,intents}/**",
};
const originalOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved)";
const engineOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)";

const askedFramingCondition = "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, gets the answers, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).";
const settledFramingCondition = "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).";
const askedFramingOutputs = "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions with the human's answers), under this stage's record dir, engine-resolved";
const settledFramingOutputs = "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack), under this stage's record dir, engine-resolved";
const framingStage = { ...stage, slug: "rin-gate-1-framing", plugin: "rin", approval_mode: "autonomous" };
const askedFraming = { ...framingStage, condition: askedFramingCondition, outputs: askedFramingOutputs };
const settledFraming = { ...framingStage, condition: settledFramingCondition, outputs: settledFramingOutputs };

describe("accepted Gate 1 framing settlement prose", () => {
  test("normalizes the exact framing pair and records its decision-record revalidation", () => {
    expect(stageRefreshComparison({ installed: askedFraming, candidate: settledFraming })).toEqual({
      kind: "comparable",
      installed: { ...askedFraming, sensors: [], sensors_applicable: [] },
      candidate: { ...askedFraming, sensors: [], sensors_applicable: [] },
      revalidation: ["framing-decision-record"],
    });
  });
  test.each([
    { name: "only condition", candidate: { ...askedFraming, condition: settledFramingCondition } },
    { name: "only outputs", candidate: { ...askedFraming, outputs: settledFramingOutputs } },
    { name: "outputs one character off", candidate: { ...settledFraming, outputs: `${settledFramingOutputs}.` } },
    { name: "condition one character off", candidate: { ...settledFraming, condition: settledFramingCondition.replace("seats", "seat") } },
  ])("leaves a partial or inexact framing change ($name) for strict comparison", ({ candidate }) => {
    expect(stageRefreshComparison({ installed: askedFraming, candidate })).toMatchObject({
      kind: "comparable", candidate: { condition: candidate.condition, outputs: candidate.outputs }, revalidation: [],
    });
  });
  test("does not normalize the reverse direction", () => {
    expect(stageRefreshComparison({ installed: settledFraming, candidate: askedFraming })).toMatchObject({
      kind: "comparable", candidate: { condition: askedFramingCondition, outputs: askedFramingOutputs }, revalidation: [],
    });
  });
  test.each(["rin-gate-2-solution", "work", "code-generation"])("does not normalize the framing pair on %s", (slug) => {
    expect(stageRefreshComparison({ installed: { ...askedFraming, slug }, candidate: { ...settledFraming, slug } })).toMatchObject({
      kind: "comparable", candidate: { condition: settledFramingCondition, outputs: settledFramingOutputs }, revalidation: [],
    });
  });
  test("does not normalize the Code Generation pair on Gate 1", () => {
    expect(stageRefreshComparison({ installed: { ...framingStage, outputs: originalOutputs },
      candidate: { ...framingStage, outputs: engineOutputs },
    })).toMatchObject({ kind: "comparable", candidate: { outputs: engineOutputs }, revalidation: [] });
  });
  test.each([
    { name: "another plugin", installed: { ...askedFraming, plugin: "other" }, candidate: { ...settledFraming, plugin: "other" } },
    { name: "no plugin", installed: { ...askedFraming, plugin: undefined }, candidate: { ...settledFraming, plugin: undefined } },
    { name: "an installed stage without the plugin", installed: { ...askedFraming, plugin: undefined }, candidate: settledFraming },
    { name: "a candidate stage without the plugin", installed: askedFraming, candidate: { ...settledFraming, plugin: undefined } },
  ])("does not normalize the framing pair for $name", ({ installed, candidate }) => {
    expect(stageRefreshComparison({ installed, candidate })).toMatchObject({
      kind: "comparable", candidate: { condition: settledFramingCondition, outputs: settledFramingOutputs }, revalidation: [],
    });
  });
  test("keeps any other field change visible beside the exact framing pair", () => {
    expect(stageRefreshComparison({ installed: askedFraming, candidate: { ...settledFraming, approval_mode: "explicit" } })).toMatchObject({
      kind: "comparable",
      installed: { approval_mode: "autonomous" },
      candidate: { condition: askedFramingCondition, outputs: askedFramingOutputs, approval_mode: "explicit" },
      revalidation: ["framing-decision-record"],
    });
  });
  test("orders coverage before the accepted prose effect", () => {
    const covered = { ...askedFraming, sensors: ["required-sections"], sensors_applicable: [requiredSections] };
    expect(stageRefreshComparison({ installed: covered,
      candidate: { ...covered, condition: settledFramingCondition, outputs: settledFramingOutputs,
        sensors_applicable: [{ ...requiredSections, matches: "**/{aidlc-docs,intents,codekb}/**" }] },
    })).toMatchObject({ kind: "comparable", revalidation: ["gate-sensor-coverage", "framing-decision-record"] });
  });
});


const seatedFramingCondition = "Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The seats and the lead draft the framing together. Prose only; no solution is chosen here (Gate 2).";
const disposedFramingOutputs = "rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack, and the disposition of every seat objection), under this stage's record dir, engine-resolved";
const askedOptionsOutputs = "rin-solution-options.md (the options ledger — decision points, candidates with their premises, the comparison, and the decision on each point) and rin-options-questions.md (the entry-read citation, what each seat was asked and answered, and the disposition of every seat objection), under this stage's record dir, engine-resolved";
const leaningOptionsOutputs = "rin-solution-options.md (the options ledger — decision points, candidates with their premises, the comparison, and the decision on each point) and rin-options-questions.md (the entry-read citation, the lead's leaning on each point, and the disposition of every seat objection), under this stage's record dir, engine-resolved";
const lockOutputs = "rin-components.md (the domain model, components, units and their dependencies) and rin-interface-lock.md (the exact contracts, the External reality section, and the single Constitution Check), under this stage's record dir, engine-resolved. The gate is AIDLC-native (ordered walk + approval), proven by the engine's own `report --result approved` audit event; no `.gate-lock` marker file.";
const recordedLockOutputs = "rin-components.md (the domain model, components, units and their dependencies), rin-interface-lock.md (the exact contracts, the External reality section, and the single Constitution Check) and rin-design-questions.md (the gate's decision record: the calls it made in a decided class to specify a lock element, and the disposition of every seat objection), under this stage's record dir, engine-resolved. The gate is AIDLC-native (ordered walk + approval), proven by the engine's own `report --result approved` audit event; no `.gate-lock` marker file.";

const rinGateSeats = [
  {
    slug: "rin-gate-0-reconcile",
    installed: { lead_agent: "aidlc-delivery-agent", support_agents: ["aidlc-product-agent"], reviewer: "aidlc-architecture-reviewer-agent" },
    candidate: { lead_agent: "rin-delivery-agent", support_agents: ["rin-product-agent"], reviewer: "rin-stage-reviewer-agent" },
    revalidation: ["rin-gate-seats"],
  },
  {
    slug: "rin-gate-1-framing",
    installed: {
      condition: askedFramingCondition, outputs: askedFramingOutputs, lead_agent: "aidlc-product-agent",
      support_agents: ["aidlc-architect-agent", "aidlc-developer-agent"], reviewer: "aidlc-architecture-reviewer-agent",
    },
    candidate: {
      condition: seatedFramingCondition, outputs: disposedFramingOutputs, lead_agent: "rin-product-agent",
      support_agents: ["rin-architect-agent", "rin-developer-agent", "rin-customer-seat-agent"], reviewer: "rin-decorrelated-review-agent",
    },
    revalidation: ["framing-decision-record", "rin-gate-seats"],
  },
  {
    slug: "rin-gate-2-plan-review",
    installed: { lead_agent: "aidlc-architect-agent", support_agents: ["aidlc-developer-agent", "aidlc-quality-agent", "rin-challenger-agent"], outputs: askedOptionsOutputs },
    candidate: {
      lead_agent: "rin-architect-agent", support_agents: ["rin-developer-agent", "rin-quality-agent", "rin-challenger-agent", "rin-customer-seat-agent"],
      outputs: leaningOptionsOutputs,
    },
    revalidation: ["rin-gate-seats"],
  },
  {
    slug: "rin-gate-3-interface-lock",
    installed: {
      lead_agent: "aidlc-architect-agent", support_agents: ["aidlc-developer-agent", "aidlc-quality-agent"],
      produces: ["rin-components", "rin-interface-lock"], outputs: lockOutputs,
    },
    candidate: {
      lead_agent: "rin-architect-agent", support_agents: ["rin-developer-agent", "rin-quality-agent", "rin-customer-seat-agent"],
      produces: ["rin-components", "rin-interface-lock", "rin-design-questions"], outputs: recordedLockOutputs,
    },
    revalidation: ["rin-gate-seats"],
  },
  {
    slug: "rin-gate-4-implement",
    installed: { lead_agent: "aidlc-developer-agent" },
    candidate: { lead_agent: "rin-developer-agent" },
    revalidation: ["rin-gate-seats"],
  },
  {
    slug: "rin-gate-5-review-cycle",
    installed: { lead_agent: "aidlc-developer-agent" },
    candidate: { lead_agent: "rin-developer-agent" },
    revalidation: ["rin-gate-seats"],
  },
  {
    slug: "rin-gate-6-operate",
    installed: { lead_agent: "aidlc-operations-agent", support_agents: ["aidlc-pipeline-deploy-agent", "aidlc-delivery-agent"], reviewer: "aidlc-architecture-reviewer-agent" },
    candidate: { lead_agent: "rin-operations-agent", support_agents: ["rin-pipeline-deploy-agent", "rin-delivery-agent"], reviewer: "rin-stage-reviewer-agent" },
    revalidation: ["rin-gate-seats"],
  },
] as const;

const rinGate = (args: { readonly slug: string; readonly fields: Readonly<Record<string, unknown>> }) =>
  ({ ...stage, slug: args.slug, plugin: "rin", approval_mode: "autonomous", ...args.fields });
const reconcile = rinGateSeats[0];

describe("accepted rin gate seats", () => {
  test.each([...rinGateSeats])("normalizes the exact $slug pair and records its revalidation", ({ slug, installed, candidate, revalidation }) => {
    const before = rinGate({ slug, fields: installed });
    expect(stageRefreshComparison({ installed: before, candidate: rinGate({ slug, fields: candidate }) })).toEqual({
      kind: "comparable",
      installed: { ...before, sensors: [], sensors_applicable: [] },
      candidate: { ...before, sensors: [], sensors_applicable: [] },
      revalidation,
    });
  });
  test.each([
    { name: "a different lead agent", candidate: { ...reconcile.candidate, lead_agent: "rin-product-agent" } },
    { name: "a different reviewer", candidate: { ...reconcile.candidate, reviewer: "rin-decorrelated-review-agent" } },
    { name: "an extra support agent", candidate: { ...reconcile.candidate, support_agents: ["rin-product-agent", "rin-customer-seat-agent"] } },
    { name: "only the lead agent changed", candidate: { ...reconcile.installed, lead_agent: reconcile.candidate.lead_agent } },
  ])("leaves Gate 0 with $name for strict comparison", ({ candidate }) => {
    expect(stageRefreshComparison({
      installed: rinGate({ slug: reconcile.slug, fields: reconcile.installed }), candidate: rinGate({ slug: reconcile.slug, fields: candidate }),
    })).toMatchObject({ kind: "comparable", candidate: { lead_agent: candidate.lead_agent, reviewer: candidate.reviewer }, revalidation: [] });
  });
  test("leaves Gate 3 with support agents in another order for strict comparison", () => {
    const lock = rinGateSeats[3];
    const reordered = { ...lock.candidate, support_agents: ["rin-quality-agent", "rin-developer-agent", "rin-customer-seat-agent"] };
    expect(stageRefreshComparison({ installed: rinGate({ slug: lock.slug, fields: lock.installed }), candidate: rinGate({ slug: lock.slug, fields: reordered }) }))
      .toMatchObject({ kind: "comparable", candidate: { support_agents: reordered.support_agents }, revalidation: [] });
  });
  test("leaves Gate 1 with only its seats changed for strict comparison", () => {
    const framing = rinGateSeats[1];
    const seatsOnly = { ...framing.candidate, condition: askedFramingCondition, outputs: askedFramingOutputs };
    expect(stageRefreshComparison({ installed: rinGate({ slug: framing.slug, fields: framing.installed }), candidate: rinGate({ slug: framing.slug, fields: seatsOnly }) }))
      .toMatchObject({ kind: "comparable", candidate: { lead_agent: "rin-product-agent" }, revalidation: [] });
  });
  test("does not normalize the reverse direction", () => {
    expect(stageRefreshComparison({
      installed: rinGate({ slug: reconcile.slug, fields: reconcile.candidate }), candidate: rinGate({ slug: reconcile.slug, fields: reconcile.installed }),
    })).toMatchObject({ kind: "comparable", candidate: { lead_agent: "aidlc-delivery-agent" }, revalidation: [] });
  });
  test.each([
    { name: "another stage", installed: rinGate({ slug: "work", fields: reconcile.installed }), candidate: rinGate({ slug: "work", fields: reconcile.candidate }) },
    { name: "another gate", installed: rinGate({ slug: "rin-gate-6-operate", fields: reconcile.installed }), candidate: rinGate({ slug: "rin-gate-6-operate", fields: reconcile.candidate }) },
    { name: "another plugin", installed: { ...rinGate({ slug: reconcile.slug, fields: reconcile.installed }), plugin: "other" }, candidate: { ...rinGate({ slug: reconcile.slug, fields: reconcile.candidate }), plugin: "other" } },
    { name: "no plugin", installed: { ...rinGate({ slug: reconcile.slug, fields: reconcile.installed }), plugin: undefined }, candidate: { ...rinGate({ slug: reconcile.slug, fields: reconcile.candidate }), plugin: undefined } },
  ])("does not normalize the Gate 0 pair on $name", ({ installed, candidate }) => {
    expect(stageRefreshComparison({ installed, candidate })).toMatchObject({
      kind: "comparable", candidate: { lead_agent: "rin-delivery-agent" }, revalidation: [],
    });
  });
});
