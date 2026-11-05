// covers: file:core/tools/aidlc-lib.ts, file:core/tools/aidlc-log.ts, file:core/tools/aidlc-state.ts
// Installed no-human controls, not live-host qualification or synthetic HUMAN_TURN delivery.
import { afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { cleanInstallFixture, writeFixtureFile, type InstallFixture } from "../harness/install-adoption.ts";
import { PRODUCTION_GUARD_OFF_SWITCHES } from "../harness/runner-profile.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { configureEvidenceInstallation, createInstallFixture, evidenceSourceSnapshot, installedAudit,
  installedDependenciesExist, installedGateInterpretations, installedObservation, installedState, runEvidenceCommand,
  EVIDENCE_RECORD, type EvidenceInstallation } from "../harness/workflow-evidence-installation.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
let fixture: InstallFixture;
let sources: string[];
beforeEach(() => { sources = evidenceSourceSnapshot(); fixture = createInstallFixture(); });
afterEach(() => {
  try { expect(evidenceSourceSnapshot()).toEqual(sources); }
  finally { cleanInstallFixture(fixture); }
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

function installed(request: { authority: "human" | "autonomous"; ordinaryAnswer?: boolean; requiresReview?: boolean }): EvidenceInstallation {
  const installation = configureEvidenceInstallation({ fixture, ...request });
  expect(installation.environment.AIDLC_TEST_GUARD_PROFILE).toBe("production");
  expect(PRODUCTION_GUARD_OFF_SWITCHES.map((key) => installation.environment[key]))
    .toEqual(PRODUCTION_GUARD_OFF_SWITCHES.map(() => "0"));
  expect(installedDependenciesExist(installation)).toBe(true);
  expect(installedObservation(installation)).toMatchObject({ evidence: { kind: "missing" }, compatibility: "none" });
  expect(installedAudit(installation)).not.toContain("**Event**: HUMAN_TURN");
  return installation;
}

function noPersonOrApprovalEvents(installation: EvidenceInstallation): void {
  const audit = installedAudit(installation);
  for (const event of ["HUMAN_TURN", "QUESTION_REPLIED", "QUESTION_ANSWERED", "GATE_APPROVED"])
    expect(audit).not.toContain(`**Event**: ${event}`);
}

function refusedWithoutStateChange(request: { installation: EvidenceInstallation; args: string[]; message: string }): void {
  const before = installedObservation(request.installation);
  const result = runEvidenceCommand(request);
  expect(`${result.stdout}\n${result.stderr}`).toContain(request.message);
  expect(installedState(request.installation)).toBe(request.installation.initialState);
  expect(installedObservation(request.installation)).toEqual(before);
  noPersonOrApprovalEvents(request.installation);
}

test("installed human approval refuses an explicit choice without a recorded human reply", () => {
  const installation = installed({ authority: "human" });
  writeFixtureFile({ root: fixture.project, path: `${EVIDENCE_RECORD}/ideation/feasibility/feasibility-report.md`, text: "# Synthetic feasibility report\n\nNonhuman fixture artifact for approval-boundary isolation.\n" });
  refusedWithoutStateChange({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "approved", "--user-input", "Approve"], message: "no new human reply" });
});

test("installed human rejection refuses agent feedback without a human reply", () => {
  const installation = installed({ authority: "human" });
  refusedWithoutStateChange({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "rejected", "--reason", "Change the synthetic model"], message: "no new human reply" });
});

test("installed ordinary answer reaches answer admission and refuses missing evidence", () => {
  const installation = installed({ authority: "human", ordinaryAnswer: true });
  expect(installation.initialState).toContain("- [-] feasibility");
  refusedWithoutStateChange({ installation, args: ["log", "answer", "--stage", "feasibility",
    "--details", "The proposed model needs another constraint"], message: "Cannot record this answer because no new human reply" });
});

