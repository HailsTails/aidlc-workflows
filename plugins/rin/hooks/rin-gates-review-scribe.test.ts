import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, onTestFinished, test } from "vitest";
import { z } from "zod";
import { BoardVerdictFileSchema } from "../tools/rin-gates/rin-gates-board-bridge.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIBE = join(HERE, "rin-gates-review-scribe.ts");

const GATE = "rin-gate-0-reconcile";
const RECORD = "260807-verdict-capture-tool";
const HEAD_SHA = "0000000000000000000000000000000000000000";

// The roster each hermetic checkout declares for the gate, through its own
// roster fixture rather than the repository's review-rosters.json. Driving it to
// completion is what exercises the aggregation + the review-verdict.json write —
// the artefact the autonomy gate trusts to permit an autonomous approve.
const FULL_ROSTER: readonly string[] = [
  "aidlc-architecture-reviewer-agent",
  "rin-clean-architecture-reviewer-agent",
  "rin-ddd-modelling-reviewer-agent",
  "rin-decomposition-reviewer-agent",
] as const;

const VERDICT_RELATIVE_PATH = join("inception", GATE, "review-verdict.json");

type ScribeOutcome = {
  readonly exitCode: number;
  readonly stderr: string;
  readonly trace: readonly Record<string, unknown>[];
  readonly discards: readonly Record<string, unknown>[];
  readonly receiptCalls: readonly (readonly string[])[];
};

type Checkout = {
  readonly root: string;
  readonly tracePath: string;
  readonly discardLedgerPath: string;
  readonly engineLogPath: string;
  readonly stageGraphPath: string;
  readonly receiptCallsPath: string;
  readonly rosterConfigPath: string;
};

// A READY as a DEFENDED lens produces it: the reviewed head sha echoed, proving
// which tree it read. Bare `READY` is no longer capturable (task 019fd9b8), so
// every test that needs a captured READY says so through this helper rather than
// re-stating the sha — the tests that pin the sha gate itself spell it out.
const readyAtHead = (note: string): string =>
  `## Verdict\n\nREADY — reviewed at ${HEAD_SHA}. ${note}`;

// A stand-in for the engine's `aidlc-log.ts review` writer. Every checkout gets
// one, so no test in this file can reach the real engine and mutate the real
// repository's audit shards (CD-47). It records each invocation's argv and
// succeeds, which is what lets a test assert the receipt bridge's calls — and
// assert their ABSENCE on a board that did not converge.
// It records each invocation's argv and succeeds, which is what lets a test
// assert the receipt bridge's calls — and assert their ABSENCE on a board that
// did not converge. RIN_GATES_TEST_ENGINE_REFUSAL makes it refuse with that
// message instead, so the REFUSED face of the bridge is reachable from here too;
// a fake that could only succeed left the refusal path untested.
const FAKE_ENGINE_SOURCE = `
import { appendFileSync } from "node:fs";
appendFileSync(process.env.RIN_GATES_TEST_RECEIPT_CALLS, JSON.stringify(process.argv.slice(2)) + "\\n", "utf-8");
const refusal = process.env.RIN_GATES_TEST_ENGINE_REFUSAL ?? "";
if (refusal !== "") {
  process.stderr.write(refusal);
  process.exit(1);
}

console.log(JSON.stringify({ emitted: "REVIEW_REQUESTED", stage: process.argv[process.argv.indexOf("--stage") + 1] }));
`;

const checkoutAt = (root: string): Checkout => {
  const engineLogPath = join(root, "fake-aidlc-log.ts");
  writeFileSync(engineLogPath, FAKE_ENGINE_SOURCE, "utf-8");
  const rosterConfigPath = join(root, "review-rosters.json");
  const stageGraphPath = join(root, "stage-graph.json");
  writeFileSync(
    stageGraphPath,
    JSON.stringify([
      {
        slug: GATE,
        reviewer: "aidlc-architecture-reviewer-agent",
        scopes: ["rin-gates"],
        phase: "inception",
        review_artifact: "rin-reconcile-report",
      },
    ]),
    "utf-8",
  );
  writeFileSync(
    rosterConfigPath,
    JSON.stringify({ defaultRoster: [], byGate: { [GATE]: FULL_ROSTER } }),
    "utf-8",
  );
  return {
    root,
    tracePath: join(root, "trace.jsonl"),
    discardLedgerPath: join(root, "discards.jsonl"),
    engineLogPath,
    stageGraphPath,
    receiptCallsPath: join(root, "receipt-calls.jsonl"),
    rosterConfigPath,
  };
};

const readJsonLines = (path: string): readonly Record<string, unknown>[] => {
  const raw = (() => {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return "";
    }
  })();
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
};

const readReceiptCalls = (path: string): readonly (readonly string[])[] => {
  const raw = (() => {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return "";
    }
  })();
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as readonly string[]);
};

