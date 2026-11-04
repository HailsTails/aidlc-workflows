// covers: function:isAutonomousStage, function:stageRoutesItself, function:engineErrorRelayNote, hook:aidlc-rebuild-stage-graph, cli:aidlc-orchestrate(report), cli:aidlc-orchestrate(next), cli:aidlc-state(approve), cli:aidlc-state(reject)
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
  engineErrorRelayNote,
  ENGINE_ERROR_RELAY_NOTE,
  isAutonomousStage,
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
  const fixture = fixtureAt({ stateFile: "state-mid-ideation.md", stage: "feasibility", approvalMode });
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

  test("a stage routes itself only outside the Construction autonomy grant, whose park and reset stay human", () => {
    const stage = { approval_mode: "autonomous" } as const;
    expect(stageRoutesItself(stage, "- **Construction Autonomy Mode**: unset\n")).toBe(true);
    expect(stageRoutesItself(stage, "- **Construction Autonomy Mode**: autonomous\n")).toBe(false);
    expect(stageRoutesItself({ approval_mode: "human" }, "- **Construction Autonomy Mode**: unset\n")).toBe(false);
  });
});

describe("stage narration", () => {
  test.todo("the first stage of a workflow promises no review on an autonomous stage", () => {
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

  test.todo("an open gate says where the output is, with no review offered, on an autonomous stage", () => {
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
    expect(refused.out).toContain("report this stage rejected");
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
