// covers: function:isAutonomousStage, function:stageRoutesItself, function:engineErrorRelayNote, function:stageAgentResetUsed, function:spentReviewStep, function:decodeGateRejection, hook:aidlc-rebuild-stage-graph, cli:aidlc-orchestrate(report), cli:aidlc-orchestrate(next), cli:aidlc-state(approve), cli:aidlc-state(reject), cli:aidlc-jump(execute)
//
// A stage whose approval_mode is autonomous has nobody reading it. Text the
// engine writes for that stage must not promise a review, send the agent to a
// person, or tell it to wait for a reply, because an agent obeys those words and
// the work stops. Every refusal stays a refusal: only the words change, and a
// human stage keeps its words exactly.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import {
  AGENT_DECIDED_FIELD,
  decodeGateRejection,
  engineErrorRelayNote,
  ENGINE_ERROR_RELAY_NOTE,
  isAttemptBoundary,
  isAutonomousStage,
  jumpResetsReview,
  personRequestedChanges,
  readAllAuditShards,
  recordGateWords,
  spentReviewStep,
  stageIsTeamUnitGate,
  stageAgentResetUsed,
  stageRoutesItself,
} from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import {
  AIDLC_SRC,
  cleanupTestProject,
  createTestProject,
  FIXTURES_DIR,
  REPO_ROOT,
  seedAidlcMemory,
  seededRecordDir,
  seededStateFile,
  seedStateFile,
} from "../harness/fixtures.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

type ApprovalMode = "human" | "autonomous";

type Fixture = {
  readonly project: string;
  readonly graph: string;
};

type ToolResult = {
  readonly status: number;
  readonly stdout: string;
  readonly out: string;
};

const BUN = process.execPath;
const STATE_TOOL = join(AIDLC_SRC, "tools", "aidlc-state.ts");
const ORCHESTRATE_TOOL = join(AIDLC_SRC, "tools", "aidlc-orchestrate.ts");
const LOG_TOOL = join(AIDLC_SRC, "tools", "aidlc-log.ts");
const JUMP_TOOL = join(AIDLC_SRC, "tools", "aidlc-jump.ts");
const BOLT_TOOL = join(AIDLC_SRC, "tools", "aidlc-bolt.ts");
const AUDIT_TOOL = join(AIDLC_SRC, "tools", "aidlc-audit.ts");
const REBUILD_HOOK = join(AIDLC_SRC, "hooks", "aidlc-rebuild-stage-graph.ts");
const SHIPPED_GRAPH = join(AIDLC_SRC, "tools", "data", "stage-graph.json");
const REVIEWER_PROTOCOL = join(REPO_ROOT, "core", "aidlc-common", "protocols", "stage-protocol-reviewer.md");
const REVIEWER = "aidlc-product-lead-agent";
const PERSON_ADDRESSED = /your review|your input|Wait for the human|end the turn|ask the person|the human at the approval gate/i;

const projects: string[] = [];
afterAll(() => {
  projects.splice(0).forEach((project) => {
    cleanupTestProject(project);
  });
});

function fixtureAt({
  stateFile,
  stage,
  approvalMode,
}: {
  readonly stateFile: string;
  readonly stage: string;
  readonly approvalMode: ApprovalMode;
}): Fixture {
  const project = createTestProject();
  projects.push(project);
  seedAidlcMemory(project);
  seedStateFile(project, stateFile);
  const graph = join(project, "stage-graph.json");
  const shipped: ReadonlyArray<{ readonly slug: string }> = JSON.parse(readFileSync(SHIPPED_GRAPH, "utf-8"));
  writeFileSync(
    graph,
    JSON.stringify(shipped.map((entry) => (entry.slug === stage ? { ...entry, approval_mode: approvalMode } : entry))),
  );
  return { project, graph };
}

function toolEnvironment({
  fixture,
  extra = {},
}: {
  readonly fixture: Fixture;
  readonly extra?: Record<string, string>;
}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    AIDLC_STAGE_GRAPH: fixture.graph,
    AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS: "1",
    AIDLC_SKIP_ARTIFACT_GUARD: "1",
    AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD: "1",
    ...extra,
  };
  delete environment.AIDLC_SKIP_HUMAN_PRESENCE_GUARD;
  delete environment.AIDLC_UNATTENDED;
  return environment;
}

function runTool({
  tool,
  args,
  fixture,
  extra,
}: {
  readonly tool: string;
  readonly args: readonly string[];
  readonly fixture: Fixture;
  readonly extra?: Record<string, string>;
}): ToolResult {
  const result = spawnSync(BUN, [tool, ...args, "--project-dir", fixture.project], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    encoding: "utf-8",
    env: toolEnvironment({ fixture, extra }),
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function lastDirective(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout.trim().split("\n").filter((line) => line.startsWith("{")).at(-1) ?? "{}");
}

function stageEntryDirective({ fixture }: { readonly fixture: Fixture }): Record<string, unknown> {
  const first = lastDirective(runTool({ tool: ORCHESTRATE_TOOL, args: ["next"], fixture }).stdout);
  const hops = Array.from({ length: 10 });
  return hops.reduce<Record<string, unknown>>(
    (directive) =>
      directive.kind === "load-steering"
        ? lastDirective(runTool({ tool: ORCHESTRATE_TOOL, args: ["continue", String(directive.receipt)], fixture }).stdout)
        : directive,
    first,
  );
}

function firstStageFixture({ approvalMode }: { readonly approvalMode: ApprovalMode }): Fixture {
  const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode });
  const statePath = seededStateFile(fixture.project);
  writeFileSync(
    statePath,
    readFileSync(statePath, "utf-8")
      .replace("- [x] intent-capture — EXECUTE", "- [ ] intent-capture — SKIP")
      .replace("- [x] market-research — EXECUTE", "- [ ] market-research — SKIP"),
  );
  return fixture;
}