// A hermetic checkout: an active-intent cursor pointing at a record dir whose
// aidlc-state.md names the gate. RIN_GATES_TEST_MODE + RIN_GATES_HEAD_SHA keep the
// scribe off real git, and the trace/captures env vars keep runtime out of the repo.
const buildCheckout = (): Checkout => {
  const root = mkdtempSync(join(tmpdir(), "rin-scribe-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const recordDir = join(intents, RECORD);
  mkdirSync(recordDir, { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), RECORD, "utf-8");
  writeFileSync(
    join(recordDir, "aidlc-state.md"),
    `**Current Stage**: ${GATE}\n`,
    "utf-8",
  );
  // The gate's declared review_artifact. The receipt bridge appends the
  // reviewer's `## Review` section to it between REVIEW_REQUESTED and
  // REVIEW_COMPLETED, so a checkout without it records no completion at all.
  const artifactDir = join(recordDir, "inception", GATE);
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    join(artifactDir, "rin-reconcile-report.md"),
    "# probe artifact\n",
    "utf-8",
  );
  return checkoutAt(root);
};

// A checkout with NO active-intent cursor — the state every freshly-created
// worktree is in, because the cursor is gitignored (task 019fad24).
const buildCursorlessCheckout = (): Checkout => {
  const root = mkdtempSync(join(tmpdir(), "rin-scribe-nocursor-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "aidlc", "spaces", "default", "intents"), {
    recursive: true,
  });
  mkdirSync(join(root, ".git"), { recursive: true });
  return checkoutAt(root);
};

// A checkout whose record names a stage that maps to no phase dir — the third
// discard cause in the trace (66 occurrences), and the one that was still
// trace-only before this change.
const buildUnmappedGateCheckout = (): Checkout => {
  const root = mkdtempSync(join(tmpdir(), "rin-scribe-unmapped-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const recordDir = join(intents, RECORD);
  mkdirSync(recordDir, { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), RECORD, "utf-8");
  writeFileSync(
    join(recordDir, "aidlc-state.md"),
    "**Current Stage**: not-a-real-gate\n",
    "utf-8",
  );
  return checkoutAt(root);
};

// The parent's own RIN_GATES_* variables never reach the scribe: a stray one in
// the shell that runs the suite would otherwise override the checkout's paths.
const parentEnvironmentWithoutScribeVariables = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).flatMap(([name, setting]) =>
      setting === undefined || name.startsWith("RIN_GATES_")
        ? []
        : [[name, setting]],
    ),
  );

// Every path the scribe writes to or executes lives in the checkout's own temp
// dir. The scribe refuses to run in test mode when any of them is missing, so a
// forgotten variable fails the test instead of reaching the real checkout.
const isolatedScribeEnvironment = ({
  checkout,
  engineRefusal,
  route = "legacy-append",
}: {
  readonly checkout: Checkout;
  readonly engineRefusal: string;
  readonly route?: string;
}): Record<string, string> => ({
  ...parentEnvironmentWithoutScribeVariables(),
  ["RIN_GATES_TEST_MODE"]: "1",
  ["RIN_GATES_ENGINE_REVIEW_ROUTE"]: route,
  ["RIN_GATES_SPACE"]: "default",
  ["RIN_GATES_HEAD_SHA"]: HEAD_SHA,
  ["RIN_GATES_REVIEW_TRACE_PATH"]: checkout.tracePath,
  ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH"]: checkout.discardLedgerPath,
  ["RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH"]: join(
    checkout.root,
    "handbacks.jsonl",
  ),
  ["RIN_GATES_REVIEW_CAPTURES_DIR"]: join(checkout.root, "captures"),
  ["RIN_GATES_ENGINE_LOG_PATH"]: checkout.engineLogPath,
  ["AIDLC_STAGE_GRAPH"]: checkout.stageGraphPath,
  ["RIN_GATES_TEST_RECEIPT_CALLS"]: checkout.receiptCallsPath,
  ["RIN_GATES_TEST_ENGINE_REFUSAL"]: engineRefusal,
  ["RIN_GATES_ROSTER_CONFIG"]: checkout.rosterConfigPath,
});

// One lens stop against an EXISTING checkout, so a test can drive a whole roster
// through the same accumulation and reach the aggregate write.
const stopLensAgainstEngine = ({
  checkout,
  agentType,
  lastAssistantMessage,
  engineRefusal,
  route,
  agentId,
}: {
  readonly checkout: Checkout;
  readonly agentType: string;
  readonly lastAssistantMessage: string;
  readonly engineRefusal: string;
  readonly route?: string;
  readonly agentId?: string;
}): Promise<ScribeOutcome> => {
  const { root, tracePath, discardLedgerPath, receiptCallsPath } = checkout;
  return new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [SCRIBE], {
      stdio: ["pipe", "pipe", "pipe"],
      env: isolatedScribeEnvironment({ checkout, engineRefusal, route }),
    });
    const stderrChunks: string[] = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      resolvePromise({
        exitCode: code ?? 0,
        stderr: stderrChunks.join(""),
        trace: readJsonLines(tracePath),
        discards: readJsonLines(discardLedgerPath),
        receiptCalls: readReceiptCalls(receiptCallsPath),
      });
    });
    child.stdin.end(
      JSON.stringify({
        ["agent_type"]: agentType,
        ["agent_id"]: agentId,
        ["last_assistant_message"]: lastAssistantMessage,
        cwd: root,
        ["session_id"]: "test-session",
      }),
    );
  });
};

const stopLens = ({
  checkout,
  agentType,
  lastAssistantMessage,
}: {
  readonly checkout: Checkout;
  readonly agentType: string;
  readonly lastAssistantMessage: string;
}): Promise<ScribeOutcome> =>
  stopLensAgainstEngine({
    checkout,
    agentType,
    lastAssistantMessage,
    engineRefusal: "",
  });

// Several lenses stopping one after another, as a real board's do. The chain
// lives here so every test body stays straight-line (CD-15, CD-27).
const stopLensesInOrder = ({
  checkout,
  lenses,
  lastAssistantMessage,
}: {
  readonly checkout: Checkout;
  readonly lenses: readonly string[];
  readonly lastAssistantMessage: string;
}): Promise<readonly ScribeOutcome[]> =>
  lenses.reduce<Promise<readonly ScribeOutcome[]>>(
    (priorOutcomes, agentType) =>
      priorOutcomes.then(async (outcomes) => [
        ...outcomes,
        await stopLens({ checkout, agentType, lastAssistantMessage }),
      ]),
    Promise.resolve([]),
  );

