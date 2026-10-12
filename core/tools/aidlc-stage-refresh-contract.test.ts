import { describe, expect, test } from "bun:test";
import { stageRefreshComparison, stageRefreshContract } from "./aidlc-stage-refresh-contract.ts";

const writeSensor = {
  id: "writer", path: ".claude/sensors/writer.md", fire_on: "write" as const, default_severity: "advisory" as const,
};
const gateSensor = { ...writeSensor, id: "gate", fire_on: "gate" as const };
const stage = { slug: "work", approval_mode: "explicit", produces: ["facts"] };

describe("stage refresh completion contract", () => {
  test("retains approval and artifact obligations across advisory write updates and restoration", () => {
    const before = stageRefreshContract({ stage });
    const after = stageRefreshContract({ stage: {
      ...stage, sensors: [writeSensor.id], sensors_applicable: [writeSensor],
    } });
    expect(after).toEqual({ kind: "comparable", value: {
      ...stage, sensors: [], sensors_applicable: [],
    } });
    expect(before).toEqual({ kind: "comparable", value: {
      ...stage, sensors: [], sensors_applicable: [],
    } });
  });

  test("retains gate bindings and blocking write bindings", () => {
    const gate = stageRefreshContract({ stage: {
      ...stage, sensors: [gateSensor.id], sensors_applicable: [gateSensor],
    } });
    const blockingSensor = { ...writeSensor, default_severity: "blocking" as const };
    const blocking = stageRefreshContract({ stage: {
      ...stage, sensors: [blockingSensor.id], sensors_applicable: [blockingSensor],
    } });
    expect(blocking).toEqual({ kind: "comparable", value: {
      ...stage, sensors: [blockingSensor.id], sensors_applicable: [blockingSensor],
    } });
    expect(gate).toEqual({ kind: "comparable", value: {
      ...stage, sensors: [gateSensor.id], sensors_applicable: [gateSensor],
    } });
  });

  test.each([
    null, [], { ...stage, sensors: null }, { ...stage, sensors_applicable: null },
    { ...stage, sensors: [writeSensor.id], sensors_applicable: [] },
    { ...stage, sensors: [writeSensor.id, writeSensor.id], sensors_applicable: [writeSensor, writeSensor] },
    { ...stage, sensors: ["different"], sensors_applicable: [writeSensor] },
    { ...stage, sensors: [writeSensor.id], sensors_applicable: [{ ...writeSensor, enforcement: "blocking" }] },
    { ...stage, sensors: [writeSensor.id], sensors_applicable: [{ ...writeSensor, fire_on: "unknown" }] },
  ].map((invalid) => ({ invalid })))("refuses malformed or unknown sensor policy %#", ({ invalid }) => {
    expect(stageRefreshContract({ stage: invalid })).toEqual({ kind: "invalid" });
  });
});


const requiredSections = {
  id: "required-sections", path: ".claude/sensors/aidlc-required-sections.md",
  fire_on: "gate", default_severity: "advisory", category: "document-shape",
  matches: "**/{aidlc-docs,intents}/**",
};
const sensorStage = { ...stage, sensors: ["required-sections"], sensors_applicable: [requiredSections] };
const originalOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved)";
const engineOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)";

describe("bounded semantic refresh comparison", () => {
  test("normalizes only the known additive advisory gate coverage and identifies its normal recheck", () => {
    expect(stageRefreshComparison({ installed: sensorStage,
      candidate: { ...sensorStage, sensors_applicable: [{ ...requiredSections, matches: "**/{aidlc-docs,intents,codekb}/**" }] },
    })).toMatchObject({
      kind: "comparable", candidate: { sensors_applicable: [{
        id: "required-sections", path: ".claude/sensors/aidlc-required-sections.md",
        fire_on: "gate", default_severity: "advisory", category: "document-shape",
        matches: "**/{aidlc-docs,intents}/**",
      }] }, revalidation: ["gate-sensor-coverage"],
    });
  });
  test("normalizes only the exact Code Generation engine-question declaration", () => {
    expect(stageRefreshComparison({ installed: { ...stage, slug: "code-generation", outputs: originalOutputs },
      candidate: { ...stage, slug: "code-generation", outputs: engineOutputs },
    })).toMatchObject({
      kind: "comparable", candidate: { slug: "code-generation", outputs: originalOutputs },
      revalidation: ["plan-approval-questions"],
    });
  });
  test.each([
    { matches: "**/intents/**", expectedMatches: "**/intents/**" },
    { matches: "**/{aidlc-docs,intents,*}/**", expectedMatches: "**/{aidlc-docs,intents,*}/**" },
    { matches: "**/{aidlc-docs,intents}/**/*.md", expectedMatches: "**/{aidlc-docs,intents}/**/*.md" },
  ])("leaves unproven matcher transformation %# for strict comparison", ({ matches, expectedMatches }) => {
    expect(stageRefreshComparison({ installed: sensorStage,
      candidate: { ...sensorStage, sensors_applicable: [{ ...requiredSections, matches }] },
    })).toMatchObject({ kind: "comparable", candidate: { sensors_applicable: [{ matches: expectedMatches }] }, revalidation: [] });
  });
  test("does not normalize a blocking gate sensor", () => {
    expect(stageRefreshComparison({
      installed: { ...sensorStage, sensors_applicable: [{ ...requiredSections, default_severity: "blocking" }] },
      candidate: { ...sensorStage, sensors_applicable: [{ ...requiredSections, default_severity: "blocking", matches: "**/{aidlc-docs,intents,codekb}/**" }] },
    })).toMatchObject({ kind: "comparable", candidate: { sensors_applicable: [{ matches: "**/{aidlc-docs,intents,codekb}/**" }] }, revalidation: [] });
  });
  test("does not normalize narrowing back to the old coverage", () => {
    expect(stageRefreshComparison({
      installed: { ...sensorStage, sensors_applicable: [{ ...requiredSections, matches: "**/{aidlc-docs,intents,codekb}/**" }] },
      candidate: sensorStage,
    })).toMatchObject({ kind: "comparable", installed: { sensors_applicable: [{ matches: "**/{aidlc-docs,intents,codekb}/**" }] }, revalidation: [] });
  });
  test.each(["other-stage", "work"])("does not exempt questions prose on %s", (slug) => {
    expect(stageRefreshComparison({ installed: { ...stage, slug, outputs: originalOutputs },
      candidate: { ...stage, slug, outputs: engineOutputs },
    })).toMatchObject({ kind: "comparable", candidate: { outputs: engineOutputs }, revalidation: [] });
  });
  test("rejects unknown sensor policy before semantic comparison", () => {
    expect(stageRefreshComparison({ installed: sensorStage,
      candidate: { ...sensorStage, sensors_applicable: [{ ...requiredSections, enforcement: "blocking" }] },
    })).toEqual({ kind: "invalid" });
  });
});


test("proves preserved coverage for another literal-directory union without a version-specific exception", () => {
  expect(stageRefreshComparison({
    installed: { ...sensorStage, sensors_applicable: [{ ...requiredSections, matches: "**/design/**" }] },
    candidate: { ...sensorStage, sensors_applicable: [{ ...requiredSections, matches: "**/{design,architecture}/**" }] },
  })).toMatchObject({ kind: "comparable", candidate: { sensors_applicable: [{ matches: "**/design/**" }] },
    revalidation: ["gate-sensor-coverage"] });
});