function feasibilityDone({ approvalMode }: { readonly approvalMode: ApprovalMode }): Fixture {
  const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode });
  const directory = join(seededRecordDir(fixture.project), "ideation", "feasibility");
  mkdirSync(directory, { recursive: true });
  ["feasibility-assessment", "constraint-register", "raid-log", "feasibility-questions"].forEach((name) => {
    writeFileSync(join(directory, `${name}.md`), `# ${name}\n\nDone.\n`);
  });
  return fixture;
}

function recordReadyReview({ fixture }: { readonly fixture: Fixture }): void {
  const directory = join(seededRecordDir(fixture.project), "inception", "requirements-analysis");
  mkdirSync(directory, { recursive: true });
  ["requirements.md", "requirements-analysis-questions.md"].forEach((name) => {
    const path = join(directory, name);
    if (!existsSync(path)) writeFileSync(path, `# ${name}\n`);
  });
  const review = ["review", "--stage", "requirements-analysis", "--reviewer", REVIEWER, "--iteration", "1"];
  const requested = runTool({ tool: LOG_TOOL, args: review, fixture });
  expect(requested.status, requested.out).toBe(0);
  const { reviewFile }: { readonly reviewFile: string } = JSON.parse(requested.out);
  mkdirSync(dirname(join(fixture.project, reviewFile)), { recursive: true });
  writeFileSync(
    join(fixture.project, reviewFile),
    `**Verdict:** READY\n**Reviewer:** ${REVIEWER}\n**Iteration:** 1\n\n### Findings\n\nNo blocking findings.\n`,
    "utf-8",
  );
  const recorded = runTool({ tool: LOG_TOOL, args: [...review, "--verdict", "READY"], fixture });
  expect(recorded.status, recorded.out).toBe(0);
}

function staleReviewRefusal({ approvalMode }: { readonly approvalMode: ApprovalMode }): ToolResult {
  const fixture = fixtureAt({
    stateFile: join(FIXTURES_DIR, "state-mid-inception.md"),
    stage: "requirements-analysis",
    approvalMode,
  });
  recordReadyReview({ fixture });
  appendAuditEntry(
    "ARTIFACT_UPDATED",
    {
      File: join(seededRecordDir(fixture.project), "inception", "requirements-analysis", "requirements.md"),
      Tool: "Edit",
      Context: "inception > requirements-analysis > requirements.md",
    },
    fixture.project,
  );
  return runTool({
    tool: STATE_TOOL,
    args: ["gate-start", "requirements-analysis"],
    fixture,
    extra: { AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" },
  });
}

function approveWith({
  approvalMode,
  userInput,
}: {
  readonly approvalMode: ApprovalMode;
  readonly userInput: string;
}): ToolResult {
  const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode });
  const opened = runTool({ tool: STATE_TOOL, args: ["gate-start", "feasibility"], fixture });
  expect(opened.status, opened.out).toBe(0);
  return runTool({ tool: STATE_TOOL, args: ["approve", "feasibility", "--user-input", userInput], fixture });
}

function rejectWithout({ approvalMode, feedback }: { readonly approvalMode: ApprovalMode; readonly feedback: readonly string[] }): ToolResult {
  const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode });
  const opened = runTool({ tool: STATE_TOOL, args: ["gate-start", "feasibility"], fixture });
  expect(opened.status, opened.out).toBe(0);
  return runTool({ tool: STATE_TOOL, args: ["reject", "feasibility", ...feedback], fixture });
}

function relayedNote({ approvalMode }: { readonly approvalMode: ApprovalMode }): string {
  return relayedNoteFor({
    fixture: fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode }),
  });
}