type GuardOutcome = { readonly exitCode: number; readonly stderr: string };

// A raw spawn for the isolation guard's own tests: they need to hand the scribe
// a deliberately broken environment or payload, which stopLens never does.
const spawnScribeForGuard = ({
  environment,
  payload,
}: {
  readonly environment: Record<string, string>;
  readonly payload: Record<string, string>;
}): Promise<GuardOutcome> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [SCRIBE], {
      stdio: ["pipe", "pipe", "pipe"],
      env: environment,
    });
    const stderrChunks: string[] = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code: number | null) =>
      resolvePromise({ exitCode: code ?? -1, stderr: stderrChunks.join("") }),
    );
    child.stdin.end(JSON.stringify(payload));
  });

const environmentWithout = ({
  checkout,
  variable,
}: {
  readonly checkout: Checkout;
  readonly variable: string;
}): Record<string, string> =>
  Object.fromEntries(
    Object.entries(
      isolatedScribeEnvironment({ checkout, engineRefusal: "" }),
    ).filter(([name]) => name !== variable),
  );

const REAL_REPOSITORY_DIRECTORY = HERE;

const runScribe = (lastAssistantMessage: string): Promise<ScribeOutcome> =>
  stopLens({
    checkout: buildCheckout(),
    agentType: "rin-decomposition-reviewer-agent",
    lastAssistantMessage,
  });

describe("the scribe captures a lens's native verdict section", () => {
  test("a prose ## Verdict section is captured, not discarded", async () => {
    const outcome = await runScribe(readyAtHead("Every orchestrator is pure."));
    expect(outcome.exitCode).toBe(0);
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({
        outcome: "captured",
        verdict: "READY",
        channel: "verdict-section",
      }),
    );
  });

  test("a structured block is captured through the precision channel", async () => {
    const outcome = await runScribe(
      `<!--rin-gates-lens:v1
{ "gate": "${GATE}", "verdict": "NOT-READY", "findings": [] }
rin-gates-lens:v1-->`,
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({
        outcome: "captured",
        verdict: "NOT-READY",
        channel: "structured-block",
      }),
    );
  });

  test("a single-line block missing its closing token is still captured", async () => {
    const outcome = await runScribe(
      `Reviewed at ${HEAD_SHA}.\n\n<!-- rin-gates-lens:v1 { "verdict": "READY", "findings": [] } -->`,
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured", verdict: "READY" }),
    );
  });
});

