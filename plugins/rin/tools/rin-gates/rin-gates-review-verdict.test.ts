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

const emitWithConfig = ({
  args,
  exceptionWhyChainsEnabled,
}: {
  readonly args: readonly string[];
  readonly exceptionWhyChainsEnabled: boolean;
}): EmitOutcome => {
  const root = buildWorkspace();
  if (exceptionWhyChainsEnabled) {
    writeFileSync(
      join(root, "harness.config.json"),
      JSON.stringify({
        projectName: "verdict-fixture",
        defaultScope: "rin-gates",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        rinGates: { exceptionWhyChains: true },
      }),
    );
  }
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

const emit = (args: readonly string[]): EmitOutcome =>
  emitWithConfig({ args, exceptionWhyChainsEnabled: false });

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

describe("R7 is project opt-in at the verdict emitter", () => {
  const deferredFinding = `defer(ack:Helen 2026-08-09) ${LIVE_FINDING}`;

  test("a project without R7 accepts the acknowledged defer shape", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", deferredFinding]);
    expect(outcome.status).toBe(0);
  });

  test("a project with R7 refuses the defer without its chain", () => {
    const outcome = emitWithConfig({
      args: [...baseArgs("READY"), "--findings", deferredFinding],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.status).not.toBe(0);
  });
});

const PUSH_BACK_ROW_WITH_COLUMN_CHAIN =
  "| D-5 architecture Major: an adopter that opts in has no baseline generator, because `scripts/rin-ops/` is project-owned | push-back(no R7 requirement is unmet: the opt-in defaults to disabled, so no project meets the gap until it opts in, and the only opted-in project is rin, whose generator exists; the fix needs a packaging design decision, so it is not a 2026-09-27 Minor and goes to its own Gate 0 on capture 01a0f1bf-1c1f-7229-a4e0-61e4d91a0ecc) | 1. Why is it not fixed here? — no acceptance criterion of R7 names adopter bootstrap, and no project other than rin can reach the gap, because the opt-in defaults to false (`rin-harness-config.ts`, the `exceptionWhyChains` schema default). <br> 2. Why is there a gap? — commit 18ee9d360 made R7 opt-in per project and moved the baseline to the project root, and left the generator in rin's `scripts/rin-ops/` (`git show 18ee9d360 --stat`). <br> 3. Why did the generator stay? — it resolves the registries by relative path and imports from `plugins/rin/tools/`, so it only runs inside rin's checkout (`scripts/rin-ops/generate-exception-baseline.ts`, its imports). <br> 4. Why was that not caught earlier? — R7 was authored against rin's own corpus and the opt-in scoping arrived as a later correction, with no adopter path designed (the 18ee9d360 commit message). <br> 5. root cause: the plugin has no adopter-side baseline generator and no design for bootstrapping one. owner: capture 01a0f1bf-1c1f-7229-a4e0-61e4d91a0ecc (`git grep -n \"generate-exception-baseline\" -- plugins scripts`). |";

const DEFER_ROW_WITH_SEMICOLON_IN_ACK =
  '| E-2 clean-architecture Minor: `rin-harness-config.ts` reads the opt-in with `node:fs` directly, bypassing the injected reader | defer(ack: Helen 2026-09-27 converging-review ruling, knowledge/pipeline/decisions.md; carried-forward.md row E-2, unit capture 01a0f1bf-1fc4-7157-a660-46ccc0ce1740) | 1. Why is it carried and not fixed here? — the read sits in `readConfig`, which every harness config consumer shares, and the port for that loader is owned by the one-config-reader collapse rather than by R7 (capture 019f7efa-fbcc-726b-92b2-9d3ff315dc82, absorbed by record 260927-one-harness-collapse). <br> 2. Why does R7 touch it? — `configR7OptIn` and its callers depend on the opt-in read (`git grep -n "configR7OptIn" -- plugins/rin`). <br> 3. Why is there no reader on the config path? — the config loader was never migrated onto the `SidecarFileReader` port (`rin-harness-config.ts` imports `existsSync` and `readFileSync` from `node:fs`). <br> 4. Why was it never migrated? — the loader predates the port, and the port was introduced for the registry sidecars only (`rin-harness-sidecar-file-reader.ts`, its single consumer family). <br> 5. root cause: config loading has no filesystem port. owner: record 260927-one-harness-collapse, via capture 01a0f1bf-1fc4-7157-a660-46ccc0ce1740 (`git grep -n "existsSync\\|readFileSync" -- plugins/rin/tools/rin-harness-config.ts`). |';

describe("the documented disposition-table row is accepted by the R7 emitter", () => {
  test.each([
    [
      "a push-back row whose chain sits in its column",
      PUSH_BACK_ROW_WITH_COLUMN_CHAIN,
    ],
    [
      "a defer row whose ack carries a semicolon",
      DEFER_ROW_WITH_SEMICOLON_IN_ACK,
    ],
  ])("%s exits zero", (_label, row) => {
    const outcome = emitWithConfig({
      args: [...baseArgs("READY"), "--findings", row],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.status).toBe(0);
  });

  test("both rows together are two findings, each disposed", () => {
    const outcome = emitWithConfig({
      args: [
        ...baseArgs("READY"),
        "--findings",
        `${PUSH_BACK_ROW_WITH_COLUMN_CHAIN}\n${DEFER_ROW_WITH_SEMICOLON_IN_ACK}`,
      ],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.verdictFile?.findings).toHaveLength(2);
  });

  test("a later cell naming fixed@<sha> does not dispose the finding", () => {
    const outcome = emitWithConfig({
      args: [
        ...baseArgs("READY"),
        "--findings",
        "src/kernel/a.ts:12 | const parsed = raw as Config | fixed@a1b2c3d4 | cast",
      ],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.status).not.toBe(0);
  });
});