function relayedNoteFor({ fixture }: { readonly fixture: Fixture }): string {
  const payload = {
    hook_event_name: "PostToolUse",
    session_id: "t-autonomous-stage-no-reader",
    tool_name: "Bash",
    tool_input: { command: "bun .claude/tools/aidlc.ts engine orchestrate next" },
    tool_response: {
      stdout: `${JSON.stringify({ kind: "error", message: "Stage graph mismatch." })}\n`,
      stderr: "",
      interrupted: false,
    },
  };
  const result = spawnSync(BUN, [REBUILD_HOOK], {
    input: JSON.stringify(payload),
    encoding: "utf-8",
    env: {
      ...toolEnvironment({ fixture }),
      CLAUDE_PROJECT_DIR: fixture.project,
      AIDLC_PROJECT_DIR: fixture.project,
      AIDLC_HARNESS_NAME: "claude",
    },
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  const relay: { readonly hookSpecificOutput: { readonly additionalContext: string } } = JSON.parse(
    (result.stdout ?? "").trim().split("\n")[0] ?? "{}",
  );
  return relay.hookSpecificOutput.additionalContext;
}

describe("the shared stage predicates", () => {
  test("only an autonomous approval_mode has no reader", () => {
    expect(isAutonomousStage({ approval_mode: "autonomous" })).toBe(true);
    expect(isAutonomousStage({ approval_mode: "human" })).toBe(false);
    expect(isAutonomousStage({})).toBe(false);
    expect(isAutonomousStage(undefined)).toBe(false);
  });

  test("a stage routes itself only outside the Construction autonomy grant, whose park stays human", () => {
    const stage = { approval_mode: "autonomous" } as const;
    expect(stageRoutesItself(stage, "- **Construction Autonomy Mode**: unset\n")).toBe(true);
    expect(stageRoutesItself(stage, "- **Construction Autonomy Mode**: autonomous\n")).toBe(false);
    expect(stageRoutesItself({ approval_mode: "human" }, "- **Construction Autonomy Mode**: unset\n")).toBe(false);
  });
});

describe("stage narration", () => {
  test("the first stage of a workflow promises no review on an autonomous stage", () => {
    const directive = stageEntryDirective({ fixture: firstStageFixture({ approvalMode: "autonomous" }) });
    expect(directive.kind).toBe("run-stage");
    expect(String(directive.narration)).toContain("First step is Feasibility");
    expect(String(directive.narration)).not.toMatch(PERSON_ADDRESSED);
  });

  test("the first stage of a workflow keeps its promise on a human stage", () => {
    const directive = stageEntryDirective({ fixture: firstStageFixture({ approvalMode: "human" }) });
    expect(directive.kind).toBe("run-stage");
    expect(String(directive.narration)).toEndWith("and I will stop for your review before anything is final.");
  });

  test("an open gate says where the output is, with no review offered, on an autonomous stage", () => {
    const fixture = feasibilityDone({ approvalMode: "autonomous" });
    const opened = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "awaiting-approval"],
      fixture,
      extra: { AIDLC_SKIP_REVIEWER_GATE_GUARD: "1" },
    });
    expect(opened.status, opened.out).toBe(0);
    const narration = String(lastDirective(opened.stdout).narration);
    expect(narration).toMatch(/what it produced is in aidlc\/spaces\/default\/intents\/[^/]+\/ideation\/feasibility\/\.$/);
    expect(narration).not.toMatch(PERSON_ADDRESSED);
  });

  test("an open gate offers the review on a human stage", () => {
    const fixture = feasibilityDone({ approvalMode: "human" });
    const opened = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "awaiting-approval"],
      fixture,
      extra: { AIDLC_SKIP_REVIEWER_GATE_GUARD: "1" },
    });
    expect(opened.status, opened.out).toBe(0);
    expect(String(lastDirective(opened.stdout).narration)).toContain("is ready for your review: what it produced is in ");
  });
});

describe("approval refusals", () => {
  test("an agent-supplied choice on an autonomous stage is still refused, and the step is to drop it", () => {
    const refused = approveWith({ approvalMode: "autonomous", userInput: "Approve" });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("report approved without --user-input");
    expect(refused.out).not.toMatch(PERSON_ADDRESSED);
  });

  test("the same choice on a human stage still waits for the human", () => {
    const refused = approveWith({ approvalMode: "human", userInput: "Approve" });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("Wait for the human to type their choice");
  });

  test("a self-attributed choice on an autonomous stage is still refused, and sends the agent nowhere", () => {
    const refused = approveWith({ approvalMode: "autonomous", userInput: "The assistant chose this approval." });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("says the choice came from the assistant");
    expect(refused.out).toContain("report approved without --user-input");
    expect(refused.out).not.toMatch(PERSON_ADDRESSED);
  });

  test("a self-attributed choice on a human stage still ends the turn", () => {
    const refused = approveWith({ approvalMode: "human", userInput: "The assistant chose this approval." });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("end the turn and let them answer");
  });

  test("cancellation text on an autonomous stage is still refused, with no gate to re-present", () => {
    const refused = approveWith({ approvalMode: "autonomous", userInput: "User cancelled" });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("cancellation boilerplate");
    expect(refused.out).toContain("report approved without --user-input");
    expect(refused.out).not.toContain("Re-present the original held gate");
  });

  test("cancellation text on a human stage still re-presents the gate", () => {
    const refused = approveWith({ approvalMode: "human", userInput: "User cancelled" });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("Re-present the original held gate");
  });
});

describe("rejection refusals", () => {
  test("a rejection with no feedback on an autonomous stage is still refused, and names the agent's own reason", () => {
    const refused = rejectWithout({ approvalMode: "autonomous", feedback: [] });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("pass the reason this stage needs revising");
    expect(refused.out).not.toMatch(PERSON_ADDRESSED);
    expect(refused.out).not.toContain("What should change?");
  });

  test("a rejection with no feedback on a human stage still asks the person", () => {
    const refused = rejectWithout({ approvalMode: "human", feedback: [] });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain('Ask \\"What should change?\\"');
  });

  test("cancellation text as feedback on an autonomous stage is still refused, with no gate to re-present", () => {
    const refused = rejectWithout({ approvalMode: "autonomous", feedback: ["--feedback", "User cancelled"] });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("cancellation boilerplate");
    expect(refused.out).not.toContain("Re-present the original held gate");
  });

  test("cancellation text as feedback on a human stage still re-presents the gate", () => {
    const refused = rejectWithout({ approvalMode: "human", feedback: ["--feedback", "User cancelled"] });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("Re-present the original held gate");
  });

  test("the rejection the refusals point to is one the engine records with no person", () => {
    const fixture = feasibilityDone({ approvalMode: "autonomous" });
    const rejected = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "rejected", "--reason", "The review attempt is spent."],
      fixture,
      extra: { AIDLC_SKIP_REVIEWER_GATE_GUARD: "1" },
    });
    expect(rejected.status, rejected.out).toBe(0);
    expect(readFileSync(seededStateFile(fixture.project), "utf-8")).toContain("- [R] feasibility — EXECUTE");
  });
});

describe("a stale review", () => {
  test("is still refused on an autonomous stage, and the way out is the stage's own rejection", () => {
    const refused = staleReviewRefusal({ approvalMode: "autonomous" });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("one recovery review pass");
    expect(refused.out).toContain("Report this stage rejected");
    expect(refused.out).not.toContain("at the approval gate; a human");
    expect(refused.out).not.toContain("on the human's behalf");
  });

  test("keeps the human gate on a human stage", () => {
    const refused = staleReviewRefusal({ approvalMode: "human" });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("present the situation to the human at the approval gate");
    expect(refused.out).toContain("Do not record a rejection on the human's behalf");
  });
});