// The aggregation + the review-verdict.json write are the safety-critical end of
// this hook: that artefact is what the autonomy gate trusts to permit an
// autonomous gate approve. Driving the whole roster is the only way to reach it.
describe("a covered roster writes the aggregate verdict artefact", () => {
  const verdictAt = (root: string): Record<string, unknown> =>
    JSON.parse(
      readFileSync(
        join(
          root,
          "aidlc",
          "spaces",
          "default",
          "intents",
          RECORD,
          VERDICT_RELATIVE_PATH,
        ),
        "utf-8",
      ),
    ) as Record<string, unknown>;

  test("an all-READY roster aggregates to READY", async () => {
    const checkout = buildCheckout();
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER,
      lastAssistantMessage: readyAtHead("Clean."),
    });
    const verdict = verdictAt(checkout.root);
    expect(verdict["verdict"]).toBe("READY");
    expect(verdict["emittedBy"]).toBe("rin-gates-review-scribe");
    expect(verdict["headSha"]).toBe(HEAD_SHA);
    expect(verdict["taskId"]).toBe(RECORD);
    const decoded = BoardVerdictFileSchema.safeParse(verdict);
    expect(decoded.success).toBe(true);
    expect(decoded.success && decoded.data.binding).toBeUndefined();
    expect(decoded.success && decoded.data.headSha).toBe(HEAD_SHA);
    expect(verdict["lenses"]).toEqual(expect.arrayContaining([...FULL_ROSTER]));
  });

  // The mutation guard for `rosterAllReady && !anyNotReady`: one dissenting lens
  // must poison the aggregate, however many others reported READY.
  test("a single NOT-READY lens poisons the aggregate", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-2 | bad",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    const verdict = verdictAt(checkout.root);
    expect(verdict["verdict"]).toBe("NOT-READY");
    expect(verdict["findings"]).toEqual(["a.ts:1 | x | CD-2 | bad"]);
  });

  test("an incomplete roster writes NO verdict artefact", async () => {
    const checkout = buildCheckout();
    const outcomes = await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(0, 3),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    expect(outcomes.map((outcome) => outcome.exitCode)).toEqual([0, 0, 0]);
    expect(() => verdictAt(checkout.root)).toThrow();
  });

  // The `!anyNotReady` clause is the ONLY thing blocking this case, so it is the
  // case that pins it. An EXTRA lens beyond the roster reporting NOT-READY leaves
  // `rosterAllReady` true — every roster lens really did say READY — while the
  // board as a whole carries a blocking finding. Drop `!anyNotReady` (or weaken
  // the `&&` to `||`) and this aggregate silently flips to READY.
  test("a NOT-READY from a lens beyond the roster still poisons the aggregate", async () => {
    const checkout = buildCheckout();
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER,
      lastAssistantMessage: readyAtHead("Clean."),
    });
    await stopLens({
      checkout,
      agentType: "rin-type-soundness-reviewer-agent",
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- b.ts:9 | y as Z | CD-2 | cast",
    });
    const verdict = verdictAt(checkout.root);
    expect(verdict["verdict"]).toBe("NOT-READY");
    expect(verdict["findings"]).toEqual(["b.ts:9 | y as Z | CD-2 | cast"]);
  });

  // SUPERSESSION WITHIN A HEAD (task 019fef05). The captures file is keyed by
  // headSha, so a round at a NEW commit already partitions into a new file. What
  // had no supersession at all was a re-review at the SAME head — the ordinary
  // shape of a board that reviews, gets fixes it can verify without a new commit
  // (an artefact correction, a re-read of a file the lens misread), and re-runs.
  //
  // Round 1's NOT-READY stayed live forever: `rosterAllReady` reads the LATEST
  // verdict per lens, but `anyNotReady` scanned EVERY capture in the file, so one
  // historical refusal pinned the aggregate to NOT-READY no matter what the board
  // said afterwards. Four lenses unanimously READY, blockingFindings empty, and
  // the aggregate still NOT-READY — measured live at gate 3 of 260713 (PR #508),
  // where it blocked a converged board from completing its gate.
  //
  // The fail-safe direction is untouched: supersession is per-lens and requires
  // that SAME lens to have spoken again at this same head. A lens that never
  // revisits its refusal still poisons the aggregate — that is the case below.
  test("a lens's round-2 READY supersedes its own round-1 NOT-READY at the same head", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-2 | bad",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    expect(verdictAt(checkout.root).verdict).toBe("NOT-READY");

    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: readyAtHead("Re-read; the cast was in a fake."),
    });

    const verdict = verdictAt(checkout.root);
    expect(verdict["verdict"]).toBe("READY");
    expect(verdict["blockingFindings"]).toEqual([]);
  });

  // The other half, and the one that keeps this a precision fix rather than a
  // weakening: a lens that refused and NEVER SPOKE AGAIN still blocks. Only the
  // superseding lens's own newer verdict retires its earlier one.
  test("an unrevisited NOT-READY still poisons the aggregate after other lenses re-report", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-2 | bad",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Still clean on re-read."),
    });
    const verdict = verdictAt(checkout.root);
    expect(verdict["verdict"]).toBe("NOT-READY");
    expect(verdict["blockingFindings"]).toEqual(["a.ts:1 | x | CD-2 | bad"]);
  });

  // The findings half of the same defect. A superseded capture's findings were
  // still harvested into `blockingFindings`, so a lens that cited a violation in
  // round 1 and withdrew it in round 2 left the aggregate blocked on a finding no
  // live verdict asserted. Findings follow their capture: superseded capture,
  // superseded findings.
  test("findings from a superseded capture stop blocking", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-2 | bad",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: readyAtHead("Withdrawn on re-read."),
    });

    const verdict = verdictAt(checkout.root);
    expect(verdict["blockingFindings"]).toEqual([]);
    expect(verdict["findings"]).toEqual([]);
  });

  // A READY does not launder a live finding, before or after supersession: the
  // #480 gate still fires on the LATEST captures. This is the mutation guard that
  // fails if supersession is implemented by dropping the findings gate entirely.
  test("a superseding READY that still cites an undisposed finding stays NOT-READY", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-2 | bad",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: `${readyAtHead("Mostly fixed.")}\n\n- a.ts:1 | x | CD-2 | still live`,
    });
    const verdict = verdictAt(checkout.root);
    expect(verdict.verdict).toBe("NOT-READY");
    expect(verdict.blockingFindings).toEqual([
      "a.ts:1 | x | CD-2 | still live",
    ]);
  });

  // A disposed finding on the superseding verdict clears, exactly as #480 defines
  // disposition — supersession changes WHICH captures are consulted, never what
  // READY means.
  test("a superseding READY whose finding carries a disposition aggregates READY", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-2 | bad",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: `${readyAtHead("Fixed.")}\n\n- fixed@1a2b3c4d | a.ts:1 | x | CD-2 | bad`,
    });
    expect(verdictAt(checkout.root).verdict).toBe("READY");
  });

  // Anti-replay: captures are keyed by headSha, so a lens whose verdict was
  // recorded cannot have it counted toward a different commit.
  test("a roster covered under one headSha does not cover another", async () => {
    const checkout = buildCheckout();
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER,
      lastAssistantMessage: readyAtHead("Clean."),
    });
    expect(verdictAt(checkout.root).headSha).toBe(HEAD_SHA);
  });
});

describe("a lens that produced no verdict fails LOUDLY", () => {
  test("writes to stderr and traces the reject, still exiting 0", async () => {
    const outcome = await runScribe(
      "## Review\n\nI read the diff and formed no view.",
    );
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toContain("no verdict in lens output");
    expect(outcome.stderr).toContain("rin-decomposition-reviewer-agent");
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ reject: "no verdict in lens output" }),
    );
  });

  test("a checkout with no active-intent cursor also fails loudly", async () => {
    const checkout = buildCursorlessCheckout();
    const outcome = await stopLens({
      checkout,
      agentType: "rin-decomposition-reviewer-agent",
      lastAssistantMessage: readyAtHead("Nothing to report."),
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toContain("no active intent");
    expect(outcome.stderr).toContain("rin-decomposition-reviewer-agent");
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({
        reject: "no active intent at invoking checkout",
      }),
    );
  });

  test("an unmappable gate is loud too, not trace-only", async () => {
    const outcome = await stopLens({
      checkout: buildUnmappedGateCheckout(),
      agentType: "rin-decomposition-reviewer-agent",
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-1 | cast",
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toContain("DISCARDED");
    expect(outcome.stderr).toContain("gate has no phase mapping");
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ reject: "gate has no phase mapping" }),
    );
  });
});

