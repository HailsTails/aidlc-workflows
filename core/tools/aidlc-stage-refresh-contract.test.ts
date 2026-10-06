import { describe, expect, test } from "bun:test";
import { stageRefreshContract } from "./aidlc-stage-refresh-contract.ts";

const writeSensor = {
  id: "writer", path: ".claude/sensors/writer.md", fire_on: "write", default_severity: "advisory",
};
const gateSensor = { ...writeSensor, id: "gate", fire_on: "gate" };
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
    const blockingSensor = { ...writeSensor, default_severity: "blocking" };
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