describe("what report delivers", () => {
  const PERSON_DIRECTED = /would you like|Tell me how|never answer it for the person|is still open|ask the person|What should change|on the human's behalf/i;

  function openFeasibilityGate({ approvalMode }: { readonly approvalMode: ApprovalMode }): Fixture {
    const fixture = feasibilityDone({ approvalMode });
    const opened = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "awaiting-approval"],
      fixture,
      extra: { AIDLC_SKIP_REVIEWER_GATE_GUARD: "1" },
    });
    expect(opened.status, opened.out).toBe(0);
    return fixture;
  }

  function reportApprovedWithChoice({ fixture }: { readonly fixture: Fixture }): ToolResult {
    return runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "approved", "--user-input", "Approve"],
      fixture,
      extra: { AIDLC_SKIP_REVIEWER_GATE_GUARD: "1" },
    });
  }

  test("a refused approval on an autonomous stage is the agent's next step, with no question left open", () => {
    const directive = lastDirective(reportApprovedWithChoice({ fixture: openFeasibilityGate({ approvalMode: "autonomous" }) }).stdout);
    expect(directive.kind).toBe("print");
    expect(JSON.stringify(directive)).toContain("report approved without --user-input");
    expect(JSON.stringify(directive)).not.toMatch(PERSON_DIRECTED);
  });

  test("the same refusal on a human stage keeps the open question", () => {
    const directive = lastDirective(reportApprovedWithChoice({ fixture: openFeasibilityGate({ approvalMode: "human" }) }).stdout);
    expect(JSON.stringify(directive)).toContain("is still open");
  });

  test("a stage being revised on an autonomous stage is not told to ask a person", () => {
    const fixture = openFeasibilityGate({ approvalMode: "autonomous" });
    const extra = { AIDLC_SKIP_REVIEWER_GATE_GUARD: "1" };
    const rejected = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "rejected", "--reason", "The output needs another pass."],
      fixture,
      extra,
    });
    expect(rejected.status, rejected.out).toBe(0);
    const reopened = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["report", "--stage", "feasibility", "--result", "awaiting-approval"],
      fixture,
      extra,
    });
    expect(JSON.stringify(lastDirective(reopened.stdout))).toContain("--result revised");
    expect(JSON.stringify(lastDirective(reopened.stdout))).not.toMatch(PERSON_DIRECTED);
  });

  test("a guard refusal an autonomous stage cannot clear itself asks nobody and names the park", () => {
    const fixture = fixtureAt({
      stateFile: join(FIXTURES_DIR, "state-mid-inception.md"),
      stage: "requirements-analysis",
      approvalMode: "autonomous",
    });
    recordReadyReview({ fixture });
    appendAuditEntry(
      "ARTIFACT_UPDATED",
      {
        File: join(seededRecordDir(fixture.project), "inception", "requirements-analysis", "requirements.md"),
        Tool: "Edit",
        Context: "inception > requirements-analysis > requirements.md",
      },
      fixture.project,
    );
    const report = (): Record<string, unknown> =>
      lastDirective(
        runTool({
          tool: ORCHESTRATE_TOOL,
          args: ["report", "--stage", "requirements-analysis", "--result", "awaiting-approval"],
          fixture,
        }).stdout,
      );
    const [first, repeated] = [report(), report()];
    expect(repeated.agent_work).toBe(true);
    expect(repeated.state_signature).toBeUndefined();
    expect(JSON.stringify(repeated)).toContain("park");
    [first, repeated].forEach((directive) => {
      expect(JSON.stringify(directive)).not.toMatch(PERSON_DIRECTED);
      expect(JSON.stringify(directive)).not.toContain("This question is for the person");
    });
  });
});