// The discard ledger (task 019fe4af). 32 verdicts were discarded across four
// gates over three days while every one of them WAS traced — the trace mixes
// discards into a thousand-plus captures, so nobody read it. A session asking
// "did this board lose anything?" reads the ledger and gets only losses.
describe("every discard lands in the readable discard ledger", () => {
  test.each([
    {
      reason: "no verdict in lens output",
      build: (): Checkout => buildCheckout(),
      message: "## Review\n\nNo view formed.",
    },
    {
      reason: "no active intent at invoking checkout",
      build: (): Checkout => buildCursorlessCheckout(),
      message: "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-1 | cast",
    },
    {
      reason: "gate has no phase mapping",
      build: (): Checkout => buildUnmappedGateCheckout(),
      message: "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x | CD-1 | cast",
    },
  ])("$reason is recorded with its agent and reason", async ({
    reason,
    build,
    message,
  }) => {
    const outcome = await stopLens({
      checkout: build(),
      agentType: "rin-decomposition-reviewer-agent",
      lastAssistantMessage: message,
    });
    expect(outcome.discards).toContainEqual(
      expect.objectContaining({
        reject: reason,
        agentType: "rin-decomposition-reviewer-agent",
      }),
    );
  });

  test("the ledger names a remedy on stderr so a live session can act", async () => {
    const outcome = await stopLens({
      checkout: buildCursorlessCheckout(),
      agentType: "rin-ddd-modelling-reviewer-agent",
      lastAssistantMessage: "## Verdict\n\nNOT-READY",
    });
    expect(outcome.stderr).toContain("DISCARDED");
    expect(outcome.stderr).toContain("rin-ddd-modelling-reviewer-agent");
    expect(outcome.stderr).toContain("re-dispatch");
  });

  // The fail-safe direction, asserted rather than assumed: a DISCARDED NOT-READY
  // must never leave a READY behind it. It is not counted toward the roster, so
  // the aggregate is withheld entirely and no verdict artefact is written.
  test("a discarded NOT-READY writes no verdict artefact at all", async () => {
    const checkout = buildCursorlessCheckout();
    const outcome = await stopLens({
      checkout,
      agentType: "rin-decomposition-reviewer-agent",
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x as Y | CD-1 | cast defeats the type",
    });
    expect(outcome.trace).not.toContainEqual(
      expect.objectContaining({ outcome: "verdict-written" }),
    );
    expect(outcome.discards).toHaveLength(1);
  });

  test("a captured verdict leaves the discard ledger empty", async () => {
    const outcome = await runScribe(readyAtHead("Nothing to report."));
    expect(outcome.discards).toEqual([]);
  });
});

// The gate-lens defence (task 019fd9b8). PR #446 gave the six rin-pr-* lenses a
// three-part contract — prepared worktree, head-sha binding, mandatory
// CANNOT-REVIEW — but the twelve GATE lenses had none of it, so Gates 3 and 4
// (the gates that DESIGN the code) accepted a verdict from a lens that could not
// prove which tree it read. The protocol's own note records the cost: "a
// five-way READY from agents that never saw a diff" (2026-08-02, 2026-08-03).
//
// The defence is mechanical here rather than prose in 23 agent files: prose in
// N copies is the anti-requirement this contract already rejected once (399
// losses from 17 pasted templates). The scribe already knows the resolved
// headSha, so it can REQUIRE the echo instead of asking a model to remember it.
describe("a verdict must prove which tree the lens read", () => {
  test("a READY that echoes no head sha is discarded, not captured", async () => {
    const outcome = await runScribe(
      "## Verdict\n\nREADY — every orchestrator is pure.",
    );
    expect(outcome.discards).toContainEqual(
      expect.objectContaining({
        reject: "verdict does not echo the reviewed head sha",
      }),
    );
    expect(outcome.trace).not.toContainEqual(
      expect.objectContaining({ outcome: "captured" }),
    );
  });

  test("a READY echoing the resolved head sha is captured", async () => {
    const outcome = await runScribe(
      `## Verdict\n\nREADY — reviewed at ${HEAD_SHA}. Every orchestrator is pure.`,
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured", verdict: "READY" }),
    );
    expect(outcome.discards).toEqual([]);
  });

  test("an abbreviated head sha still binds the verdict", async () => {
    const outcome = await runScribe(
      `## Verdict\n\nREADY — reviewed at ${HEAD_SHA.slice(0, 12)}.`,
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured", verdict: "READY" }),
    );
  });

  test("a verdict echoing a DIFFERENT sha is discarded", async () => {
    const outcome = await runScribe(
      "## Verdict\n\nREADY — reviewed at ffffffffffffffffffffffffffffffffffffffff.",
    );
    expect(outcome.discards).toContainEqual(
      expect.objectContaining({
        reject: "verdict does not echo the reviewed head sha",
      }),
    );
  });

  // The fail-safe direction, preserved exactly. An unbindable NOT-READY is a
  // real refusal from a real lens: dropping it could only ever HELP a gate
  // approve, which is the one direction this whole machine must never move in.
  // So the sha requirement gates READY only — a NOT-READY is captured whether or
  // not it proved its tree.
  test("a NOT-READY with no sha echo is still captured — refusals are never dropped", async () => {
    const outcome = await runScribe(
      "## Verdict\n\nNOT-READY\n\n- src/a.ts:1 | x as Y | CD-1 | cast defeats the type",
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured", verdict: "NOT-READY" }),
    );
    expect(outcome.discards).toEqual([]);
  });

  test("a CANNOT-REVIEW abstention is recorded as a discard, never as a verdict", async () => {
    const outcome = await runScribe(
      "CANNOT-REVIEW — my prompt supplied no head sha and no changed-file list, so I cannot confirm which tree I am reading.",
    );
    expect(outcome.trace).not.toContainEqual(
      expect.objectContaining({ outcome: "captured" }),
    );
    expect(outcome.discards).toContainEqual(
      expect.objectContaining({ reject: "lens abstained with CANNOT-REVIEW" }),
    );
    expect(outcome.stderr).toContain("CANNOT-REVIEW");
  });

  test("an abstention declared under a ## Verdict heading is still a discard", async () => {
    const outcome = await runScribe(
      "## Verdict\n\nCANNOT-REVIEW — no pinned tree.",
    );
    expect(outcome.trace).not.toContainEqual(
      expect.objectContaining({ outcome: "captured" }),
    );
    expect(outcome.discards).toContainEqual(
      expect.objectContaining({ reject: "lens abstained with CANNOT-REVIEW" }),
    );
  });

  // Member 01a02b84: the abstention token was keyword-sniffed across the WHOLE
  // message BEFORE extraction, so a lens that named it while delivering a
  // well-formed verdict had its entire review thrown away — 62 such discards in
  // the ledger. Extraction now runs first; abstention is the outcome only when
  // extraction yields nothing.
  test("a mention of the token beside a bound READY keeps the verdict", async () => {
    const outcome = await runScribe(
      `I confirmed my checkout is at ${HEAD_SHA}, so this is not a CANNOT-REVIEW case.\n\n## Verdict\n\nREADY — reviewed at ${HEAD_SHA}. Every orchestrator is pure.`,
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured", verdict: "READY" }),
    );
    expect(outcome.discards).toEqual([]);
  });

  test("a mention of the token beside a NOT-READY keeps the refusal", async () => {
    const outcome = await runScribe(
      "My cwd was pinned, so this is not a CANNOT-REVIEW case.\n\n## Verdict\n\nNOT-READY\n\n- src/a.ts:1 | x as Y | CD-1 | cast defeats the type",
    );
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured", verdict: "NOT-READY" }),
    );
    expect(outcome.discards).toEqual([]);
  });

  test("a mid-sentence mention with no verdict discards as malformed, not as abstention", async () => {
    const outcome = await runScribe(
      "## Review\n\nNothing here rises to a CANNOT-REVIEW, but I formed no view.",
    );
    expect(outcome.discards).toContainEqual(
      expect.objectContaining({ reject: "no verdict in lens output" }),
    );
    expect(outcome.discards).not.toContainEqual(
      expect.objectContaining({ reject: "lens abstained with CANNOT-REVIEW" }),
    );
  });
});