test("installed autonomous rejection needs feedback without manufacturing a human reply", () => {
  const installation = installed({ authority: "autonomous" });
  refusedWithoutStateChange({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "rejected"], message: "requires nonblank revision feedback" });
});

test("installed autonomous rejection records revision while the human evidence remains missing", () => {
  const installation = installed({ authority: "autonomous" });
  const before = installedObservation(installation);
  const result = runEvidenceCommand({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "rejected", "--reason", "Change the synthetic model"] });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Recorded rejected");
  expect(installedState(installation)).not.toBe(installation.initialState);
  expect(installedState(installation)).toContain("- [R] feasibility");
  expect(installedState(installation)).toContain("**Revision Count**: 1");
  expect(installedAudit(installation)).toContain("**Event**: GATE_REJECTED");
  expect(installedObservation(installation)).toEqual(before);
  noPersonOrApprovalEvents(installation);
});

test("installed autonomous approval still refuses missing required artifacts", () => {
  const installation = installed({ authority: "autonomous" });
  refusedWithoutStateChange({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "approved"], message: "REQUIRED_ARTIFACTS_MISSING" });
});

test("installed unavailable ledger remains unavailable under both human and autonomous policy", () => {
  const installation = installed({ authority: "autonomous" });
  // A directory in the shard population is unreadable as an append-only file on every supported OS.
  mkdirSync(join(fixture.project, EVIDENCE_RECORD, "audit", "unreadable-fixture.md"));
  expect(installedGateInterpretations(installation)).toMatchObject({
    observation: { evidence: { kind: "unavailable", reason: "unreadable-shard" } },
    human: { kind: "refused", reason: "ledger-unavailable", evidence: { kind: "unavailable" } },
    autonomous: { kind: "not-required", authority: "stage-definition", evidence: { kind: "unavailable" } },
    unchanged: true, identityPreserved: true,
  });
  refusedWithoutStateChange({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "approved"], message: "REQUIRED_ARTIFACTS_MISSING" });
});

test("installed autonomous approval still requires reviewer evidence after the artifact exists", () => {
  const installation = installed({ authority: "autonomous", requiresReview: true });
  writeFixtureFile({ root: fixture.project, path: `${EVIDENCE_RECORD}/ideation/feasibility/feasibility-report.md`,
    text: "# Synthetic feasibility report\n\nNonhuman fixture artifact, not a review or approval.\n" });
  refusedWithoutStateChange({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "approved"], message: "REVIEW_EVIDENCE_MISSING" });
});

test("installed autonomous approval traverses unavailable evidence without relabeling it as human presence", () => {
  const installation = installed({ authority: "autonomous" });
  mkdirSync(join(fixture.project, EVIDENCE_RECORD, "audit", "unreadable-fixture.md"));
  writeFixtureFile({ root: fixture.project, path: `${EVIDENCE_RECORD}/ideation/feasibility/feasibility-report.md`,
    text: "# Synthetic feasibility report\n\nNonhuman fixture artifact, not a review or human decision.\n" });
  const before = installedObservation(installation);
  expect(before).toMatchObject({ evidence: { kind: "unavailable", reason: "unreadable-shard" }, compatibility: "none" });
  const result = runEvidenceCommand({ installation, args: ["orchestrate", "report", "--stage", "feasibility",
    "--result", "approved"] });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Committed approve");
  expect(installedState(installation)).toContain("- [x] feasibility");
  expect(installedObservation(installation)).toEqual(before);
  const audit = installedAudit(installation);
  expect(audit).toContain("**Event**: GATE_APPROVED");
  expect(audit).toContain("**Event**: STAGE_COMPLETED");
  for (const event of ["HUMAN_TURN", "QUESTION_REPLIED", "QUESTION_ANSWERED"])
    expect(audit).not.toContain(`**Event**: ${event}`);
  expect(audit).not.toContain("**User Input**:");
  expect(audit).not.toContain("**Person Reply**:");
});