describe("the one agent reset", () => {
  const agentRejection = { Stage: "feasibility", Feedback: "Two rounds spent.", ...AGENT_DECIDED_FIELD };
  const personRejection = { Stage: "feasibility", Feedback: "Please redo this." };
  const rejectArgs = ["reject", "feasibility", "--feedback", "A third round is needed."];

  function openStage({ approvalMode }: { readonly approvalMode: ApprovalMode }): Fixture {
    const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode });
    const opened = runTool({ tool: STATE_TOOL, args: ["gate-start", "feasibility"], fixture });
    expect(opened.status, opened.out).toBe(0);
    return fixture;
  }

  function audit({ fixture }: { readonly fixture: Fixture }): string {
    return readAllAuditShards(fixture.project);
  }

  function personSays({ fixture, words }: { readonly fixture: Fixture; readonly words: string }): void {
    Bun.sleepSync(1100);
    appendAuditEntry("HUMAN_TURN", { Session: "person-session" }, fixture.project);
    recordGateWords(fixture.project, "person-session", words);
  }

  function reviewedStage(): Fixture {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("REVIEW_REQUESTED", { Stage: "feasibility", Reviewer: REVIEWER, Iteration: "1" }, fixture.project);
    return fixture;
  }

  function jumpHere(direction: string): readonly string[] {
    return ["execute", "--target", "feasibility", "--direction", direction, "--reason", "Spent."];
  }

  test("is recorded in the agent's name", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(rejected.status, rejected.out).toBe(0);
    expect(audit({ fixture })).toContain("**Decided By**: agent");
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
  });

  test("a person's rejection on a human stage is not recorded as the agent's", () => {
    const fixture = openStage({ approvalMode: "human" });
    appendAuditEntry("HUMAN_TURN", { Prompt: "Redo it." }, fixture.project);
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(rejected.status, rejected.out).toBe(0);
    expect(audit({ fixture })).not.toContain("**Decided By**");
  });

  test("a second reset is refused and names the park", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    const refused = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("used its one agent reset");
    expect(refused.out).toContain("park");
    expect(readFileSync(seededStateFile(fixture.project), "utf-8")).not.toContain("- [R] feasibility");
  });

  test("the agent naming Request Changes itself is refused", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    const refused = runTool({ tool: STATE_TOOL, args: [...rejectArgs, "--user-input", "Request Changes"], fixture });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("used its one agent reset");
  });

  test("a launch prompt that reads as a human turn does not lift the refusal, with or without the flag", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    personSays({ fixture, words: "Run the lane." });
    const refused = runTool({ tool: STATE_TOOL, args: [...rejectArgs, "--user-input", "Request Changes"], fixture });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("used its one agent reset");
  });

  test("a person's Request Changes is accepted, is not the agent's, and grants one more reset", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    personSays({ fixture, words: "Request Changes: rework it." });
    const accepted = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(accepted.status, accepted.out).toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(false);
  });

  test("a person's Request Changes with the reset unused is not recorded as the agent's", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    personSays({ fixture, words: "Request Changes: rework it." });
    const accepted = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(accepted.status, accepted.out).toBe(0);
    expect(audit({ fixture })).toContain("**Decided By**: person");
    expect(audit({ fixture })).not.toContain("**Decided By**: agent");
  });

  test.each(["STAGE_JUMPED", "STAGE_STARTED", "WORKFLOW_STARTED"])("the public audit CLI cannot write %s", (event) => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    const forged = runTool({
      tool: AUDIT_TOOL,
      args: ["append", event, "--field", "Target=feasibility", "--field", "Stage=feasibility", "--field", "Decided By=person"],
      fixture,
    });
    expect(forged.status).not.toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
  });

  test("a person's words grant one reset, never a second", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    personSays({ fixture, words: "Request Changes: rework it." });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
    expect(personRequestedChanges(fixture.project, "feasibility")).toBe(false);
  });

  test("a person's words at an earlier stage do not reach a stage entered after them", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    personSays({ fixture, words: "Request Changes: rework it." });
    Bun.sleepSync(1100);
    appendAuditEntry("STAGE_STARTED", { Stage: "feasibility", Agent: "agent" }, fixture.project);
    expect(personRequestedChanges(fixture.project, "feasibility")).toBe(false);
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(rejected.status, rejected.out).toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
  });

  test("a machine backfill neither spends the reset nor grants one", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", { ...personRejection, Recovered: "true" }, fixture.project);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(false);
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    appendAuditEntry("GATE_REJECTED", { ...personRejection, Recovered: "true" }, fixture.project);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
  });

  test("a rejection of one Unit does not touch the stage's reset", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    appendAuditEntry("GATE_REJECTED", { ...personRejection, Unit: "billing" }, fixture.project);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
  });

  test("a redo spends the reset once the stage has been reviewed, and a redo after it is refused", () => {
    const fixture = reviewedStage();
    const first = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(first.status, first.out).toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
    const second = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(second.status).not.toBe(0);
    expect(second.out).toContain("used its one agent reset");
  });

  test("past the pass cap, a launch prompt does not ask for a review and a person's Request Changes does", () => {
    const fixture = fixtureAt({
      stateFile: join(FIXTURES_DIR, "state-mid-inception.md"),
      stage: "requirements-analysis",
      approvalMode: "autonomous",
    });
    recordReadyReview({ fixture });
    const iteration = spendReviewPasses({ fixture, iteration: 2 });
    const request = ["review", "--stage", "requirements-analysis", "--reviewer", REVIEWER, "--iteration", String(iteration)];
    personSays({ fixture, words: "Run the lane." });
    const launched = runTool({ tool: LOG_TOOL, args: request, fixture });
    expect(launched.status).not.toBe(0);
    personSays({ fixture, words: "Request Changes: review it again." });
    const asked = runTool({ tool: LOG_TOOL, args: request, fixture });
    expect(asked.status, asked.out).toBe(0);
  });

  function spendReviewPasses({ fixture, iteration }: { readonly fixture: Fixture; readonly iteration: number }): number {
    const review = ["review", "--stage", "requirements-analysis", "--reviewer", REVIEWER, "--iteration", String(iteration)];
    const requested = runTool({ tool: LOG_TOOL, args: review, fixture });
    if (requested.status !== 0) return iteration;
    const { reviewFile }: { readonly reviewFile: string } = JSON.parse(requested.out);
    writeFileSync(
      join(fixture.project, reviewFile),
      `**Verdict:** NOT-READY\n**Reviewer:** ${REVIEWER}\n**Iteration:** ${iteration}\n\n### Findings\n\nOne blocking finding.\n`,
      "utf-8",
    );
    const recorded = runTool({ tool: LOG_TOOL, args: [...review, "--verdict", "NOT-READY"], fixture });
    expect(recorded.status, recorded.out).toBe(0);
    return spendReviewPasses({ fixture, iteration: iteration + 1 });
  }

  test("the Construction grant does not lift the one reset or make a restart free", () => {
    const fixture = reviewedStage();
    const state = seededStateFile(fixture.project);
    writeFileSync(state, `${readFileSync(state, "utf-8")}\n- **Construction Autonomy Mode**: autonomous\n`);
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(rejected.status).not.toBe(0);
    expect(rejected.out).toContain("used its one agent reset");
    const restarted = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(restarted.status).not.toBe(0);
    expect(restarted.out).toContain("used its one agent reset");
  });

  function spentRecoveryUnderGrant(): Fixture {
    const fixture = fixtureAt({
      stateFile: join(FIXTURES_DIR, "state-mid-inception.md"),
      stage: "requirements-analysis",
      approvalMode: "autonomous",
    });
    const state = seededStateFile(fixture.project);
    writeFileSync(state, `${readFileSync(state, "utf-8")}\n- **Construction Autonomy Mode**: autonomous\n`);
    recordReadyReview({ fixture });
    const artifact = {
      File: join(seededRecordDir(fixture.project), "inception", "requirements-analysis", "requirements.md"),
      Tool: "Edit",
      Context: "inception > requirements-analysis > requirements.md",
    };
    appendAuditEntry("ARTIFACT_UPDATED", artifact, fixture.project);
    const review = ["review", "--stage", "requirements-analysis", "--reviewer", REVIEWER, "--iteration", "2"];
    const requested = runTool({ tool: LOG_TOOL, args: review, fixture });
    expect(requested.status, requested.out).toBe(0);
    const { reviewFile }: { readonly reviewFile: string } = JSON.parse(requested.out);
    writeFileSync(
      join(fixture.project, reviewFile),
      `**Verdict:** READY\n**Reviewer:** ${REVIEWER}\n**Iteration:** 2\n\n### Findings\n\nNo blocking findings.\n`,
      "utf-8",
    );
    const recorded = runTool({ tool: LOG_TOOL, args: [...review, "--verdict", "READY"], fixture });
    expect(recorded.status, recorded.out).toBe(0);
    appendAuditEntry("ARTIFACT_UPDATED", artifact, fixture.project);
    return fixture;
  }

  test("under an unattended grant, the steps a spent stage names run, so the stage parks rather than strands", () => {
    const fixture = reviewedStage();
    const state = seededStateFile(fixture.project);
    writeFileSync(state, `${readFileSync(state, "utf-8")}\n- **Construction Autonomy Mode**: autonomous\n`);
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    const unattended = { AIDLC_UNATTENDED: "1" };
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture, extra: unattended });
    expect(rejected.status).not.toBe(0);
    expect(rejected.out).toContain("set-autonomy --mode gated");
    const gated = runTool({ tool: BOLT_TOOL, args: ["set-autonomy", "--mode", "gated"], fixture, extra: unattended });
    expect(gated.status, gated.out).toBe(0);
    const parked = runTool({ tool: ORCHESTRATE_TOOL, args: ["park"], fixture, extra: unattended });
    expect(parked.status, parked.out).toBe(0);
    expect(readFileSync(state, "utf-8")).toContain("Parked At Stage");
  });

  function unitStage(): Fixture {
    return fixtureAt({ stateFile: "state-mid-inception.md", stage: "code-generation", approvalMode: "autonomous" });
  }

  const reopenUnit = ["reopen", "--target", "code-generation", "--units", "alpha"];

  test("a reopen of a Unit on a stage nobody reads is refused and writes no row", () => {
    const fixture = unitStage();
    personSays({ fixture, words: "Run the lane." });
    const reopened = runTool({ tool: JUMP_TOOL, args: reopenUnit, fixture });
    expect(reopened.status).not.toBe(0);
    expect(reopened.out).toContain("only a person's Request Changes");
    expect(audit({ fixture })).not.toContain("GATE_REJECTED");
  });

  test("a person's Request Changes reopens that Unit, and the row says so", () => {
    const fixture = unitStage();
    personSays({ fixture, words: "Request Changes: redo the unit." });
    const reopened = runTool({ tool: JUMP_TOOL, args: reopenUnit, fixture });
    expect(reopened.status, reopened.out).toBe(0);
    expect(audit({ fixture })).toContain("**Decided By**: person");
  });

  test("under the grant, a spent recovery with no turn since the gate stays refused and spends nothing", () => {
    const fixture = spentRecoveryUnderGrant();
    const reject = ["reject", "requirements-analysis", "--reason", "Spent."];
    const rejected = runTool({ tool: STATE_TOOL, args: reject, fixture });
    expect(rejected.status).not.toBe(0);
    expect(rejected.out).toContain("its recovery review has already been used");
    expect(stageAgentResetUsed(fixture.project, "requirements-analysis")).toBe(false);
  });

  test("under the grant, a spent recovery keeps the check on who wrote the feedback", () => {
    const fixture = spentRecoveryUnderGrant();
    personSays({ fixture, words: "Run the lane." });
    const reject = ["reject", "requirements-analysis", "--feedback", "This rejection was generated by the AI."];
    const rejected = runTool({ tool: STATE_TOOL, args: reject, fixture });
    expect(rejected.status).not.toBe(0);
    expect(rejected.out).toContain("says it was written by the assistant");
    expect(stageAgentResetUsed(fixture.project, "requirements-analysis")).toBe(false);
  });

  test("under the grant, a launch prompt after a spent recovery buys a counted reset, never one that reads as a person's", () => {
    const fixture = spentRecoveryUnderGrant();
    personSays({ fixture, words: "Run the lane." });
    const reject = ["reject", "requirements-analysis", "--reason", "Spent."];
    const rejected = runTool({ tool: STATE_TOOL, args: reject, fixture });
    expect(rejected.status, rejected.out).toBe(0);
    expect(audit({ fixture })).toContain("**Decided By**: agent");
    expect(stageAgentResetUsed(fixture.project, "requirements-analysis")).toBe(true);
  });

  test("a restart that spends the reset must give its cause, and the row carries it", () => {
    const fixture = reviewedStage();
    const silent = runTool({ tool: JUMP_TOOL, args: ["execute", "--target", "feasibility", "--direction", "redo"], fixture });
    expect(silent.status).not.toBe(0);
    expect(silent.out).toContain("--reason");
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(false);
    const stated = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(stated.status, stated.out).toBe(0);
    expect(audit({ fixture })).toContain("**Reason**: Spent.");
  });

  test("a redo of a stage nothing has reviewed spends nothing", () => {
    const fixture = openStage({ approvalMode: "autonomous" });
    const redone = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(redone.status, redone.out).toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(false);
  });

  test.each(["forward", "backward"])("a jump to the same stage named %s spends the reset too", (direction) => {
    const fixture = reviewedStage();
    const first = runTool({ tool: JUMP_TOOL, args: jumpHere(direction), fixture });
    expect(first.status, first.out).toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
    const second = runTool({ tool: JUMP_TOOL, args: jumpHere(direction), fixture });
    expect(second.status).not.toBe(0);
  });

  test("stepping back a stage and forward again cannot restore a spent reset", () => {
    const fixture = reviewedStage();
    appendAuditEntry("GATE_REJECTED", agentRejection, fixture.project);
    const back = runTool({ tool: JUMP_TOOL, args: ["execute", "--target", "market-research", "--direction", "backward"], fixture });
    expect(back.status, back.out).toBe(0);
    const forward = runTool({ tool: JUMP_TOOL, args: jumpHere("forward"), fixture });
    expect(forward.status).not.toBe(0);
    expect(forward.out).toContain("used its one agent reset");
  });

  test("after a person's rejection, the restart the spent text names works and spends the reset", () => {
    const fixture = reviewedStage();
    personSays({ fixture, words: "Request Changes: rework it." });
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(rejected.status, rejected.out).toBe(0);
    const state = readFileSync(seededStateFile(fixture.project), "utf-8");
    expect(spentReviewStep(fixture.project, state, "feasibility")).toContain("execute --target feasibility --direction redo");
    const restarted = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(restarted.status, restarted.out).toBe(0);
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(true);
  });

  test("going back to an approved stage spends nothing", () => {
    const fixture = reviewedStage();
    const state = readFileSync(seededStateFile(fixture.project), "utf-8");
    const approved = state.replace(/- \[.\] feasibility/, "- [x] feasibility");
    expect(jumpResetsReview(fixture.project, approved, { slug: "feasibility", approval_mode: "autonomous" })).toBe(false);
  });

  test("from a real rejection, the agent's restart is refused and a person's is accepted and grants another", () => {
    const fixture = reviewedStage();
    const rejected = runTool({ tool: STATE_TOOL, args: rejectArgs, fixture });
    expect(rejected.status, rejected.out).toBe(0);
    expect(readFileSync(seededStateFile(fixture.project), "utf-8")).toContain("- [R] feasibility");
    const refused = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(refused.status).not.toBe(0);
    personSays({ fixture, words: "Request Changes: start it again." });
    const accepted = runTool({ tool: JUMP_TOOL, args: jumpHere("redo"), fixture });
    expect(accepted.status, accepted.out).toBe(0);
    expect(audit({ fixture })).toContain("**Decided By**: person");
    expect(stageAgentResetUsed(fixture.project, "feasibility")).toBe(false);
  });

  test("a redo on a human stage is left alone", () => {
    const fixture = openStage({ approvalMode: "human" });
    const redo = ["execute", "--target", "feasibility", "--direction", "redo"];
    expect(runTool({ tool: JUMP_TOOL, args: redo, fixture }).status).toBe(0);
    expect(runTool({ tool: JUMP_TOOL, args: redo, fixture }).status).toBe(0);
    expect(audit({ fixture })).not.toContain("**Decided By**");
  });

  test("the agent's rejection still starts a new review attempt", () => {
    expect(isAttemptBoundary("**Decided By**: agent\n")).toBe(true);
    expect(decodeGateRejection("**Decided By**: agent\n")).toEqual({ kind: "agent-decision" });
  });

  test("a row with no origin reads as a person's and a backfill stays a backfill", () => {
    expect(decodeGateRejection("**Stage**: feasibility\n")).toEqual({ kind: "human-decision" });
    expect(decodeGateRejection("**Recovered**: true\n**Decided By**: agent\n")).toEqual({ kind: "machine-backfill" });
  });
});

