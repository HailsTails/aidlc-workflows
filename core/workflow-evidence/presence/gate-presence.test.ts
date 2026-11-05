import { expect, test } from "bun:test";
import { interpretGatePresence } from "./gate-presence.ts";
import type { PresenceEvidence } from "./presence-evidence.ts";

const absentEvidence: PresenceEvidence = Object.freeze({ kind: "missing" });
const consumedEvidence: PresenceEvidence = Object.freeze({
  kind: "consumed",
  boundaries: Object.freeze([Object.freeze({ timestamp: "02", shard: "one", position: 2 })]),
});

test("human approval refuses the same missing evidence autonomy does not require", () => {
  const humanAdmission = interpretGatePresence({ evidence: absentEvidence, requirement: { kind: "human-required" } });
  const autonomousAdmission = interpretGatePresence({ evidence: absentEvidence, requirement: { kind: "autonomous", authority: "stage-definition" } });
  expect(humanAdmission).toEqual({ kind: "refused", reason: "human-turn-missing", evidence: { kind: "missing" } });
  expect(autonomousAdmission).toEqual({ kind: "not-required", authority: "stage-definition", evidence: { kind: "missing" } });
  expect(humanAdmission.evidence).toBe(absentEvidence);
  expect(autonomousAdmission.evidence).toBe(absentEvidence);
});

test("autonomy changes the consequence of consumed evidence but not its provenance", () => {
  const humanAdmission = interpretGatePresence({ evidence: consumedEvidence, requirement: { kind: "human-required" } });
  const autonomousAdmission = interpretGatePresence({ evidence: consumedEvidence, requirement: { kind: "autonomous", authority: "construction-grant" } });
  expect(humanAdmission.kind).toBe("refused");
  expect(autonomousAdmission.kind).toBe("not-required");
  expect(humanAdmission.evidence).toBe(consumedEvidence);
  expect(autonomousAdmission.evidence).toBe(consumedEvidence);
  expect(consumedEvidence).toEqual({ kind: "consumed", boundaries: [{ timestamp: "02", shard: "one", position: 2 }] });
});

test("fresh evidence satisfies only the presence requirement", () => {
  expect(interpretGatePresence({ evidence: { kind: "fresh", witness: { timestamp: "02", shard: "one", position: 2 } }, requirement: { kind: "human-required" } }).kind).toBe("satisfied");
});

test("the inherited untracked-ledger exemption is never labelled human evidence", () => {
  expect(interpretGatePresence({ evidence: { kind: "untracked" }, requirement: { kind: "human-required" } })).toEqual({
    kind: "legacy-untracked-exemption", evidence: { kind: "untracked" },
  });
});

test("uncertain cross-shard ordering refuses a human-required gate", () => {
  expect(interpretGatePresence({ evidence: { kind: "unordered", turns: [], resolutions: [] }, requirement: { kind: "human-required" } })).toEqual({
    kind: "refused", reason: "ordering-unproven", evidence: { kind: "unordered", turns: [], resolutions: [] },
  });
});

test("unreadable evidence remains unavailable when human presence is required", () => {
  expect(interpretGatePresence({ evidence: { kind: "unavailable", reason: "unreadable-shard" }, requirement: { kind: "human-required" } })).toEqual({
    kind: "refused", reason: "ledger-unavailable", evidence: { kind: "unavailable", reason: "unreadable-shard" },
  });
});

test("autonomy preserves unavailable evidence without claiming a human witness", () => {
  const evidence: PresenceEvidence = { kind: "unavailable", reason: "unreadable-location" };
  const admission = interpretGatePresence({ evidence, requirement: { kind: "autonomous", authority: "stage-definition" } });
  expect(admission).toEqual({ kind: "not-required", authority: "stage-definition", evidence });
  expect(admission.evidence).toBe(evidence);
});

test("current construction policy does not falsely claim an explicit grant", () => {
  const admission = interpretGatePresence({ evidence: consumedEvidence, requirement: { kind: "autonomous", authority: "construction-policy" } });
  expect(admission).toEqual({ kind: "not-required", authority: "construction-policy", evidence: consumedEvidence });
  expect(admission.evidence).toBe(consumedEvidence);
});