// FR-6 (member 01a02cd6). Both reviewer mechanisms are satisfied by ONE review:
// having converged the board, the scribe records the engine's receipt pair for
// the gate's declared reviewer, so the engine's reviewer precondition no longer
// needs a hand-recorded verdict. The receipt is a CONSEQUENCE of convergence —
// these tests prove both faces of that.
describe("a converged board records the engine's reviewer receipt", () => {
  const flagValue = (call: readonly string[], flag: string): string | null => {
    const index = call.indexOf(flag);
    return index === -1 || index + 1 >= call.length ? null : (call[index + 1] ?? null);
  };

  test("the receipt pair names the gate's declared reviewer and mirrors the aggregate", async () => {
    const checkout = buildCheckout();
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER,
      lastAssistantMessage: readyAtHead("Clean."),
    });
    const outcome = await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: readyAtHead("Clean."),
    });

    const pair = outcome.receiptCalls.slice(-2);
    expect(pair).toHaveLength(2);
    expect(pair.every((call) => call[0] === "review")).toBe(true);
    expect(pair.every((call) => flagValue(call, "--stage") === GATE)).toBe(
      true,
    );
    // Read from the compiled stage graph, never a table in the scribe.
    expect(
      pair.every(
        (call) =>
          flagValue(call, "--reviewer") === "aidlc-architecture-reviewer-agent",
      ),
    ).toBe(true);
    const [requested, completed] = pair;
    if (requested === undefined || completed === undefined) throw new Error("Expected the fixture receipt pair");
    expect(flagValue(requested, "--verdict")).toBeNull();
    expect(flagValue(completed, "--verdict")).toBe("READY");
  });

  test("a NOT-READY aggregate records a NOT-READY receipt, not a READY one", async () => {
    const checkout = buildCheckout();
    await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage:
        "## Verdict\n\nNOT-READY\n\n- a.ts:1 | x as Y | CD-1 | cast",
    });
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    const outcome = await stopLens({
      checkout,
      agentType: FULL_ROSTER[1],
      lastAssistantMessage: readyAtHead("Clean."),
    });

    const verdicts = outcome.receiptCalls
      .map((call) => flagValue(call, "--verdict"))
      .filter((verdict): verdict is string => verdict !== null);
    expect(verdicts).not.toContain("READY");
    expect(verdicts).toContain("NOT-READY");
  });

  // The must-block face. A receipt written for a board that did not converge
  // would be a side door around exactly the guarantees the board exists to give.
  test("an incomplete roster records NO receipt at all", async () => {
    const checkout = buildCheckout();
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER.slice(0, FULL_ROSTER.length - 1),
      lastAssistantMessage: readyAtHead("Clean."),
    });
    const outcome = await stopLens({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: readyAtHead("Still clean."),
    });

    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "captured, roster incomplete" }),
    );
    expect(outcome.receiptCalls).toEqual([]);
  });

  test("a discarded lens records no receipt", async () => {
    const outcome = await runScribe("## Review\n\nI formed no view.");
    expect(outcome.receiptCalls).toEqual([]);
  });
});