describe("a really spent stage on an autonomous gate", () => {
  const PERSON_ONLY = /What should change|on the human's behalf|Only a human|approval gate for the human|ask a human/;
  const artifactPath = (fixture: Fixture): string =>
    join(seededRecordDir(fixture.project), "inception", "requirements-analysis", "requirements.md");

  function spentRecovery(): Fixture {
    const fixture = fixtureAt({
      stateFile: join(FIXTURES_DIR, "state-mid-inception.md"),
      stage: "requirements-analysis",
      approvalMode: "autonomous",
    });
    recordReadyReview({ fixture });
    const updated = { File: artifactPath(fixture), Tool: "Edit", Context: "inception > requirements-analysis > requirements.md" };
    appendAuditEntry("ARTIFACT_UPDATED", updated, fixture.project);
    const review = ["review", "--stage", "requirements-analysis", "--reviewer", REVIEWER, "--iteration", "2"];
    const requested = runTool({ tool: LOG_TOOL, args: review, fixture });
    expect(requested.status, requested.out).toBe(0);
    const { reviewFile }: { readonly reviewFile: string } = JSON.parse(requested.out);
    writeFileSync(
      join(fixture.project, reviewFile),
      `**Verdict:** READY\n**Reviewer:** ${REVIEWER}\n**Iteration:** 2\n\n### Findings\n\nNo blocking findings.\n`,
      "utf-8",
    );
    const recorded = runTool({ tool: LOG_TOOL, args: [...review, "--verdict", "READY"], fixture });
    expect(recorded.status, recorded.out).toBe(0);
    appendAuditEntry("ARTIFACT_UPDATED", updated, fixture.project);
    return fixture;
  }

  test("the review request is refused with the lane's own step", () => {
    const fixture = spentRecovery();
    const review = ["review", "--stage", "requirements-analysis", "--reviewer", REVIEWER, "--iteration", "3"];
    const refused = runTool({ tool: LOG_TOOL, args: review, fixture });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("Report this stage rejected");
    expect(refused.out).not.toMatch(PERSON_ONLY);
  });

  test("opening the gate is refused with the lane's own step", () => {
    const fixture = spentRecovery();
    const refused = runTool({
      tool: STATE_TOOL,
      args: ["gate-start", "requirements-analysis"],
      fixture,
      extra: { AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" },
    });
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain("Report this stage rejected");
    expect(refused.out).not.toMatch(PERSON_ONLY);
  });

  test("an edit the review freeze refuses is told the lane's own step", () => {
    const fixture = fixtureAt({
      stateFile: join(FIXTURES_DIR, "state-mid-inception.md"),
      stage: "requirements-analysis",
      approvalMode: "autonomous",
    });
    recordReadyReview({ fixture });
    const hook = spawnSync(BUN, [join(AIDLC_SRC, "hooks", "aidlc-review-freeze.ts")], {
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        cwd: fixture.project,
        session_id: "lane-session",
        tool_name: "Edit",
        tool_input: { file_path: artifactPath(fixture), old_string: "a", new_string: "b" },
      }),
      encoding: "utf-8",
      env: { ...toolEnvironment({ fixture }), CLAUDE_PROJECT_DIR: fixture.project },
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    });
    expect(hook.status, `${hook.stdout}${hook.stderr}`).toBe(2);
    expect(hook.stderr).not.toMatch(PERSON_ONLY);
  });

  test("only a per-unit Construction stage under team ownership keeps its owner", () => {
    const team = "- **Unit Ownership**: team\n";
    const unitStage = { phase: "construction", for_each: "unit-of-work" } as const;
    expect(stageIsTeamUnitGate(unitStage, team)).toBe(true);
    expect(stageIsTeamUnitGate({ phase: "construction" }, team)).toBe(false);
    expect(stageIsTeamUnitGate({ phase: "inception", for_each: "unit-of-work" }, team)).toBe(false);
    expect(stageIsTeamUnitGate(unitStage, "- **Unit Ownership**: solo\n")).toBe(false);
  });
});

