// The findings gate — a READY may not coexist with a lens's own live blocking
// finding (task 019f6d3e).
//
// `decorrelated-review.md:99-102` (Step 5) states the rule: READY iff every
// producing lens is READY *or its VIOLATIONs resolved*. The scribe enforced only
// the first clause. It already parses each lens's cited findings and records them
// in the capture — and then ignored them when aggregating, so a lens that wrote
// READY above a list of cited violations aggregated to READY. Every board's
// guarantee rested on lens self-discipline at exactly that step.
//
// These tests drive the real hook end to end over a real roster, so what they
// pin is the artefact the autonomy gate consumes, not an internal helper.
//
// Every path the scribe writes to or executes is injected into the checkout's
// own temp dir, and the parent's RIN_GATES_* variables are stripped: this suite
// once ran the real engine and appended to the real discard ledger on every run
// because two of those paths were left to their live defaults.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIBE = join(HERE, "rin-gates-review-scribe.ts");

const GATE = "rin-gate-0-reconcile";
const RECORD = "260809-verdict-findings-gate";
const HEAD_SHA = "1111111111111111111111111111111111111111";

const FULL_ROSTER: readonly string[] = [
  "aidlc-architecture-reviewer-agent",
  "rin-clean-architecture-reviewer-agent",
  "rin-ddd-modelling-reviewer-agent",
  "rin-decomposition-reviewer-agent",
];

const VERDICT_RELATIVE_PATH = join("inception", GATE, "review-verdict.json");

type Checkout = { readonly root: string };

const aggregateVerdictSchema = z.object({
  verdict: z.string().optional(),
  findings: z.array(z.string()).optional(),
  blockingFindings: z.array(z.string()).optional(),
  lenses: z.array(z.string()).optional(),
});

type AggregateVerdict = z.infer<typeof aggregateVerdictSchema>;

const buildCheckout = (): Checkout => {
  const root = mkdtempSync(join(tmpdir(), "rin-findings-"));
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
  writeFileSync(
    join(root, "review-rosters.json"),
    JSON.stringify({ defaultRoster: [], byGate: { [GATE]: FULL_ROSTER } }),
    "utf-8",
  );
  writeFileSync(join(root, "inert-aidlc-log.ts"), "", "utf-8");
  return { root };
};

const parentEnvironmentWithoutScribeVariables = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).flatMap(([name, setting]) =>
      setting === undefined || name.startsWith("RIN_GATES_")
        ? []
        : [[name, setting]],
    ),
  );

const isolatedScribeEnvironment = ({
  checkout,
}: {
  readonly checkout: Checkout;
}): Record<string, string> => ({
  ...parentEnvironmentWithoutScribeVariables(),
  ["RIN_GATES_TEST_MODE"]: "1",
  ["RIN_GATES_SPACE"]: "default",
  ["RIN_GATES_HEAD_SHA"]: HEAD_SHA,
  ["RIN_GATES_ROSTER_CONFIG"]: join(checkout.root, "review-rosters.json"),
  ["RIN_GATES_REVIEW_TRACE_PATH"]: join(checkout.root, "trace.jsonl"),
  ["RIN_GATES_REVIEW_CAPTURES_DIR"]: join(checkout.root, "captures"),
  ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH"]: join(
    checkout.root,
    "discards.jsonl",
  ),
  ["RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH"]: join(
    checkout.root,
    "handbacks.jsonl",
  ),
  ["RIN_GATES_ENGINE_LOG_PATH"]: join(checkout.root, "inert-aidlc-log.ts"),
});

const stopLens = ({
  checkout,
  agentType,
  lastAssistantMessage,
}: {
  readonly checkout: Checkout;
  readonly agentType: string;
  readonly lastAssistantMessage: string;
}): Promise<number> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [SCRIBE], {
      stdio: ["pipe", "ignore", "ignore"],
      env: isolatedScribeEnvironment({ checkout }),
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolvePromise(exitCode ?? -1));
    child.stdin.end(
      JSON.stringify({
        ["agent_type"]: agentType,
        ["last_assistant_message"]: lastAssistantMessage,
        cwd: checkout.root,
        ["session_id"]: "findings-gate-test",
      }),
    );
  });

const aggregateOf = ({
  checkout,
}: {
  readonly checkout: Checkout;
}): AggregateVerdict | null => {
  const path = join(
    checkout.root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    RECORD,
    VERDICT_RELATIVE_PATH,
  );
  return existsSync(path)
    ? aggregateVerdictSchema.parse(JSON.parse(readFileSync(path, "utf-8")))
    : null;
};