// IDG-1. A refused receipt used to reach only the gitignored trace, so a
// converged READY board whose receipt never landed was indistinguishable from
// one whose receipt did — while the engine's reviewer floor rested on an older
// receipt. The loss is now loud and durable, and the exit-code contract stays
// advisory: the fix is visibility, not fatality.
describe("a refused engine receipt is loud on stderr and durable in the ledger", () => {
  const RecoverySpentRefusal =
    'Refusing REVIEW_REQUESTED for "rin-gate-0-reconcile": the one stale-receipt recovery ' +
    "request already exists in this review attempt. If its dispatch is still unmatched, retry " +
    "iteration 2 with --retry-pending; if its verdict was recorded, that recovery receipt is " +
    "terminal and no further review request is allowed.";

  const convergeWithRefusingEngine = async (
    refusal: string,
  ): Promise<ScribeOutcome> => {
    const checkout = buildCheckout();
    await stopLensesInOrder({
      checkout,
      lenses: FULL_ROSTER,
      lastAssistantMessage: readyAtHead("Clean."),
    });
    return stopLensAgainstEngine({
      checkout,
      agentType: FULL_ROSTER[0],
      lastAssistantMessage: readyAtHead("Clean."),
      engineRefusal: refusal,
    });
  };

  test("the discard ledger records the refusal with the bridge's named reason", async () => {
    const outcome = await convergeWithRefusingEngine(RecoverySpentRefusal);

    expect(outcome.discards).toContainEqual(
      expect.objectContaining({
        reject: "engine receipt refused",
        gate: GATE,
        reviewer: "aidlc-architecture-reviewer-agent",
        step: "requested",
        reason: "recovery-spent",
      }),
    );
  });

  test("stderr names the gate, the reviewer, the reason, and the stale-receipt consequence", async () => {
    const outcome = await convergeWithRefusingEngine(RecoverySpentRefusal);

    expect(outcome.stderr).toContain(GATE);
    expect(outcome.stderr).toContain("aidlc-architecture-reviewer-agent");
    expect(outcome.stderr).toContain("recovery-spent");
    expect(outcome.stderr).toContain(
      "Engine receipt NOT recorded — the engine's reviewer floor may rest on a stale receipt",
    );
  });

  test("the aggregate is still written and the exit code stays advisory", async () => {
    const outcome = await convergeWithRefusingEngine(RecoverySpentRefusal);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.trace).toContainEqual(
      expect.objectContaining({ outcome: "verdict-written", verdict: "READY" }),
    );
  });

  test("an unrecognised refusal is ledgered as `other` rather than left silent", async () => {
    const outcome = await convergeWithRefusingEngine(
      "the audit lock is held by another process",
    );

    expect(outcome.discards).toContainEqual(
      expect.objectContaining({
        reject: "engine receipt refused",
        reason: "other",
      }),
    );
  });
});