describe("the spent review step", () => {
  test("offers the reset while it is unused and the park once it is used", () => {
    const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode: "autonomous" });
    const state = readFileSync(seededStateFile(fixture.project), "utf-8");
    expect(spentReviewStep(fixture.project, state, "feasibility")).toContain("Report this stage rejected");
    appendAuditEntry("GATE_REJECTED", { Stage: "feasibility", Feedback: "Spent.", ...AGENT_DECIDED_FIELD }, fixture.project);
    expect(spentReviewStep(fixture.project, state, "feasibility")).toContain("Park it");
  });

  test("names a restart on a stage in revision, where a rejection is refused", () => {
    const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode: "autonomous" });
    const state = readFileSync(seededStateFile(fixture.project), "utf-8").replace(/- \[.\] feasibility/, "- [R] feasibility");
    expect(spentReviewStep(fixture.project, state, "feasibility")).toContain("Restart this stage");
  });
});

describe("the engine error relay note", () => {
  test("an autonomous stage is told to park, never that a person saw the error", () => {
    const note = relayedNote({ approvalMode: "autonomous" });
    expect(note).toMatch(/^[\x20-\x7e]+$/);
    expect(note).toContain("Do not retry or work around it");
    expect(note).toContain("park");
    expect(note).not.toContain("already been shown");
    expect(note).not.toContain("end your turn now");
  });

  test("a human stage keeps the note the skills key on", () => {
    expect(relayedNote({ approvalMode: "human" })).toBe(ENGINE_ERROR_RELAY_NOTE);
  });

  test("an isolated run of a human stage keeps the note, though Current Stage is autonomous", () => {
    const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode: "autonomous" });
    const entered = runTool({
      tool: ORCHESTRATE_TOOL,
      args: ["next", "--stage", "requirements-analysis", "--single"],
      fixture,
    });
    expect(entered.status, entered.out).toBe(0);
    const directive = lastDirective(entered.stdout);
    const hops = Array.from({ length: 10 });
    hops.reduce<Record<string, unknown>>(
      (current) =>
        current.kind === "load-steering"
          ? lastDirective(runTool({ tool: ORCHESTRATE_TOOL, args: ["continue", String(current.receipt)], fixture }).stdout)
          : current,
      directive,
    );
    expect(readFileSync(seededStateFile(fixture.project), "utf-8")).toContain("**Current Stage**: feasibility");
    expect(relayedNoteFor({ fixture })).toBe(ENGINE_ERROR_RELAY_NOTE);
  });

  test("a project with no readable workflow keeps the note the skills key on", () => {
    const project = createTestProject();
    projects.push(project);
    expect(engineErrorRelayNote(project)).toBe(ENGINE_ERROR_RELAY_NOTE);
  });
});

describe("the reviewer protocol", () => {
  const protocol = readFileSync(REVIEWER_PROTOCOL, "utf-8");

  test("says what an autonomous stage does when the recovery review is spent", () => {
    expect(protocol).toMatch(/On an\s+interactive stage, present the recovery-spent refusal to the human/);
    expect(protocol).toContain("On a stage whose `directive.approval_mode` is `autonomous`, nobody reads that refusal");
  });

  test("says what an autonomous stage does when review rounds run out", () => {
    expect(protocol).toContain("**NOT-READY** and iterations exhausted, on a human stage");
    expect(protocol).toContain("**NOT-READY** and iterations exhausted, on a stage whose `directive.approval_mode` is `autonomous`");
  });
});