// Every READY here echoes the reviewed head sha, because a READY that cannot
// prove which tree it read is discarded before the findings gate ever sees it
// (task 019fd9b8). The subject under test is the findings gate, so these
// fixtures are shaped as a DEFENDED lens produces them.
const CLEAN_READY = `## Verdict\n\nREADY — reviewed at ${HEAD_SHA}. Nothing to cite.`;

// A lens that wrote READY while citing a violation in its own findings rows. This
// is the laundering shape: the token says pass, the lens's own evidence says
// otherwise, and the rows are already parsed into the capture.
const READY_OVER_VIOLATION = [
  "## Review",
  "",
  "Walked the diff.",
  "",
  "## Verdict",
  "",
  `READY — reviewed at ${HEAD_SHA}. One note below, non-blocking in my view.`,
  "",
  "- src/kernel/a.ts:12 | const parsed = raw as Config | CD-2 | cast defeats the type",
].join("\n");

// The whole roster drives to completion so the aggregate is actually written.
// Lenses stop one after another, as a real board's do, so the stops chain.
const runBoard = async (
  messageByLens: Readonly<Record<string, string>>,
): Promise<Checkout> => {
  const checkout = buildCheckout();
  await FULL_ROSTER.reduce<Promise<readonly number[]>>(
    (priorExitCodes, lens) =>
      priorExitCodes.then(async (exitCodes) => [
        ...exitCodes,
        await stopLens({
          checkout,
          agentType: lens,
          lastAssistantMessage: messageByLens[lens] ?? CLEAN_READY,
        }),
      ]),
    Promise.resolve([]),
  );
  return checkout;
};

describe("a READY cannot coexist with a live blocking finding", () => {
  test("one lens's READY-over-a-cited-violation refuses the aggregate READY", async () => {
    const checkout = await runBoard({
      "rin-ddd-modelling-reviewer-agent": READY_OVER_VIOLATION,
    });
    expect(aggregateOf({ checkout })?.verdict).toBe("NOT-READY");
  });

  test("the refusing finding is named in the artefact, not merely counted", async () => {
    const checkout = await runBoard({
      "rin-ddd-modelling-reviewer-agent": READY_OVER_VIOLATION,
    });
    expect(aggregateOf({ checkout })?.blockingFindings).toEqual([
      "src/kernel/a.ts:12 | const parsed = raw as Config | CD-2 | cast defeats the type",
    ]);
  });

  test("every lens clean and citing nothing still aggregates READY", async () => {
    const checkout = await runBoard({});
    expect(aggregateOf({ checkout })?.verdict).toBe("READY");
    expect(aggregateOf({ checkout })?.blockingFindings).toEqual([]);
  });
});

// Fail-safe direction: the gate may only ever move a verdict AWAY from READY.
// A NOT-READY lens is already blocking, so its findings change nothing; and a
// findings block that cannot be read must never upgrade anything.
describe("the findings gate is fail-safe toward NOT-READY", () => {
  test("findings on an already-NOT-READY lens change nothing", async () => {
    const checkout = await runBoard({
      "rin-decomposition-reviewer-agent": [
        "## Verdict",
        "",
        "NOT-READY",
        "",
        "- src/b.ts:3 | function f(a, b) | CD-45 | positional arguments",
      ].join("\n"),
    });
    expect(aggregateOf({ checkout })?.verdict).toBe("NOT-READY");
  });

  test("prose in the verdict section is commentary, never a blocking finding", async () => {
    const checkout = await runBoard({
      "rin-clean-architecture-reviewer-agent": [
        "## Verdict",
        "",
        `READY — reviewed at ${HEAD_SHA}. The import graph points inward throughout.`,
        "",
        "I considered whether the repository port leaks, and it does not.",
      ].join("\n"),
    });
    expect(aggregateOf({ checkout })?.verdict).toBe("READY");
  });

  test("a resolved finding must be marked resolved to stop blocking", async () => {
    const checkout = await runBoard({
      "rin-ddd-modelling-reviewer-agent": [
        "## Verdict",
        "",
        `READY — reviewed at ${HEAD_SHA}.`,
        "",
        "- RESOLVED: 667ef9c4 src/a.ts:12 | const x = y as Foo | CD-2 | fixed in this round",
      ].join("\n"),
    });
    expect(aggregateOf({ checkout })?.verdict).toBe("READY");
  });
});