// The isolation guard (2026-09-28). A spawner that left one path to its live
// default wrote into the real checkout on every run while the suite stayed
// green. Under test mode the scribe now refuses that fallback, so the leak
// fails the test that caused it.
describe("in test mode the scribe never falls back to the real checkout", () => {
  test.each([
    { variable: "RIN_GATES_REVIEW_TRACE_PATH" },
    { variable: "RIN_GATES_REVIEW_CAPTURES_DIR" },
    { variable: "RIN_GATES_REVIEW_DISCARD_LEDGER_PATH" },
    { variable: "RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH" },
    { variable: "RIN_GATES_ENGINE_LOG_PATH" },
  ])("an uninjected $variable is refused, naming the variable", async ({
    variable,
  }) => {
    const checkout = buildCheckout();
    const outcome = await spawnScribeForGuard({
      environment: environmentWithout({ checkout, variable }),
      payload: {
        ["agent_type"]: "rin-decomposition-reviewer-agent",
        ["last_assistant_message"]: readyAtHead("Clean."),
        cwd: checkout.root,
      },
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain(
      `TEST ISOLATION BREACH — ${variable} is not injected`,
    );
  });

  test("a payload whose checkout resolves to the real repository is refused", async () => {
    const checkout = buildCheckout();
    const outcome = await spawnScribeForGuard({
      environment: isolatedScribeEnvironment({ checkout, engineRefusal: "" }),
      payload: {
        ["agent_type"]: "rin-decomposition-reviewer-agent",
        ["last_assistant_message"]: readyAtHead("Clean."),
        cwd: REAL_REPOSITORY_DIRECTORY,
      },
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("resolved to the real repository");
    expect(readJsonLines(checkout.tracePath)).toEqual([]);
  });

  test("a fully injected spawn is not refused", async () => {
    const outcome = await runScribe(readyAtHead("Clean."));
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).not.toContain("TEST ISOLATION BREACH");
  });
});

describe("the scribe ignores what is not a reviewer lens", () => {
  test("a non-reviewer agent is ignored entirely", async () => {
    const outcome = await stopLens({
      checkout: buildCheckout(),
      agentType: "aidlc-developer-agent",
      lastAssistantMessage: "## Verdict\n\nREADY",
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.trace).toEqual([]);
    expect(outcome.discards).toEqual([]);
  });
});

const modernVerdictPath = (checkout: Checkout): string => join(
  checkout.root, "aidlc", "spaces", "default", "intents", RECORD, VERDICT_RELATIVE_PATH,
);
const modernVerdictSchema = z.object({
  verdict: z.enum(["READY", "NOT-READY"]),
  reportsComplete: z.boolean(),
  findings: z.array(z.string()),
  reports: z.array(z.object({
    lens: z.string(), findings: z.array(z.string()), sessionId: z.string(),
    agentId: z.string().nullable(), channel: z.string().nullable(),
    reportText: z.string().nullable(), headSha: z.string(), gate: z.string(),
  })),
});
const readModernVerdict = (checkout: Checkout) => modernVerdictSchema.parse(
  JSON.parse(readFileSync(modernVerdictPath(checkout), "utf8")),
);
const stopModernLens = (input: {
  readonly checkout: Checkout;
  readonly agentType: string;
  readonly reportText: string;
}) => stopLensAgainstEngine({
  checkout: input.checkout, agentType: input.agentType,
  lastAssistantMessage: input.reportText, engineRefusal: "",
  route: "conductor-report", agentId: input.agentType + "-native",
});
const stopModernBoard = (input: { readonly checkout: Checkout; readonly reportText: string }): Promise<ScribeOutcome | undefined> =>
  FULL_ROSTER.reduce<Promise<ScribeOutcome | undefined>>(async (previous, agentType) => {
    await previous;
    return stopModernLens({ checkout: input.checkout, agentType, reportText: input.reportText });
  }, Promise.resolve(undefined));
const seedHistoricalCaptures = (checkout: Checkout): void => {
  const dir = join(checkout.root, "captures");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${RECORD}.${GATE}.${HEAD_SHA}.jsonl`),
    FULL_ROSTER.slice(1).map((lens) => JSON.stringify({
      lens, verdict: "READY", findings: [], sessionId: "old-session", at: "2026-10-01T00:00:00Z",
    })).join("\n") + "\n");
};

describe("modern native report handoff", () => {
  test("a converged READY board retains every report and never calls the engine or appends the artifact", async () => {
    const checkout = buildCheckout();
    const text = readyAtHead("No findings.");
    const outcome = await stopModernBoard({ checkout, reportText: text });
    const verdict = readModernVerdict(checkout);
    expect(verdict.verdict).toBe("READY");
    expect(verdict.reportsComplete).toBe(true);
    expect(verdict.findings).toEqual([]);
    expect(verdict.reports).toHaveLength(4);
    expect(verdict.reports[0]).toMatchObject({
      lens: "aidlc-architecture-reviewer-agent", agentId: "aidlc-architecture-reviewer-agent-native",
      sessionId: "test-session", channel: "stop-message", headSha: HEAD_SHA, gate: GATE, reportText: text,
    });
    expect(outcome?.receiptCalls).toEqual([]);
    expect(outcome?.trace).toContainEqual(expect.objectContaining({
      outcome: "verdict-written", receipt: { kind: "conductor-report", reviewer: "aidlc-architecture-reviewer-agent", verdict: "READY" },
    }));
    expect(readFileSync(join(checkout.root, "aidlc", "spaces", "default", "intents", RECORD, "inception", GATE, "rin-reconcile-report.md"), "utf8")).toBe("# probe artifact\n");
  });

  test("NOT-READY preserves original severity, action and prior ID data instead of synthesizing cells", async () => {
    const checkout = buildCheckout();
    const text = [
      "## Verdict", "", "NOT-READY", "",
      "- src/a.ts:12 | const x = y | CD-2 | missing declared type", "",
      "### Findings", "", "**Prior findings**", "",
      "| ID | Now | Severity | Note |", "|---|---|---|---|",
      "| R-01 | Still applies | Major | The exclusion remains absent |",
      "", "**New findings**", "",
      "| Severity | Location | Finding | Required action |", "|---|---|---|---|",
      "| Major | src/a.ts > input | The type is missing | Declare the input type |",
    ].join("\n");
    const outcome = await stopModernBoard({ checkout, reportText: text });
    const verdict = readModernVerdict(checkout);
    expect(verdict.verdict).toBe("NOT-READY");
    expect(verdict.reportsComplete).toBe(true);
    expect(verdict.reports[0]?.reportText).toBe(text);
    expect(verdict.reports[0]?.findings).toEqual(["src/a.ts:12 | const x = y | CD-2 | missing declared type"]);
    expect(outcome?.receiptCalls).toEqual([]);
    expect(outcome?.trace).toContainEqual(expect.objectContaining({
      receipt: { kind: "conductor-report", reviewer: "aidlc-architecture-reviewer-agent", verdict: "NOT-READY" },
    }));
  });

  test("an incomplete board writes no handoff or engine receipt", async () => {
    const checkout = buildCheckout();
    const outcome = await stopModernLens({ checkout, agentType: "aidlc-architecture-reviewer-agent", reportText: readyAtHead("Clean.") });
    expect(existsSync(modernVerdictPath(checkout))).toBe(false);
    expect(outcome.receiptCalls).toEqual([]);
    expect(outcome.trace).toContainEqual(expect.objectContaining({ outcome: "captured, roster incomplete" }));
  });

  test("historical captures remain explicitly missing their original reports", async () => {
    const checkout = buildCheckout();
    seedHistoricalCaptures(checkout);
    const outcome = await stopModernLens({ checkout, agentType: "aidlc-architecture-reviewer-agent", reportText: readyAtHead("Clean.") });
    const verdict = readModernVerdict(checkout);
    expect(verdict.reportsComplete).toBe(false);
    expect(verdict.reports[0]?.reportText).toBeNull();
    expect(verdict.reports[0]?.agentId).toBeNull();
    expect(verdict.reports[0]?.channel).toBeNull();
    expect(outcome.receiptCalls).toEqual([]);
  });
});
