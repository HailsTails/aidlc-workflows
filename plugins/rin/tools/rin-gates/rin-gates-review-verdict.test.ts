// The CLI emitter's findings gate (task 019f6d3e).
//
// This emitter is the DOMINANT door to a review-verdict.json — 121 of the 141
// verdicts committed under `aidlc/spaces/default/intents/` carry its stamp
// against the review-scribe's 20 (re-derive below). Closing the laundering gap
// only in the scribe would therefore have left the majority path open.
//
//   grep -ro '"emittedBy": "[^"]*"' aidlc/spaces/default/intents \
//     --include=review-verdict.json | sed 's/.*: //' | sort | uniq -c
//
// It took `--verdict` from the caller and held no finding state whatever, so it
// structurally could not refuse a READY that coexisted with a live blocking
// VIOLATION. It now accepts the findings and applies the same predicate the
// review-scribe applies to its captures.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { BoardVerdictFileSchema } from "./rin-gates-board-bridge.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const EMITTER = join(HERE, "rin-gates-review-verdict.ts");

const GATE = "rin-gate-0-reconcile";
const RECORD = "260809-verdict-findings-gate";
const HEAD_SHA = "2222222222222222222222222222222222222222";

const LIVE_FINDING =
  "src/kernel/a.ts:12 | const parsed = raw as Config | CD-2 | cast defeats the type";

type EmittedVerdict = {
  readonly verdict?: string;
  readonly findings?: readonly string[];
  readonly blockingFindings?: readonly string[];
};

type EmitOutcome = {
  readonly status: number;
  readonly stderr: string;
  readonly verdictFile: EmittedVerdict | null;
};

const buildWorkspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "rin-emitter-"));
  mkdirSync(join(root, "aidlc", "spaces", "default", "intents", RECORD), {
    recursive: true,
  });
  return root;
};

const emit = (args: readonly string[]): EmitOutcome => {
  const root = buildWorkspace();
  const result = spawnSync("bun", [EMITTER, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      RIN_GATES_VERDICT_EMITTER: "1",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: HEAD_SHA,
      RIN_GATES_DIFF_DIGEST: "digest",
      RIN_GATES_WORKSPACE_ROOT: root,
      RIN_GATES_SPACE: "default",
    },
  });
  const path = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    RECORD,
    "inception",
    GATE,
    "review-verdict.json",
  );
  return {
    status: result.status ?? 0,
    stderr: result.stderr ?? "",
    verdictFile: existsSync(path)
      ? JSON.parse(readFileSync(path, "utf-8"))
      : null,
  };
};

const baseArgs = (verdict: string): readonly string[] => [
  "--record-dir",
  RECORD,
  "--gate",
  GATE,
  "--task-id",
  "019f6d3e-fa88-750a-aa6e-61446fdd7217",
  "--verdict",
  verdict,
  "--lenses",
  "rin-ddd-modelling-reviewer-agent",
];

describe("a caller-supplied READY is refused over a live finding", () => {
  test("READY carrying an undisposed finding exits non-zero", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", LIVE_FINDING]);
    expect(outcome.status).not.toBe(0);
  });

  test("the refusal names the finding and cites the rule it enforces", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", LIVE_FINDING]);
    expect(outcome.stderr).toContain("CD-2");
    expect(outcome.stderr).toContain("Step 5");
  });

  test("no verdict file is written when the READY is refused", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", LIVE_FINDING]);
    expect(outcome.verdictFile).toBeNull();
  });
});

describe("the emitter's findings gate is fail-safe toward NOT-READY", () => {
  test("a clean READY still emits", () => {
    const outcome = emit(baseArgs("READY"));
    expect(outcome.status).toBe(0);
    expect(outcome.verdictFile?.verdict).toBe("READY");
    const decoded = BoardVerdictFileSchema.safeParse(outcome.verdictFile);
    expect(decoded.success).toBe(true);
    expect(decoded.success && decoded.data.binding).toMatchObject({
      mode: "live",
      headSha: HEAD_SHA,
    });
  });

  test("NOT-READY emits with its findings recorded, never refused", () => {
    const outcome = emit([
      ...baseArgs("NOT-READY"),
      "--findings",
      LIVE_FINDING,
    ]);
    expect(outcome.status).toBe(0);
    expect(outcome.verdictFile?.verdict).toBe("NOT-READY");
    expect(outcome.verdictFile?.findings).toEqual([LIVE_FINDING]);
  });

  test("a finding disposed WITH its evidence does not block a READY", () => {
    const outcome = emit([
      ...baseArgs("READY"),
      "--findings",
      `RESOLVED: 667ef9c4 ${LIVE_FINDING}`,
    ]);
    expect(outcome.status).toBe(0);
    expect(outcome.verdictFile?.verdict).toBe("READY");
  });

  // The bare-prefix laundering channel: a disposition word carrying no evidence
  // is not a disposition, or it becomes a more credible-sounding replacement for
  // the "non-blocking note" this change abolishes.
  test("a bare DEFERRED prefix does not launder a live finding", () => {
    const outcome = emit([
      ...baseArgs("READY"),
      "--findings",
      `DEFERRED: ${LIVE_FINDING}`,
    ]);
    expect(outcome.status).not.toBe(0);
  });

  test("an emitted verdict records blockingFindings for its consumer", () => {
    const outcome = emit([
      ...baseArgs("NOT-READY"),
      "--findings",
      LIVE_FINDING,
    ]);
    expect(outcome.verdictFile?.blockingFindings).toEqual([LIVE_FINDING]);
  });

  test("semicolons separate findings as newlines do", () => {
    const outcome = emit([
      ...baseArgs("READY"),
      "--findings",
      `${LIVE_FINDING};src/b.ts:3 | f(a, b) | CD-45 | positional`,
    ]);
    expect(outcome.status).not.toBe(0);
    expect(outcome.stderr).toContain("2 undisposed finding(s)");
  });
});
